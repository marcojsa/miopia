// Helpers PUROS da aba Progresso (formatação de data por extenso com ano e de
// valores clínicos em pt-BR). Sem imports de RN — testável isoladamente.
//
// ANVISA RDC 657/2022: estes helpers SÓ FORMATAM o valor já registrado pela
// médica para exibição. NUNCA calculam variação/delta/média/tendência entre
// consultas, nem derivam qualquer juízo clínico (decisão jurídica 12/06/2026).
import type { ClinicalStatus, TreatmentType } from '@/types/domain';

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

/**
 * 'YYYY-MM-DD' -> "14 de maio de 2026" (com ano, sem dia da semana).
 * Parse manual dos componentes locais — NÃO usa new Date('YYYY-MM-DD'),
 * que seria interpretado como UTC e poderia deslocar o dia.
 */
export function longDateWithYearPtBR(ymd: string): string {
  const [yRaw, mRaw, dRaw] = ymd.split('-');
  const year = Number(yRaw);
  const monthIndex = Number(mRaw) - 1;
  const day = Number(dRaw);
  const month = MONTHS_LONG[monthIndex] ?? '';
  return `${day} de ${month} de ${year}`;
}

/**
 * Formata um valor de grau (dioptrias) já registrado em ponto decimal para
 * a notação brasileira com vírgula, 2 casas e sinal explícito: -2.5 -> "-2,50".
 * O sinal "+" só aparece em valores positivos (grau positivo = hipermetropia).
 * Retorna null quando o valor não foi registrado (campo nulo no banco).
 */
export function formatDiopters(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  const fixed = Math.abs(value).toFixed(2).replace('.', ',');
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${fixed} D`;
}

/**
 * Comprimento axial em mm já registrado -> "24,18 mm" (2 casas, sem sinal).
 * Retorna null quando não registrado.
 */
export function formatAxial(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  return `${value.toFixed(2).replace('.', ',')} mm`;
}

/** Placeholder neutro quando a medida não foi registrada naquela consulta. */
export const NOT_RECORDED = '—';

/** Rótulo amigável do regime de tratamento (chip no seletor de filho). */
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
 * Rótulo TEXTUAL neutro do status clínico digitado pela médica.
 * 'sem_avaliacao' retorna null: o bloco de avaliação é OMITIDO nesse caso.
 * NÃO há cor associada — o status é sempre exibido em tinta neutra/roxa.
 */
export function clinicalStatusLabel(status: ClinicalStatus): string | null {
  switch (status) {
    case 'controle_adequado':
      return 'Controle adequado';
    case 'atencao':
      return 'Atenção';
    case 'sem_avaliacao':
    default:
      return null;
  }
}
