// Helpers PUROS da aba Família (idade da criança, rótulos de regime, conversão
// de horário e montagem do ChildScheduleInput[] do scheduler). Sem imports de
// RN — testável isoladamente.
//
// ANVISA RDC 657/2022 + LGPD: aqui só há rotina e gestão de lembretes/conta.
// NENHUM dado clínico é calculado, interpretado ou julgado — a idade da criança
// é dado cadastral (não clínico) e as instruções/horários vêm prescritos.
import type {
  Child,
  ChildRoutine,
  ChildScheduleInput,
  DoseReminderInput,
  ReminderPref,
  ReminderSchedule,
  ReminderTime,
  Treatment,
  TreatmentType,
} from '@/types/domain';

import {
  DEFAULT_BED,
  DEFAULT_WAKE,
  colirioName,
  doseTimes,
  dosesPerDay,
  lensTimes,
  normalizeHM,
  routineFor,
  usesRoutine,
  type LensTimes,
  type Routine,
} from '../../lib/doseSchedule.ts';

const DEFAULT_ROUTINE: Routine = { wake: DEFAULT_WAKE, bed: DEFAULT_BED };

/**
 * Idade em anos a partir de 'YYYY-MM-DD' (birth_date). Parse manual dos
 * componentes locais — NÃO usa new Date('YYYY-MM-DD') (seria UTC e poderia
 * deslocar o dia). Retorna null se a data for inválida.
 */
export function ageInYears(birthDate: string, now: Date = new Date()): number | null {
  const [yRaw, mRaw, dRaw] = birthDate.split('-');
  const year = Number(yRaw);
  const month = Number(mRaw);
  const day = Number(dRaw);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  let age = now.getFullYear() - year;
  // Ainda não fez aniversário neste ano?
  const monthNow = now.getMonth() + 1;
  const dayNow = now.getDate();
  if (monthNow < month || (monthNow === month && dayNow < day)) age -= 1;
  return age >= 0 ? age : null;
}

/** "8 anos" / "1 ano" — rótulo curto de idade (null se data inválida). */
export function ageLabel(birthDate: string, now: Date = new Date()): string | null {
  const age = ageInYears(birthDate, now);
  if (age === null) return null;
  return age === 1 ? '1 ano' : `${age} anos`;
}

/** Rótulo amigável do regime de tratamento. */
export function regimeLabel(type: TreatmentType): string {
  switch (type) {
    case 'atropina':
      return 'Atropina';
    case 'ortho_k':
      return 'Ortho-k';
    case 'colirio':
      return 'Colírio';
    case 'lente_contato':
      return 'Lente de contato';
    case 'oculos_lentes':
    default:
      return 'Óculos / lentes';
  }
}

/** Rótulo do tratamento: o colírio leva o nome ("Colírio Lubrificante"). */
export function treatmentLabel(treatment: Pick<Treatment, 'type' | 'name'>): string {
  if (treatment.type === 'colirio') {
    const name = colirioName(treatment.name);
    return name === 'Colírio' ? name : `Colírio ${name}`;
  }
  return regimeLabel(treatment.type);
}

/** Lente de contato de 1 vez por dia: tem hora de colocar e hora de tirar. */
export function isDailyLens(treatment: Pick<Treatment, 'type' | 'times_per_day'>): boolean {
  return treatment.type === 'lente_contato' && dosesPerDay(treatment) === 1;
}

/**
 * Hora de colocar e de tirar a lente: a escolha deste responsável
 * (reminder_prefs.reminder_time / remove_time), ou a rotina com o limite da Dra.
 */
export function lensTimesFor(
  treatment: Pick<Treatment, 'id' | 'max_wear_hours'>,
  prefs: ReminderPref[],
  routine: Routine = DEFAULT_ROUTINE
): LensTimes {
  const pref = prefs.find((p) => p.treatment_id === treatment.id && p.enabled);
  return lensTimes({
    wake: routine.wake,
    bed: routine.bed,
    // Cache antigo (de antes das colunas) vem sem os campos: vale "sem limite / sem escolha".
    maxHours: treatment.max_wear_hours ?? null,
    prefOn: normalizeHM(pref?.reminder_time),
    prefOff: normalizeHM(pref?.remove_time),
  });
}

/**
 * Resumo curto do regime ativo para a lista de filhos (ex.: "Atropina ·
 * 20h30"; "Colírio Lubrificante · 4x por dia · 7h, 11h40, 16h20, 21h"; "Lente
 * de contato · 7h–15h"), com o horário do lembrete deste responsável (o mesmo
 * do scheduler).
 */
export function regimeSummary(
  treatment: Treatment | undefined,
  prefs: ReminderPref[] = [],
  routine: Routine = DEFAULT_ROUTINE
): string {
  if (!treatment) return 'Sem tratamento ativo no momento';
  const label = treatmentLabel(treatment);
  const n = dosesPerDay(treatment);
  const parts = [label];
  if (n > 1) parts.push(`${n}x por dia`);
  if (isDailyLens(treatment)) {
    const lens = lensTimesFor(treatment, prefs, routine);
    parts.push(`${formatTimePtBR(lens.on)}–${formatTimePtBR(lens.off)}`);
    return parts.join(' · ');
  }
  const time = reminderTimeLabel(treatment, prefs, routine);
  if (time) parts.push(time);
  return parts.join(' · ');
}

/**
 * Horário exibido de um tratamento: o do lembrete que toca neste aparelho
 * (preferência do responsável > sugestão da médica > padrão do tipo). Óculos/lentes
 * não têm lembrete: mostra só a sugestão, se houver. Colírio de várias doses: os
 * horários que saem da rotina da criança. Lente de contato: colocar e tirar
 * (escolha do responsável, ou a rotina com o limite da Dra.).
 */
export function reminderTimeLabel(
  treatment: Treatment,
  prefs: ReminderPref[],
  routine: Routine = DEFAULT_ROUTINE
): string | null {
  if (isDailyLens(treatment)) {
    const lens = lensTimesFor(treatment, prefs, routine);
    return `colocar ${formatTimePtBR(lens.on)} · tirar ${formatTimePtBR(lens.off)}`;
  }
  if (usesRoutine(treatment)) {
    return doseTimes(routine.wake, routine.bed, dosesPerDay(treatment))
      .map((t) => formatTimePtBR(t))
      .join(', ');
  }
  if (treatment.type === 'oculos_lentes') {
    return formatTimePtBR(treatment.suggested_time);
  }
  return formatReminderTime(effectiveTime(treatment, prefs, fallbackTimeFor(treatment.type)));
}

/** Uma dose devida no dia: número, total e horário (null = sem horário). */
export interface DoseSlot {
  dose: number;
  total: number;
  time: ReminderTime | null;
}

/**
 * Doses do dia de um tratamento, com o horário de cada uma. Tratamento de 1 vez
 * por dia usa o horário do lembrete; colírio de várias doses usa a rotina; a lente
 * de contato registra 1 vez por dia, na hora de tirar (lensTimes), a menos que a
 * clínica peça mais vezes.
 */
export function scheduledDoses(
  treatment: Treatment,
  prefs: ReminderPref[],
  routine: Routine = DEFAULT_ROUTINE
): DoseSlot[] {
  const total = dosesPerDay(treatment);
  if (isDailyLens(treatment)) {
    return [{ dose: 1, total: 1, time: parseHM(lensTimesFor(treatment, prefs, routine).off) }];
  }
  if (usesRoutine(treatment)) {
    return doseTimes(routine.wake, routine.bed, total).map((t, i) => ({
      dose: i + 1,
      total,
      time: parseHM(t),
    }));
  }
  const time =
    treatment.type === 'oculos_lentes'
      ? parseHM(treatment.suggested_time)
      : effectiveTime(treatment, prefs, fallbackTimeFor(treatment.type));
  return [{ dose: 1, total: 1, time }];
}

/** 'HH:MM:SS' (ou 'HH:MM') -> '20h30' / '21h'. null se vazio/inválido. */
export function formatTimePtBR(time: string | null): string | null {
  const parsed = parseHM(time);
  if (!parsed) return null;
  return parsed.minute === 0 ? `${parsed.hour}h` : `${parsed.hour}h${pad2(parsed.minute)}`;
}

/** 'HH:MM:SS'/'HH:MM' -> { hour, minute }. null se inválido. */
export function parseHM(time: string | null): ReminderTime | null {
  if (!time) return null;
  const [hRaw, mRaw] = time.split(':');
  const hour = Number(hRaw);
  const minute = Number(mRaw ?? '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** { hour, minute } -> 'HH:MM:00' para gravar em reminder_prefs.reminder_time. */
export function toReminderTimeString(t: ReminderTime): string {
  return `${pad2(t.hour)}:${pad2(t.minute)}:00`;
}

/** { hour, minute } -> '20h30' / '7h' (display). */
export function formatReminderTime(t: ReminderTime): string {
  return t.minute === 0 ? `${t.hour}h` : `${t.hour}h${pad2(t.minute)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Retirada da lente de ortho-k é fixa de manhã no MVP (07:00). */
export const ORTHOK_OFF_TIME: ReminderTime = { hour: 7, minute: 0 };

/**
 * Horário efetivo de um tratamento: a preferência do responsável vence a
 * sugestão da médica; sem nenhuma das duas, cai no fallback informado.
 */
export function effectiveTime(
  treatment: Treatment,
  prefs: ReminderPref[],
  fallback: ReminderTime
): ReminderTime {
  const pref = prefs.find((p) => p.treatment_id === treatment.id && p.enabled);
  return parseHM(pref?.reminder_time ?? null) ?? parseHM(treatment.suggested_time) ?? fallback;
}

/** Fallback de horário por tipo (quando nem prescrição nem preferência existem). */
export function fallbackTimeFor(type: TreatmentType): ReminderTime {
  switch (type) {
    case 'atropina':
      return { hour: 20, minute: 30 };
    case 'ortho_k':
    case 'colirio':
    case 'lente_contato':
      return { hour: 21, minute: 0 };
    case 'oculos_lentes':
    default:
      return { hour: 20, minute: 0 };
  }
}

/**
 * Monta o ChildScheduleInput[] que syncSchedulesForFamily() espera, a partir do
 * estado atual (filhos, tratamentos ativos, preferências de horário e o
 * conjunto de filhos pausados). Cada filho contribui no máximo com 1 atropina e
 * 1 ortho-k (colocar à noite + retirar de manhã fixa), um lembrete por dose de
 * cada colírio e colocar/tirar da lente de contato (lensTimes).
 *
 * `pausedChildIds`: ids dos filhos em pausa de férias — vira remindersPaused
 * true (o scheduler cancela todos os lembretes daquele filho).
 */
export function buildFamilySchedule(
  children: Child[],
  treatments: Treatment[],
  prefs: ReminderPref[],
  pausedChildIds: ReadonlySet<string>,
  routines: ChildRoutine[] = []
): ChildScheduleInput[] {
  return children.map((child) => {
    const childTreatments = treatments.filter((t) => t.child_id === child.id);
    const atropinaTreatment = childTreatments.find((t) => t.type === 'atropina');
    const orthokTreatment = childTreatments.find((t) => t.type === 'ortho_k');
    const routine = routineFor(routines, child.id);
    const doses: DoseReminderInput[] = [];

    for (const colirio of childTreatments.filter((t) => t.type === 'colirio')) {
      for (const slot of scheduledDoses(colirio, prefs, routine)) {
        if (!slot.time) continue;
        doses.push({
          treatmentId: colirio.id,
          type: 'colirio',
          dose: slot.dose,
          total: slot.total,
          label: colirioName(colirio.name),
          time: slot.time,
          schedule: scheduleOf(colirio),
          withCheckinActions: true,
        });
      }
    }

    const lente = childTreatments.find((t) => t.type === 'lente_contato');
    if (lente) {
      const total = dosesPerDay(lente);
      const base = { treatmentId: lente.id, total, label: 'Lente de contato', schedule: scheduleOf(lente) };
      if (total === 1) {
        // Colocar só lembra; o registro do dia é na hora de tirar.
        const lens = lensTimesFor(lente, prefs, routine);
        const on = parseHM(lens.on) ?? { hour: 7, minute: 0 };
        const off = parseHM(lens.off) ?? { hour: 21, minute: 0 };
        doses.push({ ...base, type: 'lente_on', dose: 1, time: on, withCheckinActions: false });
        doses.push({ ...base, type: 'lente_off', dose: 1, time: off, withCheckinActions: true });
      } else {
        scheduledDoses(lente, prefs, routine).forEach((slot) => {
          if (!slot.time) return;
          const type = slot.dose === 1 ? 'lente_on' : slot.dose === total ? 'lente_off' : 'lente_dose';
          doses.push({ ...base, type, dose: slot.dose, time: slot.time, withCheckinActions: true });
        });
      }
    }

    const input: ChildScheduleInput = {
      childId: child.id,
      firstName: child.first_name,
      remindersPaused: pausedChildIds.has(child.id),
    };

    if (atropinaTreatment) {
      input.atropina = {
        treatmentId: atropinaTreatment.id,
        time: effectiveTime(atropinaTreatment, prefs, fallbackTimeFor('atropina')),
        schedule: scheduleOf(atropinaTreatment),
      };
    }
    if (orthokTreatment) {
      input.orthok = {
        treatmentId: orthokTreatment.id,
        onTime: effectiveTime(orthokTreatment, prefs, fallbackTimeFor('ortho_k')),
        offTime: ORTHOK_OFF_TIME,
        schedule: scheduleOf(orthokTreatment),
      };
    }
    if (doses.length > 0) input.doses = doses;
    return input;
  });
}

function scheduleOf(treatment: Treatment): ReminderSchedule {
  return {
    daysOfWeek: treatment.days_of_week,
    startsOn: treatment.starts_on,
    endsOn: treatment.ends_on,
  };
}
