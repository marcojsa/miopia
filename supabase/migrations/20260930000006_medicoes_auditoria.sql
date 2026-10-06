-- Edição e exclusão de medição passam a deixar rastro.
-- Antes: UPDATE/DELETE direto, sem autoria. Quem reescrevia status e recado
-- sumia, e recorded_by continuava apontando para quem lançou a medição.
--
-- 1. measurements.updated_at / updated_by: última alteração e quem a fez
--    (preenchidos pelo banco; o cliente não escolhe). recorded_by e created_at
--    ficam imutáveis.
-- 2. measurement_history: cópia da linha ANTES de cada edição ou exclusão.
--    Só a equipe lê; ninguém escreve pela API (só o gatilho, security definer).
--
-- Quem pode gravar status e recado (só a médica?) segue em
-- docs/decisoes-pendentes.md; aqui só se garante o rastro.

alter table public.measurements
  add column updated_at timestamptz,
  add column updated_by uuid references public.staff(user_id);

create index if not exists idx_measurements_updated_by
  on public.measurements (updated_by);

create or replace function private.measurements_stamp_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.recorded_by := old.recorded_by;
  new.created_at  := old.created_at;
  new.updated_at  := now();
  new.updated_by  := (select auth.uid());
  return new;
end;
$$;

revoke execute on function private.measurements_stamp_update() from anon, authenticated, public;

create trigger measurements_stamp_update
  before update on public.measurements
  for each row execute function private.measurements_stamp_update();

create table public.measurement_history (
  id             uuid primary key default gen_random_uuid(),
  measurement_id uuid not null,
  child_id       uuid not null references public.children(id) on delete cascade,
  operation      text not null check (operation in ('update', 'delete')),
  old_row        jsonb not null,
  changed_by     uuid,
  changed_at     timestamptz not null default now()
);

create index if not exists idx_measurement_history_measurement
  on public.measurement_history (measurement_id);
create index if not exists idx_measurement_history_child
  on public.measurement_history (child_id);

alter table public.measurement_history enable row level security;

revoke all on public.measurement_history from anon;
revoke insert, update, delete on public.measurement_history from authenticated;
grant select on public.measurement_history to authenticated;
grant all on public.measurement_history to service_role;

create policy meas_hist_staff_read on public.measurement_history for select to authenticated
  using (private.is_staff());

create or replace function private.measurements_log_history()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Exclusão em cascata da criança: não há o que registrar (e o FK falharia).
  if not exists (select 1 from public.children c where c.id = old.child_id) then
    return null;
  end if;

  insert into public.measurement_history (measurement_id, child_id, operation, old_row, changed_by)
  values (old.id, old.child_id, lower(tg_op), to_jsonb(old), (select auth.uid()));
  return null;
end;
$$;

revoke execute on function private.measurements_log_history() from anon, authenticated, public;

create trigger measurements_log_history
  after update or delete on public.measurements
  for each row execute function private.measurements_log_history();
