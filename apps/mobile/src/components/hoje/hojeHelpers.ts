// Helpers PUROS da aba Hoje (saudação por hora, data por extenso pt-BR, rótulos
// e horário das tarefas). Sem dado clínico aqui — apenas relato de adesão e
// rotina (ANVISA RDC 657/2022). Testável isoladamente (sem imports de RN).
import type { Treatment, TreatmentType } from '@/types/domain';

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

/** Título do card de tarefa por tipo de tratamento + nome do filho. */
export function taskTitle(type: TreatmentType, firstName: string): string {
  switch (type) {
    case 'atropina':
      return `Hora do colírio da ${firstName}`;
    case 'ortho_k':
      return `Hora da lente da ${firstName}`;
    case 'oculos_lentes':
    default:
      return `Cuidado da ${firstName}`;
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
    case 'oculos_lentes':
    default:
      return 'Cuidado da noite antes de dormir';
  }
}

/**
 * O tratamento está agendado para a data lógica de hoje?
 * Respeita janela [starts_on, ends_on] e days_of_week (0=domingo..6=sábado).
 * `todayYMD` é a data lógica (corte 04h) e `weekday` o getDay() do dia exibido.
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
