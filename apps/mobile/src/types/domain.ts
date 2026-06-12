// Tipos de domínio do app — espelham o schema Supabase
// (supabase/migrations/20260611000000_initial_schema.sql).
// Quando `supabase gen types typescript` rodar (Fase 1), estes tipos passam a ser
// validados contra packages/shared/src/database.types.ts.

// ── Enums do banco ───────────────────────────────────────────────────────────
export type TreatmentType = 'atropina' | 'ortho_k' | 'oculos_lentes';
export type AdherenceStatus = 'feito' | 'pulado';
// ANVISA RDC 657/2022: status clínico é SEMPRE digitado pela médica, nunca calculado.
export type ClinicalStatus = 'controle_adequado' | 'atencao' | 'sem_avaliacao';

// Tipo de lembrete LOCAL (não existe no banco): ortho_k gera DOIS lembretes
// (colocar à noite, retirar de manhã) do MESMO tratamento.
export type ReminderType = 'atropina' | 'orthok_on' | 'orthok_off';

// ── Linhas das tabelas (somente colunas que o app lê/escreve) ────────────────
export interface Child {
  id: string;
  family_id: string;
  first_name: string;
  birth_date: string; // ISO date
  avatar_key: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Treatment {
  id: string;
  child_id: string;
  type: TreatmentType;
  instructions: string | null;
  suggested_time: string | null; // 'HH:MM:SS'
  days_of_week: number[]; // 0 = domingo
  starts_on: string;
  ends_on: string | null;
  active: boolean;
}

export interface ReminderPref {
  guardian_user_id: string;
  treatment_id: string;
  reminder_time: string; // 'HH:MM:SS' — preferência do responsável (separada da prescrição)
  enabled: boolean;
}

export interface AdherenceLog {
  id: string;
  treatment_id: string;
  child_id: string;
  log_date: string; // data lógica da "noite" (corte 04h — ver lib/date.ts)
  status: AdherenceStatus;
  note: string | null;
  logged_by: string | null;
  created_at: string;
}

export interface Measurement {
  id: string;
  child_id: string;
  measured_on: string;
  od_sphere: number | null;
  od_cylinder: number | null;
  oe_sphere: number | null;
  oe_cylinder: number | null;
  od_se: number | null; // equivalente esférico — coluna GENERATED no banco
  oe_se: number | null;
  od_axial_mm: number | null;
  oe_axial_mm: number | null;
  status: ClinicalStatus; // digitado pela médica — o app só EXIBE
  doctor_note: string | null;
  created_at: string;
}

// ── Outbox (local; client_id NÃO existe no banco — só deduplicação local) ────
export interface PendingCheckin {
  client_id: string; // id local p/ deduplicação no outbox antes do flush
  treatment_id: string;
  child_id: string;
  log_date: string;
  status: AdherenceStatus;
  note: string | null;
  logged_by: string | null;
}

// ── Entrada do scheduler de lembretes (derivada de Treatment + ReminderPref) ─
export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface ChildScheduleInput {
  childId: string;
  firstName: string;
  remindersPaused: boolean; // férias/doença — cancela todos os lembretes do filho
  atropina?: { treatmentId: string; time: ReminderTime };
  orthok?: { treatmentId: string; onTime: ReminderTime; offTime: ReminderTime };
}
