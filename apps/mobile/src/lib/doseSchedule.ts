// Rotina da criança e distribuição das doses do dia — FUNÇÕES PURAS (testáveis
// com `node --test`, src/lib/__tests__/doseSchedule.test.ts).
//
// Regra (docs/especificacao-lumi-geral.md): o colírio de várias doses espalha
// os lembretes entre o acordar e o dormir — a primeira ao acordar, a última ao
// dormir, as do meio a intervalos iguais, em múltiplos de 5 minutos. Nunca
// durante o sono. Tratamento de 1 vez por dia continua com o horário do
// lembrete (reminder_prefs / suggested_time), exceto a lente de contato, que
// sempre segue a rotina (colocar ao acordar, tirar antes de dormir).
import type { Treatment } from '../types/domain.ts';

/** Sem linha em child_routines, o app usa 07:00–21:00 (default do banco). */
export const DEFAULT_WAKE = '07:00';
export const DEFAULT_BED = '21:00';

export interface Routine {
  /** 'HH:MM' */
  wake: string;
  /** 'HH:MM' */
  bed: string;
}

const STEP = 5;

/** 'HH:MM' ou 'HH:MM:SS' -> minutos desde 00:00; null se inválido. */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Minutos desde 00:00 -> 'HH:MM'. */
export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 'HH:MM:SS' -> 'HH:MM' (null se inválido). */
export function normalizeHM(time: string | null | undefined): string | null {
  const total = toMinutes(time);
  return total === null ? null : fromMinutes(total);
}

/**
 * Horários das `n` doses do dia, em 'HH:MM', em ordem. n = 1 -> [bed].
 * n >= 2 -> primeira em `wake`, última em `bed`, as do meio a intervalos iguais
 * arredondadas para múltiplos de 5 minutos, sempre dentro de [wake, bed].
 * Rotina inválida (dormir não depois de acordar) cai no padrão 07:00–21:00.
 */
export function doseTimes(wake: string, bed: string, n: number): string[] {
  let w = toMinutes(wake);
  let b = toMinutes(bed);
  if (w === null || b === null || b <= w) {
    w = toMinutes(DEFAULT_WAKE) as number;
    b = toMinutes(DEFAULT_BED) as number;
  }
  const count = Math.max(1, Math.floor(n));
  if (count === 1) return [fromMinutes(b)];

  const out: string[] = [];
  const step = (b - w) / (count - 1);
  for (let i = 0; i < count; i++) {
    if (i === 0) out.push(fromMinutes(w));
    else if (i === count - 1) out.push(fromMinutes(b));
    else {
      const rounded = Math.round((w + step * i) / STEP) * STEP;
      out.push(fromMinutes(Math.min(b, Math.max(w, rounded))));
    }
  }
  return out;
}

/** Mensagem de erro (pt-BR) da rotina, ou null se válida. */
export function routineError(wake: string, bed: string): string | null {
  const w = toMinutes(wake);
  const b = toMinutes(bed);
  if (w === null) return 'Escolha a hora em que a criança acorda.';
  if (b === null) return 'Escolha a hora em que a criança dorme.';
  if (b <= w) return 'A hora de dormir precisa ser depois da hora de acordar.';
  return null;
}

/** Rotina da criança a partir das linhas de child_routines (padrão 07:00–21:00). */
export function routineFor(
  rows: ReadonlyArray<{ child_id: string; wake_time: string; bed_time: string }>,
  childId: string
): Routine {
  const row = rows.find((r) => r.child_id === childId);
  const wake = normalizeHM(row?.wake_time) ?? DEFAULT_WAKE;
  const bed = normalizeHM(row?.bed_time) ?? DEFAULT_BED;
  if (routineError(wake, bed)) return { wake: DEFAULT_WAKE, bed: DEFAULT_BED };
  return { wake, bed };
}

/**
 * Horário fora do intervalo acordar–dormir da rotina: 'antes' de acordar,
 * 'depois' de dormir, ou null se dentro (os limites contam como dentro).
 */
export function outsideRoutine(time: string, routine: Routine): 'antes' | 'depois' | null {
  const t = toMinutes(time);
  const w = toMinutes(routine.wake);
  const b = toMinutes(routine.bed);
  if (t === null || w === null || b === null) return null;
  if (t < w) return 'antes';
  if (t > b) return 'depois';
  return null;
}

/** O horário das doses deste tratamento vem da rotina (e não do reminder_prefs)? */
export function usesRoutine(treatment: Pick<Treatment, 'type' | 'times_per_day'>): boolean {
  return treatment.type === 'lente_contato' || treatment.times_per_day > 1;
}

/** Quantos check-ins o tratamento pede por dia (sempre >= 1). */
export function dosesPerDay(treatment: Pick<Treatment, 'times_per_day'>): number {
  return Math.max(1, Math.floor(treatment.times_per_day || 1));
}

/** "2ª de 4". */
export function doseLabel(dose: number, total: number): string {
  return `${dose}ª de ${total}`;
}

/** Nome exibido do colírio: o cadastrado pela clínica ou "Colírio". */
export function colirioName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : 'Colírio';
}

/** Mesmo colírio (nome sem diferença de maiúsculas e espaços), como no banco. */
export function sameColirio(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}
