-- Índices cobrindo chaves estrangeiras sem índice (lint 0001 unindexed_foreign_keys do Supabase, 30/09/2026).
-- Gerado a partir do catálogo do banco local.

create index if not exists adherence_logs_child_id_idx on public.adherence_logs (child_id);
create index if not exists adherence_logs_logged_by_idx on public.adherence_logs (logged_by);
create index if not exists children_family_id_idx on public.children (family_id);
create index if not exists consents_child_id_idx on public.consents (child_id);
create index if not exists consents_term_id_idx on public.consents (term_id);
create index if not exists families_created_by_idx on public.families (created_by);
create index if not exists family_invites_family_id_idx on public.family_invites (family_id);
create index if not exists family_invites_invited_by_idx on public.family_invites (invited_by);
create index if not exists guardians_family_id_idx on public.guardians (family_id);
create index if not exists measurements_recorded_by_idx on public.measurements (recorded_by);
create index if not exists reminder_prefs_treatment_id_idx on public.reminder_prefs (treatment_id);
create index if not exists treatments_created_by_idx on public.treatments (created_by);
