// Tipos de domínio do painel — espelham o schema autoritativo
// (supabase/migrations/20260611000000_initial_schema.sql).
//
// Os tipos do banco ainda NÃO foram gerados (sem Docker nesta máquina, não
// rodamos `supabase gen types`). Estes tipos são escritos à mão e batem,
// coluna a coluna, com a migration.
//
// TODO: trocar por `supabase gen types typescript --local` (packages/shared)
// assim que o Docker estiver disponível, e passar o tipo gerado como genérico
// de createClient<Database>(...).

// ── Enums do banco ───────────────────────────────────────────────────────────
export type StaffRole = 'medica' | 'secretaria' | 'admin';
export type TreatmentType = 'atropina' | 'ortho_k' | 'oculos_lentes';
// ANVISA RDC 657/2022: status clínico é SEMPRE digitado pela médica, nunca
// calculado. É a ÚNICA interpretação clínica do produto.
export type ClinicalStatus = 'controle_adequado' | 'atencao' | 'sem_avaliacao';

// ── Linhas das tabelas (colunas relevantes ao painel) ────────────────────────
export interface Staff {
  user_id: string;
  role: StaffRole;
  display_name: string;
  active: boolean;
  created_at: string;
}

export interface Family {
  id: string;
  label: string;
  created_by: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  family_id: string;
  first_name: string;
  birth_date: string; // ISO date (YYYY-MM-DD)
  avatar_key: string | null;
  chart_ref: string | null; // nº de prontuário — uso interno, NUNCA exibido no app do responsável
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
  starts_on: string; // ISO date
  ends_on: string | null; // ISO date
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Measurement {
  id: string;
  child_id: string;
  measured_on: string; // ISO date
  od_sphere: number | null;
  od_cylinder: number | null;
  oe_sphere: number | null;
  oe_cylinder: number | null;
  // od_se / oe_se são colunas GENERATED no banco — NUNCA enviadas no insert,
  // apenas lidas.
  od_se: number | null;
  oe_se: number | null;
  od_axial_mm: number | null; // CHECK 15..35
  oe_axial_mm: number | null; // CHECK 15..35
  status: ClinicalStatus; // digitado pela médica
  doctor_note: string | null;
  recorded_by: string;
  created_at: string;
}

// ── Payloads de escrita (somente colunas que o painel insere) ────────────────
export interface FamilyInsert {
  label: string;
  created_by?: string | null;
}

export interface ChildInsert {
  family_id: string;
  first_name: string;
  birth_date: string;
  avatar_key?: string | null;
  chart_ref?: string | null;
}

export interface TreatmentInsert {
  child_id: string;
  type: TreatmentType;
  instructions?: string | null;
  suggested_time?: string | null;
  days_of_week?: number[];
  starts_on?: string;
  ends_on?: string | null;
  active?: boolean;
  created_by?: string | null;
}

// EE (od_se/oe_se) é GENERATED — ausente de propósito neste payload.
export interface MeasurementInsert {
  child_id: string;
  measured_on: string;
  od_sphere: number | null;
  od_cylinder: number | null;
  oe_sphere: number | null;
  oe_cylinder: number | null;
  od_axial_mm: number | null;
  oe_axial_mm: number | null;
  status: ClinicalStatus;
  doctor_note: string | null;
  recorded_by: string;
}
