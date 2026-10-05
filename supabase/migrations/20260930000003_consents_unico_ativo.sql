-- Unicidade do consentimento só entre aceites ATIVOS. A constraint antiga
-- (user_id, term_id, child_id) incluía linhas revogadas e impedia um novo aceite
-- depois da revogação (23505). A linha revogada fica como trilha de prova (LGPD).

alter table public.consents
  drop constraint if exists consents_user_id_term_id_child_id_key;

create unique index if not exists uq_consent_active
  on public.consents (user_id, term_id, child_id)
  where revoked_at is null;

-- A constraint removida também indexava a FK user_id.
create index if not exists consents_user_id_idx on public.consents (user_id);
