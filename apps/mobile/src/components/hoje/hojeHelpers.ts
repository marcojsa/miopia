// Helpers PUROS da aba Hoje (saudação por hora, data por extenso pt-BR, rótulos
// e horário das tarefas). Sem dado clínico aqui — apenas relato de adesão e
// rotina (ANVISA RDC 657/2022). Testável isoladamente (sem imports de RN).
import type { Treatment, TreatmentType } from '@/types/domain';

import { NIGHT_CUTOFF_HOUR, weekdayOfYMD } from '../../lib/date.ts';
import { colirioName, dosesPerDay, sameColirio } from '../../lib/doseSchedule.ts';

const WEEKDAYS_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** Saudação pela hora local: madrugada/manhã/tarde/noite. */
export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Data por extenso em pt-BR: "quinta-feira, 11 de junho". */
export function longDatePtBR(d: Date): string {
  const weekday = WEEKDAYS_LONG[d.getDay()];
  const day = d.getDate();
  const month = MONTHS_LONG[d.getMonth()];
  return `${weekday}, ${day} de ${month}`;
}

/** 'HH:MM:SS' (ou 'HH:MM') -> '20h30' / '21h' (estilo dos mockups). */
export function formatTimePtBR(time: string | null): string | null {
  if (!time) return null;
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw ?? '0');
  if (Number.isNaN(h)) return null;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Título do card de tarefa por tipo de tratamento + nome do filho. Colírio leva o
 * nome cadastrado pela clínica ("Lubrificante de Alice"); a lente de contato de 1
 * vez por dia é registrada na hora de tirar ("Tirou a lente de Pedro?").
 */
export function taskTitle(
  type: TreatmentType,
  firstName: string,
  name: string | null = null,
  timesPerDay = 1
): string {
  switch (type) {
    case 'atropina':
      return `Hora do colírio de ${firstName}`;
    case 'ortho_k':
      return `Hora da lente de ${firstName}`;
    case 'colirio':
      return `${colirioName(name)} de ${firstName}`;
    case 'lente_contato':
      return timesPerDay > 1 ? `Lente de contato de ${firstName}` : `Tirou a lente de ${firstName}?`;
    case 'oculos_lentes':
    default:
      return `Cuidado de ${firstName}`;
  }
}

/**
 * Instrução curta exibida no card. Prioriza a instrução prescrita
 * (treatment.instructions); se vazia, usa um texto padrão por tipo.
 */
export function taskInstruction(treatment: Treatment): string {
  if (treatment.instructions && treatment.instructions.trim().length > 0) {
    return treatment.instructions.trim();
  }
  switch (treatment.type) {
    case 'atropina':
      return 'Atropina, 1 gota em cada olho antes de dormir';
    case 'ortho_k':
      return 'Colocar a lente de ortho-k antes de dormir';
    case 'colirio':
      return 'Pingar conforme a orientação da médica';
    case 'lente_contato':
      return 'Colocar e tirar nos horários combinados';
    case 'oculos_lentes':
    default:
      return 'Cuidado da noite antes de dormir';
  }
}

/**
 * Chave de ordenação do horário de uma dose no dia lógico: o que cai de
 * madrugada (antes das 04h) vai para o fim. Sem horário, por último.
 */
export function doseSortKey(time: { hour: number; minute: number } | null): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const minutes = time.hour * 60 + time.minute;
  return time.hour < NIGHT_CUTOFF_HOUR ? minutes + 24 * 60 : minutes;
}

/** Mesmo tratamento para a troca de regime: mesmo tipo e, no colírio, mesmo nome. */
function sameRegime(a: Treatment, b: Treatment): boolean {
  return a.type === b.type && (a.type !== 'colirio' || sameColirio(a.name, b.name));
}

/** Grupo de troca de regime: um por tipo e, no colírio, um por nome. */
function regimeKey(t: Treatment): string {
  return t.type === 'colirio' ? `colirio:${(t.name ?? '').trim().toLowerCase()}` : t.type;
}

/**
 * O tratamento está agendado para a data lógica de hoje?
 * Respeita janela [starts_on, ends_on] e days_of_week (0=domingo..6=sábado).
 * `todayYMD` é a data lógica (corte 04h) e `weekday` o getDay() dessa mesma data lógica (use weekdayOfYMD).
 */
export function isScheduledToday(
  treatment: Treatment,
  todayYMD: string,
  weekday: number
): boolean {
  if (treatment.starts_on > todayYMD) return false;
  if (treatment.ends_on && treatment.ends_on < todayYMD) return false;
  if (treatment.days_of_week.length > 0 && !treatment.days_of_week.includes(weekday)) {
    return false;
  }
  return true;
}

/** O tratamento tinha cuidado programado na noite da data lógica `ymd`? */
export function isScheduledOn(treatment: Treatment, ymd: string): boolean {
  return isScheduledToday(treatment, ymd, weekdayOfYMD(ymd));
}

/**
 * O tratamento (ativo ou encerrado) tinha cuidado devido na noite `ymd`, para o
 * histórico do céu e dos escudos? O encerrado vale até a véspera do ends_on: o
 * "Encerrar" grava o dia do encerramento e a Hoje deixa de mostrá-lo na hora.
 */
export function wasScheduledOn(treatment: Treatment, ymd: string): boolean {
  if (!treatment.active && treatment.ends_on !== null && treatment.ends_on <= ymd) return false;
  return isScheduledOn(treatment, ymd);
}

/**
 * Doses devidas no dia `ymd`: soma das vezes por dia de cada tratamento devido,
 * um por tipo (no colírio, um por nome). Na noite da troca de regime o encerrado
 * e o novo do mesmo grupo não contam em dobro — vale o de início mais recente.
 */
export function dueCareCount(treatments: Treatment[], ymd: string): number {
  const byRegime = new Map<string, Treatment>();
  for (const t of treatments) {
    if (!wasScheduledOn(t, ymd)) continue;
    const key = regimeKey(t);
    const prev = byRegime.get(key);
    if (!prev || t.starts_on > prev.starts_on) byRegime.set(key, t);
  }
  let total = 0;
  for (const t of byRegime.values()) total += dosesPerDay(t);
  return total;
}

/**
 * O tratamento ativo vale na noite em curso `todayYMD` (data lógica)? Além da
 * janela normal, cobre a troca feita de madrugada: o regime que começa hoje no
 * calendário (`calendarYMD`) e substitui outro do mesmo tipo encerrado hoje
 * vale já na noite de ontem, que segue em curso até as 04h. Mesma regra de
 * private.carry_adherence_logs e private.redirect_adherence_to_active no banco.
 */
export function isScheduledTonight(
  treatment: Treatment,
  history: Treatment[],
  todayYMD: string,
  calendarYMD: string
): boolean {
  if (isScheduledOn(treatment, todayYMD)) return true;
  if (!treatment.active || treatment.starts_on <= todayYMD || treatment.starts_on > calendarYMD) {
    return false;
  }
  const replaces = history.some(
    (prev) =>
      prev.id !== treatment.id &&
      !prev.active &&
      prev.child_id === treatment.child_id &&
      sameRegime(prev, treatment) &&
      prev.ends_on !== null &&
      prev.ends_on >= calendarYMD
  );
  return replaces && isScheduledOn({ ...treatment, starts_on: todayYMD }, todayYMD);
}
