// Regra pura do cache otimista de check-ins (sem RN) — testável com `node --test`.
import type { AdherenceLog } from '../types/domain.ts';

/** Um log por (treatment_id, log_date): o check-in novo substitui o anterior no cache. */
export function upsertLocal(
  logs: AdherenceLog[] | undefined,
  optimistic: AdherenceLog
): AdherenceLog[] {
  const rest = (logs ?? []).filter(
    (l) => !(l.treatment_id === optimistic.treatment_id && l.log_date === optimistic.log_date)
  );
  return [...rest, optimistic];
}
