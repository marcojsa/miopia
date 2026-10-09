// Estado DESEJADO dos lembretes locais (puro, sem RN/expo) — testável com
// `node --test` (src/lib/__tests__/schedulePlan.test.ts). O scheduler compara
// este plano com o que está agendado no SO e aplica só o delta.
import type {
  ChildScheduleInput,
  DoseReminderInput,
  ReminderSchedule,
  ReminderTime,
  ReminderType,
} from '../../types/domain.ts';
import { NIGHT_CUTOFF_HOUR } from '../date.ts';
import { doseLabel } from '../doseSchedule.ts';

export const REMINDER_TYPES: readonly ReminderType[] = [
  'atropina',
  'orthok_on',
  'orthok_off',
  'colirio',
  'lente_on',
  'lente_dose',
  'lente_off',
];

/** Lembretes por dose: o id leva o tratamento (pode haver dois colírios) e a dose. */
const PER_DOSE_TYPES: ReadonlySet<ReminderType> = new Set(['colirio', 'lente_on', 'lente_dose', 'lente_off']);

/** Tratamento e dose de um lembrete por dose. */
export interface DoseRef {
  treatmentId: string;
  dose: number;
}

/**
 * Id determinístico do lembrete (e da rota /checkin/[id]):
 * - atropina/ortho-k (formato antigo): `${childId}:${tipo}` e, semanal, `:${0-6}`;
 * - colírio e lente: `${childId}:${tipo}:${treatmentId}:${dose}` e, semanal, `:${0-6}`.
 */
export function notifId(
  childId: string,
  type: ReminderType,
  weekday: number | null = null,
  ref?: DoseRef
): string {
  const base = PER_DOSE_TYPES.has(type) && ref ? `${childId}:${type}:${ref.treatmentId}:${ref.dose}` : `${childId}:${type}`;
  return weekday === null ? base : `${base}:${weekday}`;
}

export interface ParsedNotifId {
  childId: string;
  type: ReminderType;
  /** Só nos lembretes por dose (colírio/lente). */
  treatmentId?: string;
  dose?: number;
}

const DOSE_ID = /^([^:]+):(colirio|lente_on|lente_dose|lente_off):([^:]+):([1-6])(?::[0-6])?$/;
const LEGACY_ID = /^(.+):(atropina|orthok_on|orthok_off)(?::[0-6])?$/;

export function parseNotifId(id: string): ParsedNotifId | null {
  const dose = DOSE_ID.exec(id);
  if (dose) {
    return {
      childId: dose[1],
      type: dose[2] as ReminderType,
      treatmentId: dose[3],
      dose: Number(dose[4]),
    };
  }
  const match = LEGACY_ID.exec(id);
  if (!match) return null;
  return { childId: match[1], type: match[2] as ReminderType };
}

// Conteúdo ESTÁTICO de propósito (trigger repetitivo não muda texto);
// celebração dinâmica fica na tela Hoje.
const COPY: Record<
  'atropina' | 'orthok_on' | 'orthok_off',
  (firstName: string) => { title: string; body: string }
> = {
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

/** Textos dos lembretes por dose (sem citar a condição tratada). */
export function doseCopy(d: DoseReminderInput, firstName: string): { title: string; body: string } {
  switch (d.type) {
    case 'colirio':
      return {
        title: `Hora do colírio — ${firstName}`,
        body: d.total > 1 ? `${d.label}: ${doseLabel(d.dose, d.total)}` : `${d.label}. Toque em Feito quando pingar.`,
      };
    case 'lente_on':
      return {
        title: `Colocar a lente — ${firstName}`,
        body: d.withCheckinActions
          ? 'Hora de colocar a lente de contato. Toque em Feito quando colocar.'
          : 'Hora de colocar a lente de contato.',
      };
    case 'lente_dose':
      return {
        title: `Cuidado da lente — ${firstName}`,
        body: `Lente de contato: ${doseLabel(d.dose, d.total)}`,
      };
    case 'lente_off':
      return {
        title: `Tirar a lente — ${firstName}`,
        body: 'Hora de tirar a lente de contato. Toque em Feito quando tirar.',
      };
  }
}

export interface DesiredSchedule {
  childId: string;
  treatmentId: string;
  /** Dose do dia que o lembrete registra (1 nos tratamentos de uma vez por dia). */
  dose: number;
  type: ReminderType;
  title: string;
  body: string;
  hour: number;
  minute: number;
  /** null = todo dia (DAILY); 0-6 = dia do calendário do disparo (0=domingo, WEEKLY). */
  weekday: number | null;
  /** Botões Feito/Pular só nos lembretes que registram o cuidado (não na retirada do ortho-k nem no "colocar" da lente de 1 vez por dia). */
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

  const ref = { treatmentId: base.treatmentId, dose: base.dose };
  const nights = new Set(rule.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (rule.daysOfWeek.length === 0 || nights.size === 7) {
    desired.set(notifId(base.childId, base.type, null, ref), { ...base, ...time, weekday: null });
    return;
  }
  const nextDay = base.type === 'orthok_off' || time.hour < NIGHT_CUTOFF_HOUR ? 1 : 0;
  for (const night of nights) {
    const weekday = (night + nextDay) % 7;
    desired.set(notifId(base.childId, base.type, weekday, ref), { ...base, ...time, weekday });
  }
}

/** iOS guarda no máximo 64 notificações agendadas por app; deixamos folga. */
export const IOS_SCHEDULE_LIMIT = 60;

/**
 * Corta o plano em `limit` lembretes quando passa do teto do iOS. Prioridade:
 * os que registram o cuidado (botões Feito/Pular) antes dos que só lembram;
 * entre eles, os de dose menor (a 1ª dose de cada tratamento antes da 2ª...);
 * empate mantém a ordem de montagem (filho a filho).
 */
export function capSchedule(
  desired: Map<string, DesiredSchedule>,
  limit: number = IOS_SCHEDULE_LIMIT
): { kept: Map<string, DesiredSchedule>; dropped: string[] } {
  if (desired.size <= limit) return { kept: desired, dropped: [] };
  const ranked = [...desired.entries()]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const actions = Number(b.entry[1].withCheckinActions) - Number(a.entry[1].withCheckinActions);
      if (actions !== 0) return actions;
      const dose = a.entry[1].dose - b.entry[1].dose;
      return dose !== 0 ? dose : a.index - b.index;
    });
  const kept = new Map(ranked.slice(0, limit).map((r) => r.entry));
  const dropped = ranked.slice(limit).map((r) => r.entry[0]);
  return { kept, dropped };
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
          dose: 1,
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
          dose: 1,
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
          dose: 1,
          type: 'orthok_off',
          ...COPY.orthok_off(c.firstName),
          withCheckinActions: false,
        },
        c.orthok.offTime,
        c.orthok.schedule,
        today
      );
    }
    for (const d of c.doses ?? []) {
      addReminder(
        desired,
        {
          childId: c.childId,
          treatmentId: d.treatmentId,
          dose: d.dose,
          type: d.type,
          ...doseCopy(d, c.firstName),
          withCheckinActions: d.withCheckinActions,
        },
        d.time,
        d.schedule,
        today
      );
    }
  }
  return desired;
}
