// Tipos de domínio do painel — derivados do schema REAL gerado por
// `npm run db:types` em packages/shared/src/database.types.ts.
// Se a migration mudar uma coluna, estes tipos quebram em compile — é o
// comportamento desejado (antes eram escritos à mão e podiam derivar em silêncio).
import type { Database } from '@miopia/shared';

type Tables = Database['public']['Tables'];

// ── Enums do banco ───────────────────────────────────────────────────────────
export type StaffRole = Database['public']['Enums']['staff_role'];
export type TreatmentType = Database['public']['Enums']['treatment_type'];
// ANVISA RDC 657/2022: status clínico é SEMPRE digitado pela médica, nunca
// calculado. É a ÚNICA interpretação clínica do produto.
export type ClinicalStatus = Database['public']['Enums']['clinical_status'];

// ── Linhas das tabelas ───────────────────────────────────────────────────────
export type Staff = Tables['staff']['Row'];
export type Family = Tables['families']['Row'];
export type Child = Tables['children']['Row'];
export type Treatment = Tables['treatments']['Row'];
// od_se / oe_se são colunas GENERATED no banco — apenas lidas, nunca inseridas.
export type Measurement = Tables['measurements']['Row'];

// ── Payloads de escrita (somente colunas que o painel insere) ────────────────
export type FamilyInsert = Pick<Tables['families']['Insert'], 'label' | 'created_by'>;

export type ChildInsert = Pick<
  Tables['children']['Insert'],
  'family_id' | 'first_name' | 'birth_date' | 'avatar_key' | 'chart_ref'
>;

export type TreatmentInsert = Pick<
  Tables['treatments']['Insert'],
  | 'child_id'
  | 'type'
  | 'instructions'
  | 'suggested_time'
  | 'days_of_week'
  | 'starts_on'
  | 'ends_on'
  | 'active'
  | 'created_by'
>;

// EE (od_se/oe_se) fica FORA do payload de propósito: o gerador do Supabase
// inclui colunas GENERATED no Insert, mas o banco rejeita o insert delas.
// Required<>: o formulário de medição envia cada campo clínico EXPLICITAMENTE
// (inclusive null) — nada de campo clínico esquecido passando como opcional.
export type MeasurementInsert = Required<
  Pick<
    Tables['measurements']['Insert'],
    | 'child_id'
    | 'measured_on'
    | 'od_sphere'
    | 'od_cylinder'
    | 'oe_sphere'
    | 'oe_cylinder'
    | 'od_axial_mm'
    | 'oe_axial_mm'
    | 'status'
    | 'doctor_note'
    | 'recorded_by'
  >
>;
