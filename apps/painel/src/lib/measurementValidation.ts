// Validação de faixa/formato dos campos clínicos da NovaMedição.
//
// ATENÇÃO ANVISA RDC 657/2022: estas funções validam apenas FORMATO e FAIXA
// física dos números digitados (passo dioptrico 0,25; esfera -30..+20 D,
// cilindro -10..+10 D e axial 15..35 mm, os mesmos limites dos CHECKs do banco). NÃO interpretam o dado, NÃO
// classificam risco, NÃO calculam médias/percentis/tendências. A única
// interpretação clínica do produto é o campo `status`, digitado pela médica.

export const AXIAL_MIN = 15;
export const AXIAL_MAX = 35;
export const DIOPTER_STEP = 0.25;
// Faixa física provisória (mesmo CHECK do banco); a definitiva é da Dra.
export const SPHERE_MIN = -30;
export const SPHERE_MAX = 20;
export const CYLINDER_MIN = -10;
export const CYLINDER_MAX = 10;

function fmtLimit(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Aceita campo vazio (null) — refração e axial são opcionais no schema.
// Quando preenchido, parseia "1,25"/"1.25" e valida.

export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

/** Múltiplo de 0,25 (com tolerância para erro de ponto flutuante). */
export function isDiopterStep(value: number): boolean {
  const ratio = value / DIOPTER_STEP;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

export interface EyeValues {
  sphere: string;
  cylinder: string;
  axial: string;
}

export interface EyeParsed {
  sphere: number | null;
  cylinder: number | null;
  axial: number | null;
}

// Valida um olho e devolve os valores parseados ou a lista de erros (pt-BR).
export function validateEye(label: string, values: EyeValues): {
  parsed: EyeParsed;
  errors: string[];
} {
  const errors: string[] = [];

  const sphere = parseOptionalNumber(values.sphere);
  const cylinder = parseOptionalNumber(values.cylinder);
  const axial = parseOptionalNumber(values.axial);

  if (Number.isNaN(sphere)) errors.push(`${label}: esfera não é um número válido.`);
  else if (sphere !== null && !isDiopterStep(sphere))
    errors.push(`${label}: esfera deve ser múltiplo de 0,25.`);
  else if (sphere !== null && (sphere < SPHERE_MIN || sphere > SPHERE_MAX))
    errors.push(
      `${label}: esfera deve estar entre ${fmtLimit(SPHERE_MIN)} e +${fmtLimit(SPHERE_MAX)} D.`,
    );

  if (Number.isNaN(cylinder)) errors.push(`${label}: cilindro não é um número válido.`);
  else if (cylinder !== null && !isDiopterStep(cylinder))
    errors.push(`${label}: cilindro deve ser múltiplo de 0,25.`);
  else if (cylinder !== null && (cylinder < CYLINDER_MIN || cylinder > CYLINDER_MAX))
    errors.push(
      `${label}: cilindro deve estar entre ${fmtLimit(CYLINDER_MIN)} e +${fmtLimit(CYLINDER_MAX)} D.`,
    );

  if (Number.isNaN(axial)) errors.push(`${label}: comprimento axial não é um número válido.`);
  else if (axial !== null && (axial < AXIAL_MIN || axial > AXIAL_MAX))
    errors.push(`${label}: comprimento axial deve estar entre ${AXIAL_MIN} e ${AXIAL_MAX} mm.`);

  return {
    parsed: {
      sphere: Number.isNaN(sphere) ? null : sphere,
      cylinder: Number.isNaN(cylinder) ? null : cylinder,
      axial: Number.isNaN(axial) ? null : axial,
    },
    errors,
  };
}
