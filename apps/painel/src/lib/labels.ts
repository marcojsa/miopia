// Rótulos pt-BR para enums do banco. UI em pt-BR; identificadores em inglês.
import type { ClinicalStatus, ContentCategory, StaffRole, TreatmentType } from '@/types/database';

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
  atropina: 'Atropina',
  ortho_k: 'Ortoceratologia (ortho-k)',
  oculos_lentes: 'Óculos / lentes',
  colirio: 'Colírio',
  lente_contato: 'Lente de contato',
};

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  lente: 'Lente de contato',
  colirio: 'Colírio',
  oculos: 'Óculos',
  geral: 'Geral',
};

export function fmtTimesPerDay(times: number): string {
  return `${times}x ao dia`;
}

export const CLINICAL_STATUS_LABELS: Record<ClinicalStatus, string> = {
  controle_adequado: 'Controle adequado',
  atencao: 'Atenção',
  sem_avaliacao: 'Sem avaliação',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  medica: 'Médica',
  secretaria: 'Secretaria',
  admin: 'Administração',
};

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Formata número/dioptria para exibição (1,25). null vira travessão.
export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // iso pode ser 'YYYY-MM-DD' (date) — evita fuso parseando manualmente.
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return iso;
}

// Data de hoje no fuso do navegador (toISOString seria UTC: depois das 21h em
// Brasília já devolveria o dia seguinte).
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Para colunas timestamptz (ex.: created_at): converte para o dia local.
export function fmtTimestampDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
