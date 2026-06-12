// Tipos de domínio do app — derivados do schema REAL gerado por
// `npm run db:types` em packages/shared/src/database.types.ts.
// As visões são ESTREITAS de propósito (Pick): o app só conhece as colunas
// que lê/escreve. Se a migration mudar uma coluna usada aqui, quebra em compile.
import type { Database } from '@miopia/shared';

type Tables = Database['public']['Tables'];

// ── Enums do banco ───────────────────────────────────────────────────────────
export type TreatmentType = Database['public']['Enums']['treatment_type'];
export type AdherenceStatus = Database['public']['Enums']['adherence_status'];
// ANVISA RDC 657/2022: status clínico é SEMPRE digitado pela médica, nunca calculado.
export type ClinicalStatus = Database['public']['Enums']['clinical_status'];

// Tipo de lembrete LOCAL (não existe no banco): ortho_k gera DOIS lembretes
// (colocar à noite, retirar de manhã) do MESMO tratamento.
export type ReminderType = 'atropina' | 'orthok_on' | 'orthok_off';

// ── Linhas das tabelas (somente colunas que o app lê/escreve) ────────────────
// Sem chart_ref: nº de prontuário é uso interno da clínica, NUNCA chega ao app.
export type Child = Pick<
  Tables['children']['Row'],
  'id' | 'family_id' | 'first_name' | 'birth_date' | 'avatar_key' | 'archived_at' | 'created_at'
>;

export type Treatment = Pick<
  Tables['treatments']['Row'],
  'id' | 'child_id' | 'type' | 'instructions' | 'suggested_time' | 'days_of_week' | 'starts_on' | 'ends_on' | 'active'
>;

// reminder_time: 'HH:MM:SS' — preferência do responsável (separada da prescrição)
export type ReminderPref = Pick<
  Tables['reminder_prefs']['Row'],
  'guardian_user_id' | 'treatment_id' | 'reminder_time' | 'enabled'
>;

// log_date: data lógica da "noite" (corte 04h — ver lib/date.ts)
export type AdherenceLog = Pick<
  Tables['adherence_logs']['Row'],
  'id' | 'treatment_id' | 'child_id' | 'log_date' | 'status' | 'note' | 'logged_by' | 'created_at'
>;

// od_se/oe_se: equivalente esférico — colunas GENERATED, o app só EXIBE.
// status: digitado pela médica — o app só EXIBE (sem recorded_by: irrelevante aqui).
export type Measurement = Pick<
  Tables['measurements']['Row'],
  | 'id'
  | 'child_id'
  | 'measured_on'
  | 'od_sphere'
  | 'od_cylinder'
  | 'oe_sphere'
  | 'oe_cylinder'
  | 'od_se'
  | 'oe_se'
  | 'od_axial_mm'
  | 'oe_axial_mm'
  | 'status'
  | 'doctor_note'
  | 'created_at'
>;

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
