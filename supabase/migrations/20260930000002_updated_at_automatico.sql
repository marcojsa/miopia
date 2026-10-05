-- updated_at passa a refletir a última alteração da linha, sem depender do
-- cliente enviar o campo (antes só havia default now() na criação).

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from anon, public;

create trigger reminder_prefs_set_updated_at
  before update on public.reminder_prefs
  for each row execute function private.set_updated_at();

create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function private.set_updated_at();
