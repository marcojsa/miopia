// Outbox de check-ins (AsyncStorage) — o check-in NUNCA depende de rede no handler.
// Reconciliação com o banco (docs/notas-implementacao.md §1):
//   - tabela adherence_logs, UNIQUE(treatment_id, log_date, dose) — SEM coluna client_id;
//   - upsert com onConflict 'treatment_id,log_date,dose' + ignoreDuplicates (retry seguro e
//     pai/mãe marcando a mesma dose não duplicam); correções (replace) sobrescrevem;
//   - client_id é só deduplicação LOCAL dentro da fila, nunca vai ao banco.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AdherenceStatus, PendingCheckin } from '../types/domain';
import { localDateString } from './date';
import { addDays } from './gamification';
import {
  MAX_BACKFILL_DAYS,
  createSerialRunner,
  isPermanentRejection,
  removeResolved,
  replaceInQueue,
  splitExpired,
} from './outboxCore';
import { queryClient } from './queryClient';
import { storedUserId } from './session';
import { supabase } from './supabase';

const KEY = 'outbox:checkins';

/** Id local simples (não-criptográfico): só deduplica itens dentro da fila. */
export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<PendingCheckin[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    // Itens gravados antes das doses não têm `dose`: valem como a dose 1.
    return raw ? (JSON.parse(raw) as PendingCheckin[]).map((c) => ({ ...c, dose: c.dose ?? 1 })) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: PendingCheckin[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
}

export interface EnqueueCheckinInput {
  treatment_id: string;
  child_id: string;
  log_date: string; // data lógica — usar localDateString() (corte 04h)
  /** Dose do dia (1..times_per_day); padrão 1. */
  dose?: number;
  status: AdherenceStatus;
  note?: string | null;
  logged_by: string | null;
  /** Correção de uma resposta já registrada (sobrescreve no servidor). */
  replace?: boolean;
}

/**
 * Grava o check-in no outbox local. Dedup local: um item por (treatment_id, log_date,
 * dose) — a resposta mais recente vence NA FILA. No servidor a primeira resposta da
 * dose vence, exceto quando o item é uma correção (replace).
 */
export async function enqueueCheckin(input: EnqueueCheckinInput): Promise<void> {
  const q = await readQueue();
  await writeQueue(
    replaceInQueue(q, {
      client_id: newClientId(),
      treatment_id: input.treatment_id,
      child_id: input.child_id,
      log_date: input.log_date,
      dose: input.dose ?? 1,
      status: input.status,
      note: input.note ?? null,
      logged_by: input.logged_by,
      ...(input.replace ? { replace: true } : {}),
    })
  );
}

async function upsertItems(
  items: PendingCheckin[],
  userId: string,
  replace: boolean
): Promise<{ ok: boolean; status: number; code: string | null }> {
  // client_id existe SÓ no outbox — nunca enviar ao banco. logged_by é sempre o
  // usuário da sessão (a RLS exige logged_by = auth.uid()).
  const rows = items.map((c) => ({
    treatment_id: c.treatment_id,
    child_id: c.child_id,
    log_date: c.log_date,
    dose: c.dose ?? 1,
    status: c.status,
    note: c.note,
    logged_by: userId,
  }));
  const { error, status } = await supabase
    .from('adherence_logs')
    .upsert(rows, { onConflict: 'treatment_id,log_date,dose', ignoreDuplicates: !replace });
  return { ok: !error, status, code: error?.code ?? null };
}

/**
 * Envia um grupo e devolve os client_ids resolvidos (enviados ou recusados de vez).
 * O upsert em lote é atômico: se o banco recusa o lote, reenvia item a item para
 * que uma linha inválida não prenda as outras na fila para sempre.
 */
async function sendGroup(
  items: PendingCheckin[],
  userId: string,
  replace: boolean
): Promise<string[]> {
  if (items.length === 0) return [];
  const batch = await upsertItems(items, userId, replace);
  if (batch.ok) return items.map((c) => c.client_id);
  if (!isPermanentRejection(batch.status, batch.code)) return [];
  if (items.length === 1) return [items[0].client_id];

  const resolved: string[] = [];
  for (const item of items) {
    const res = await upsertItems([item], userId, replace);
    if (res.ok || isPermanentRejection(res.status, res.code)) resolved.push(item.client_id);
  }
  return resolved;
}

async function flushOnce(): Promise<void> {
  const q = await readQueue();
  if (q.length === 0) return;

  // Sem sessão gravada não há para quem registrar: a fila espera o login.
  const userId = await storedUserId();
  if (!userId) return;

  const minDate = addDays(localDateString(), -MAX_BACKFILL_DAYS);
  const { keep, expired } = splitExpired(q, minDate);
  const resolved = new Set(expired.map((c) => c.client_id));

  const inserts = keep.filter((c) => !c.replace);
  const replaces = keep.filter((c) => c.replace);
  for (const id of await sendGroup(inserts, userId, false)) resolved.add(id);
  for (const id of await sendGroup(replaces, userId, true)) resolved.add(id);

  if (resolved.size === 0) return; // offline/token vencido: fila intacta para o próximo gatilho
  await writeQueue(removeResolved(await readQueue(), resolved));
  void queryClient.invalidateQueries({ queryKey: ['adherence'] });
}

const runFlush = createSerialRunner(async () => {
  try {
    await flushOnce();
  } catch {
    // Storage/rede indisponível: a fila fica para o próximo gatilho.
  }
});

/**
 * Envia a fila ao Supabase. Chamadas concorrentes (AppState + NetInfo + check-in)
 * não se perdem: entram numa nova passada, e a promise só resolve depois dela.
 * Gatilhos: AppState -> 'active', NetInfo reconectou, após enqueue, pull-to-refresh.
 */
export function flushOutbox(): Promise<void> {
  return runFlush();
}

/** Quantidade de check-ins aguardando sync (p/ indicador discreto na UI). */
export async function pendingCheckinCount(): Promise<number> {
  return (await readQueue()).length;
}
