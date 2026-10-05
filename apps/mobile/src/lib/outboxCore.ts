// Regras puras do outbox de check-ins (sem RN/AsyncStorage) — testáveis com
// `node --test` (src/lib/__tests__/outbox.test.ts).
import type { PendingCheckin } from '../types/domain.ts';

/** A policy adh_guardian_insert só aceita log_date entre current_date - 7 e current_date. */
export const MAX_BACKFILL_DAYS = 7;

/**
 * Status HTTP de uma resposta do PostgREST que NÃO adianta reenviar (a linha foi
 * recusada pelo banco: RLS 403, FK/tipo inválido 400/409...). 0 = sem rede;
 * 401 = token vencido; 408/429/5xx = transitório.
 */
export function isPermanentRejection(status: number): boolean {
  if (status < 400 || status >= 500) return false;
  return status !== 401 && status !== 408 && status !== 429;
}

/** Separa os itens fora da janela aceita pelo servidor (log_date < minDate). */
export function splitExpired(
  queue: PendingCheckin[],
  minDate: string
): { keep: PendingCheckin[]; expired: PendingCheckin[] } {
  const keep: PendingCheckin[] = [];
  const expired: PendingCheckin[] = [];
  for (const item of queue) (item.log_date < minDate ? expired : keep).push(item);
  return { keep, expired };
}

/**
 * Tira da fila ATUAL só os itens resolvidos (por client_id). Itens enfileirados
 * enquanto o envio estava no ar continuam na fila.
 */
export function removeResolved(
  current: PendingCheckin[],
  resolved: ReadonlySet<string>
): PendingCheckin[] {
  return current.filter((c) => !resolved.has(c.client_id));
}

/** Um item por (treatment_id, log_date): a resposta mais recente substitui a anterior na fila. */
export function replaceInQueue(queue: PendingCheckin[], item: PendingCheckin): PendingCheckin[] {
  const rest = queue.filter(
    (c) => !(c.treatment_id === item.treatment_id && c.log_date === item.log_date)
  );
  return [...rest, item];
}

/**
 * Serializa execuções de `task`: chamada durante uma execução não é descartada —
 * agenda mais uma passada e devolve a promise em curso, que só resolve depois dela.
 */
export function createSerialRunner(task: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let again = false;
  return () => {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        again = false;
        await task();
      } while (again);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
