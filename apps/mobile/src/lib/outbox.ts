// Outbox de check-ins (AsyncStorage) — o check-in NUNCA depende de rede no handler.
// Reconciliação com o banco (docs/notas-implementacao.md §1):
//   - tabela adherence_logs, UNIQUE(treatment_id, log_date) — SEM coluna client_id;
//   - upsert com onConflict 'treatment_id,log_date' + ignoreDuplicates (retry seguro e
//     pai/mãe marcando a mesma noite não duplicam);
//   - client_id é só deduplicação LOCAL dentro da fila, nunca vai ao banco.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AdherenceStatus, PendingCheckin } from '../types/domain';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

const KEY = 'outbox:checkins';

/** Id local simples (não-criptográfico): só deduplica itens dentro da fila. */
export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<PendingCheckin[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingCheckin[]) : [];
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
  status: AdherenceStatus;
  note?: string | null;
  logged_by: string | null;
}

/**
 * Grava o check-in no outbox local. Dedup local: um item por (treatment_id, log_date)
 * — a resposta mais recente vence (espelha o upsert do servidor).
 */
export async function enqueueCheckin(input: EnqueueCheckinInput): Promise<void> {
  const q = await readQueue();
  const next = q.filter(
    (c) => !(c.treatment_id === input.treatment_id && c.log_date === input.log_date)
  );
  next.push({
    client_id: newClientId(),
    treatment_id: input.treatment_id,
    child_id: input.child_id,
    log_date: input.log_date,
    status: input.status,
    note: input.note ?? null,
    logged_by: input.logged_by,
  });
  await writeQueue(next);
}

let flushing = false;

/**
 * Envia a fila ao Supabase. Idempotente: upsert em adherence_logs com
 * onConflict 'treatment_id,log_date' e ignoreDuplicates (primeiro registro da noite vence
 * no servidor; retry nunca duplica).
 * Gatilhos: AppState -> 'active', NetInfo reconectou, após enqueue, pull-to-refresh.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) return; // evita flushes concorrentes (AppState + NetInfo simultâneos)
  flushing = true;
  try {
    const q = await readQueue();
    if (q.length === 0) return;

    // client_id existe SÓ no outbox — nunca enviar ao banco.
    const rows = q.map(({ client_id: _clientId, ...row }) => row);

    const { error } = await supabase
      .from('adherence_logs')
      .upsert(rows, { onConflict: 'treatment_id,log_date', ignoreDuplicates: true });

    if (!error) {
      await writeQueue([]);
      void queryClient.invalidateQueries({ queryKey: ['adherence_logs'] });
    }
    // Em erro (offline, RLS, etc.) a fila fica intacta para o próximo gatilho.
  } finally {
    flushing = false;
  }
}

/** Quantidade de check-ins aguardando sync (p/ indicador discreto na UI). */
export async function pendingCheckinCount(): Promise<number> {
  return (await readQueue()).length;
}
