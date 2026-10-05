// Estado DESEJADO dos lembretes locais (puro, sem RN/expo) — testável com
// `node --test` (src/lib/__tests__/schedulePlan.test.ts). O scheduler compara
// este plano com o que está agendado no SO e aplica só o delta.
import type { ChildScheduleInput, ReminderSchedule, ReminderTime, ReminderType } from '../../types/domain.ts';
import { NIGHT_CUTOFF_HOUR } from '../date.ts';

export const REMINDER_TYPES: readonly ReminderType[] = ['atropina', 'orthok_on', 'orthok_off'];

/** Id determinístico: `${childId}:${tipo}` (diário) ou `${childId}:${tipo}:${0-6}` (semanal). */
export function notifId(childId: string, type: ReminderType, weekday: number | null = null): string {
  return weekday === null ? `${childId}:${type}` : `${childId}:${type}:${weekday}`;
}

export function parseNotifId(id: string): { childId: string; type: ReminderType } | null {
  const match = /^(.+):(atropina|orthok_on|orthok_off)(?::[0-6])?$/.exec(id);
  if (!match) return null;
  return { childId: match[1], type: match[2] as ReminderType };
}

// Conteúdo ESTÁTICO de propósito (trigger repetitivo não muda texto);
// celebração dinâmica fica na tela Hoje.
const COPY: Record<ReminderType, (firstName: string) => { title: string; body: string }> = {
  atropina: (n) => ({
    title: `Hora do colírio — ${n}`,
    body: 'Pingar a atropina antes de dormir. Toque em Feito quando aplicar.',
  }),
  orthok_on: (n) => ({
    title: `Hora da lente — ${n}`,
    body: 'Colocar a lente de ortho-k antes de dormir.',
  }),
  orthok_off: (n) => ({
    title: `Retirar a lente — ${n}`,
    body: 'Bom dia! Hora de retirar a lente de ortho-k.',
  }),
};

export interface DesiredSchedule {
  childId: string;
  treatmentId: string;
  type: ReminderType;
  title: string;
  body: string;
  hour: number;
  minute: number;
  /** null = todo dia (DAILY); 0-6 = dia do calendário do disparo (0=domingo, WEEKLY). */
  weekday: number | null;
  /** Botões Feito/Pular só nos lembretes da noite; a retirada da manhã não registra a noite. */
  withCheckinActions: boolean;
}

/**
 * Agenda um lembrete respeitando a prescrição: fora da janela [starts_on, ends_on]
 * não agenda; com dias da semana restritos vira um lembrete semanal por dia.
 * Os dias da prescrição são NOITES (data lógica); o disparo cai no dia seguinte
 * quando é de manhã (retirada da lente) ou de madrugada (antes do corte das 04h).
 */
function addReminder(
  desired: Map<string, DesiredSchedule>,
  base: Omit<DesiredSchedule, 'weekday' | 'hour' | 'minute'>,
  time: ReminderTime,
  rule: ReminderSchedule,
  today: string
): void {
  if (rule.startsOn > today) return;
  if (rule.endsOn && rule.endsOn < today) return;

  const nights = new Set(rule.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (rule.daysOfWeek.length === 0 || nights.size === 7) {
    desired.set(notifId(base.childId, base.type), { ...base, ...time, weekday: null });
    return;
  }
  const nextDay = base.type === 'orthok_off' || time.hour < NIGHT_CUTOFF_HOUR ? 1 : 0;
  for (const night of nights) {
    const weekday = (night + nextDay) % 7;
    desired.set(notifId(base.childId, base.type, weekday), { ...base, ...time, weekday });
  }
}

/** `today`: data lógica de hoje ('YYYY-MM-DD', corte 04h). */
export function buildDesired(
  children: ChildScheduleInput[],
  today: string
): Map<string, DesiredSchedule> {
  const desired = new Map<string, DesiredSchedule>();
  for (const c of children) {
    if (c.remindersPaused) continue; // férias/doença: zero lembretes deste filho

    if (c.atropina) {
      addReminder(
        desired,
        {
          childId: c.childId,
          treatmentId: c.atropina.treatmentId,
          type: 'atropina',
          ...COPY.atropina(c.firstName),
          withCheckinActions: true,
        },
        c.atropina.time,
        c.atropina.schedule,
        today
      );
    }
    if (c.orthok) {
      addReminder(
        desired,
        {
          childId: c.childId,
          treatmentId: c.orthok.treatmentId,
          type: 'orthok_on',
          ...COPY.orthok_on(c.firstName),
          withCheckinActions: true,
        },
        c.orthok.onTime,
        c.orthok.schedule,
        today
      );
      addReminder(
        desired,
        {
          childId: c.childId,
          treatmentId: c.orthok.treatmentId,
          type: 'orthok_off',
          ...COPY.orthok_off(c.firstName),
          withCheckinActions: false,
        },
        c.orthok.offTime,
        c.orthok.schedule,
        today
      );
    }
  }
  return desired;
}
