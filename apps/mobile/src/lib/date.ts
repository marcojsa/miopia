// Data lógica da "noite" do tratamento.
// Regra (docs/notas-implementacao.md §1): check-in feito ATÉ as 04h da manhã
// conta como a noite do dia ANTERIOR (pai que registra 00h30 não pode "perder" a noite).
// Arquivo puro (sem imports RN) — testável com `node --test` (src/lib/__tests__/date.test.ts).

export const NIGHT_CUTOFF_HOUR = 4;

/**
 * Retorna a data lógica local em 'YYYY-MM-DD' aplicando o corte da noite às 04h.
 * Ex.: 2026-06-11 03:59 local -> '2026-06-10'; 2026-06-11 04:00 -> '2026-06-11'.
 * Obs.: usa hora local do aparelho (mesma base dos triggers DAILY). O deslocamento
 * de -4h ignora transições de DST (Brasil não tem DST desde 2019).
 */
export function localDateString(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() - NIGHT_CUTOFF_HOUR * 60 * 60 * 1000);
  return formatLocalYMD(shifted);
}

/** Formata os componentes LOCAIS de uma data como 'YYYY-MM-DD' (sem UTC). */
export function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' -> Date local à meia-noite daquele dia (sem UTC). */
export function parseLocalYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Dia da semana (0=domingo..6=sábado) de uma data 'YYYY-MM-DD', ex.: a data lógica da noite. */
export function weekdayOfYMD(ymd: string): number {
  return parseLocalYMD(ymd).getDay();
}
