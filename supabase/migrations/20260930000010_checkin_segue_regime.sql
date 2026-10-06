-- Troca de horário/regime no mesmo dia do check-in.
-- O painel encerra o tratamento e cria outro do mesmo tipo (id novo). O check-in
-- da noite ficava preso ao tratamento encerrado, e o app voltava a pedir a mesma
-- noite (permitindo um segundo registro dela). Ao criar um tratamento ativo, os
-- check-ins da mesma criança e do mesmo tipo com data dentro da vigência do novo
-- (log_date >= starts_on) passam para ele. Noites anteriores não mudam.

create or replace function private.carry_adherence_logs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not new.active then
    return new;
  end if;

  update public.adherence_logs al
     set treatment_id = new.id
   where al.id in (
     select distinct on (l.log_date) l.id
       from public.adherence_logs l
       join public.treatments prev on prev.id = l.treatment_id
      where prev.child_id = new.child_id
        and prev.type = new.type
        and prev.id <> new.id
        and l.log_date >= new.starts_on
        and not exists (
          select 1 from public.adherence_logs dup
           where dup.treatment_id = new.id and dup.log_date = l.log_date
        )
      order by l.log_date, l.created_at desc
   );

  return new;
end;
$$;

revoke execute on function private.carry_adherence_logs() from anon, authenticated, public;

create trigger treatments_carry_adherence_logs
  after insert on public.treatments
  for each row execute function private.carry_adherence_logs();
