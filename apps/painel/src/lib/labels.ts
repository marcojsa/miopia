// Rótulos pt-BR para enums do banco. UI em pt-BR; identificadores em inglês.
import type { ClinicalStatus, StaffRole, TreatmentType } from '@/types/database';

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
  atropina: 'Atropina',
  ortho_k: 'Ortoceratologia (ortho-k)',
  oculos_lentes: 'Óculos / lentes',
};

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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
