// Tratamento das respostas de notificação (botões Feito/Pular e tap no corpo).
// OUTBOX PRIMEIRO: nunca depender de rede dentro do handler.
// Cold start: iOS pode entregar a resposta só na próxima abertura do app
// (getLastNotificationResponse no _layout raiz) — por isso TODA resposta passa por
// processNotificationResponseOnce(), que deduplica por identifier+timestamp.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { isScheduledOn } from '../../components/hoje/hojeHelpers';
import { queryKeys } from '../../hooks/keys';
import { useUiStore } from '../../stores/ui';
import type { AdherenceLog, Treatment } from '../../types/domain';
import { upsertLocal } from '../adherenceCache';
import { localDateString } from '../date';
import { enqueueCheckin, flushOutbox, newClientId } from '../outbox';
import { queryClient } from '../queryClient';
import { storedUserId } from '../session';
import { ACTION_DONE, ACTION_SKIP } from './categories';

const PROCESSED_KEY = 'notifications:processed-responses';
const PROCESSED_MAX = 50;

interface NotificationData {
  childId: string;
  type: string;
  treatmentId: string;
  /** Dose do dia; lembretes agendados antes das doses não trazem e valem como 1. */
  dose: number;
}

function parseData(resp: Notifications.NotificationResponse): NotificationData | null {
  const data = resp.notification.request.content.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const { childId, type, treatmentId, dose } = data;
  if (typeof childId !== 'string' || typeof type !== 'string' || typeof treatmentId !== 'string') {
    return null;
  }
  const doseNumber = typeof dose === 'number' && Number.isInteger(dose) && dose >= 1 ? dose : 1;
  return { childId, type, treatmentId, dose: doseNumber };
}

/** Tira a notificação da bandeja e, se for de um lembrete que não vale mais, desagenda. */
function dismiss(resp: Notifications.NotificationResponse, cancelSchedule: boolean): void {
  const id = resp.notification.request.identifier;
  void Notifications.dismissNotificationAsync(id).catch(() => {});
  if (cancelSchedule) void Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Acende a noite na Hoje na hora, mesmo offline (igual ao check-in feito no app). */
function applyOptimistic(log: AdherenceLog): void {
  queryClient.setQueryData<AdherenceLog[]>(queryKeys.adherenceToday(log.log_date), (old) =>
    upsertLocal(old, log)
  );
  queryClient.setQueriesData<AdherenceLog[]>(
    { queryKey: queryKeys.adherenceByChild(log.child_id) },
    (old) => (old === undefined ? old : upsertLocal(old, log))
  );
  void queryClient.invalidateQueries({ queryKey: ['adherence'] });
}

export async function handleNotificationResponse(
  resp: Notifications.NotificationResponse
): Promise<void> {
  const data = parseData(resp);
  if (!data) return; // notificação sem payload de check-in (ex.: aviso da clínica)

  const action = resp.actionIdentifier; // 'done' | 'skip' | DEFAULT (tap no corpo)

  // Notificação antiga na bandeja depois do logout: sem sessão não há para quem
  // registrar nem tela a abrir (o app abre na Welcome pelo guard).
  // logged_by precisa ser o auth.uid() (RLS with check) — sessão é leitura local.
  const userId = await storedUserId();
  if (!userId) return;

  // Lembrete órfão: a clínica encerrou ou trocou o regime e o aparelho ainda não
  // reconciliou. Só decide com a lista de tratamentos em cache (sem cache, segue).
  const active = queryClient.getQueryData<Treatment[]>(queryKeys.treatments(undefined));
  const treatment = active?.find((t) => t.id === data.treatmentId);
  if (active && !treatment) {
    dismiss(resp, true);
    return;
  }

  if (action === ACTION_DONE || action === ACTION_SKIP) {
    // A retirada do ortho-k (manhã) não registra noite: a noite é marcada ao colocar.
    // O "colocar" da lente de contato de 1 vez por dia também não: registra-se ao tirar.
    if (
      data.type === 'orthok_off' ||
      (data.type === 'lente_on' && (treatment?.times_per_day ?? 1) <= 1)
    ) {
      dismiss(resp, false);
      return;
    }
    // Dose que o tratamento não tem mais (a clínica reduziu as vezes por dia).
    if (treatment && data.dose > treatment.times_per_day) {
      dismiss(resp, true);
      return;
    }
    const logDate = localDateString(); // data lógica (corte 04h)
    // Noite fora da prescrição (dia da semana ou janela de datas): não registra.
    if (treatment && !isScheduledOn(treatment, logDate)) {
      dismiss(resp, false);
      return;
    }
    const status = action === ACTION_DONE ? 'feito' : 'pulado';

    await enqueueCheckin({
      treatment_id: data.treatmentId,
      child_id: data.childId,
      log_date: logDate,
      dose: data.dose,
      status,
      logged_by: userId,
    });
    applyOptimistic({
      id: `local-${newClientId()}`,
      treatment_id: data.treatmentId,
      child_id: data.childId,
      log_date: logDate,
      dose: data.dose,
      status,
      note: null,
      logged_by: userId,
      created_at: new Date().toISOString(),
    });
    void flushOutbox(); // best-effort imediato; gatilhos de app cobrem o retry
    dismiss(resp, false);
  } else {
    // Tap no corpo -> sheet de check-in no app (fallback de 1 toque a mais). A
    // navegação fica com o grupo (app), depois dos gates e com o navegador montado.
    useUiStore.setState({
      pendingCheckin: {
        childId: data.childId,
        type: data.type,
        treatmentId: data.treatmentId,
        dose: data.dose,
      },
    });
  }
}

function responseKey(resp: Notifications.NotificationResponse): string {
  return `${resp.notification.request.identifier}:${resp.notification.date}`;
}

const seenThisRun = new Set<string>();

/**
 * Processa uma resposta NO MÁXIMO uma vez — o listener em foreground e a leitura
 * da última resposta no cold start podem entregar a MESMA resposta. O Set em
 * memória fecha a corrida entre as duas (antes de qualquer await); o AsyncStorage
 * cobre a reabertura do app.
 */
export async function processNotificationResponseOnce(
  resp: Notifications.NotificationResponse
): Promise<void> {
  const key = responseKey(resp);
  if (seenThisRun.has(key)) return;
  seenThisRun.add(key);
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_KEY);
    const processed: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (processed.includes(key)) return;

    const next = [...processed, key].slice(-PROCESSED_MAX);
    await AsyncStorage.setItem(PROCESSED_KEY, JSON.stringify(next));
  } catch {
    // Se a deduplicação falhar, ainda processa: o upsert idempotente
    // (treatment_id, log_date, dose) garante que nada duplica no banco.
  }
  await handleNotificationResponse(resp);
}
