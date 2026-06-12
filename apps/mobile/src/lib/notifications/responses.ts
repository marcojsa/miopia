// Tratamento das respostas de notificação (botões Feito/Pular e tap no corpo).
// OUTBOX PRIMEIRO: nunca depender de rede dentro do handler.
// Cold start: iOS pode entregar a resposta só na próxima abertura do app
// (useLastNotificationResponse no _layout raiz) — por isso TODA resposta passa por
// processNotificationResponseOnce(), que deduplica por identifier+timestamp.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { localDateString } from '../date';
import { enqueueCheckin, flushOutbox } from '../outbox';
import { supabase } from '../supabase';
import { ACTION_DONE, ACTION_SKIP } from './categories';

const PROCESSED_KEY = 'notifications:processed-responses';
const PROCESSED_MAX = 50;

interface NotificationData {
  childId: string;
  type: string;
  treatmentId: string;
}

function parseData(resp: Notifications.NotificationResponse): NotificationData | null {
  const data = resp.notification.request.content.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const { childId, type, treatmentId } = data;
  if (typeof childId !== 'string' || typeof type !== 'string' || typeof treatmentId !== 'string') {
    return null;
  }
  return { childId, type, treatmentId };
}

export async function handleNotificationResponse(
  resp: Notifications.NotificationResponse
): Promise<void> {
  const data = parseData(resp);
  if (!data) return; // notificação sem payload de check-in (ex.: aviso da clínica)

  const action = resp.actionIdentifier; // 'done' | 'skip' | DEFAULT (tap no corpo)

  if (action === ACTION_DONE || action === ACTION_SKIP) {
    // logged_by precisa ser o auth.uid() (RLS with check) — sessão é leitura local.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;

    await enqueueCheckin({
      treatment_id: data.treatmentId,
      child_id: data.childId,
      log_date: localDateString(), // data lógica (corte 04h)
      status: action === ACTION_DONE ? 'feito' : 'pulado',
      logged_by: userId,
    });
    void flushOutbox(); // best-effort imediato; gatilhos de app cobrem o retry
    void Notifications.dismissNotificationAsync(resp.notification.request.identifier);
  } else {
    // Tap no corpo -> sheet de check-in no app (fallback de 1 toque a mais)
    router.push(`/checkin/${data.childId}:${data.type}`);
  }
}

function responseKey(resp: Notifications.NotificationResponse): string {
  return `${resp.notification.request.identifier}:${resp.notification.date}`;
}

/**
 * Processa uma resposta NO MÁXIMO uma vez — o listener em foreground e o
 * useLastNotificationResponse no cold start podem entregar a MESMA resposta.
 */
export async function processNotificationResponseOnce(
  resp: Notifications.NotificationResponse
): Promise<void> {
  const key = responseKey(resp);
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_KEY);
    const processed: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (processed.includes(key)) return;

    const next = [...processed, key].slice(-PROCESSED_MAX);
    await AsyncStorage.setItem(PROCESSED_KEY, JSON.stringify(next));
  } catch {
    // Se a deduplicação falhar, ainda processa: o upsert idempotente
    // (treatment_id, log_date) garante que nada duplica no banco.
  }
  await handleNotificationResponse(resp);
}
