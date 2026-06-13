// Helpers PUROS da aba Família (idade da criança, rótulos de regime, conversão
// de horário e montagem do ChildScheduleInput[] do scheduler). Sem imports de
// RN — testável isoladamente.
//
// ANVISA RDC 657/2022 + LGPD: aqui só há rotina e gestão de lembretes/conta.
// NENHUM dado clínico é calculado, interpretado ou julgado — a idade da criança
// é dado cadastral (não clínico) e as instruções/horários vêm prescritos.
import type {
  Child,
  ChildScheduleInput,
  ReminderPref,
  ReminderTime,
  Treatment,
  TreatmentType,
} from '@/types/domain';

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
    case 'oculos_lentes':
    default:
      return 'Óculos / lentes';
  }
}

/**
 * Resumo curto do regime ativo para a lista de filhos (ex.: "Atropina ·
 * 20h30"). Sem horário quando não há sugestão. Vazio se não houver tratamento.
 */
export function regimeSummary(treatment: Treatment | undefined): string {
  if (!treatment) return 'Sem tratamento ativo no momento';
  const time = formatTimePtBR(treatment.suggested_time);
  return time ? `${regimeLabel(treatment.type)} · ${time}` : regimeLabel(treatment.type);
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
 * 1 ortho-k (colocar à noite + retirar de manhã fixa).
 *
 * `pausedChildIds`: ids dos filhos em pausa de férias — vira remindersPaused
 * true (o scheduler cancela todos os lembretes daquele filho).
 */
export function buildFamilySchedule(
  children: Child[],
  treatments: Treatment[],
  prefs: ReminderPref[],
  pausedChildIds: ReadonlySet<string>
): ChildScheduleInput[] {
  return children.map((child) => {
    const childTreatments = treatments.filter((t) => t.child_id === child.id);
    const atropinaTreatment = childTreatments.find((t) => t.type === 'atropina');
    const orthokTreatment = childTreatments.find((t) => t.type === 'ortho_k');

    const input: ChildScheduleInput = {
      childId: child.id,
      firstName: child.first_name,
      remindersPaused: pausedChildIds.has(child.id),
    };

    if (atropinaTreatment) {
      input.atropina = {
        treatmentId: atropinaTreatment.id,
        time: effectiveTime(atropinaTreatment, prefs, fallbackTimeFor('atropina')),
      };
    }
    if (orthokTreatment) {
      input.orthok = {
        treatmentId: orthokTreatment.id,
        onTime: effectiveTime(orthokTreatment, prefs, fallbackTimeFor('ortho_k')),
        offTime: ORTHOK_OFF_TIME,
      };
    }
    return input;
  });
}
