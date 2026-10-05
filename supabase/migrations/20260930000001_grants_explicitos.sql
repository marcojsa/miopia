-- Privilégios explícitos para os roles da Data API.
-- Projetos novos na nuvem nascem com auto_expose_new_tables = false: sem GRANT,
-- authenticated e service_role recebem 42501 antes mesmo de chegar na RLS.
-- anon continua sem nada (revoke da migration inicial); a RLS segue valendo.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

revoke all on all tables in schema public from anon;
