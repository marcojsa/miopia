-- Ajustes da troca de regime pela clínica (encerrar + criar do mesmo tipo).
--
-- 1. carry_adherence_logs só move check-ins da noite em curso em diante. Com
--    Início retroativo, as noites anteriores eram puxadas para o regime novo,
--    embora registradas sob o antigo. "Hoje" é a data lógica do app: fuso de
--    São Paulo com corte às 04h.
-- 2. Troca feita entre 0h e 4h: a noite em curso ainda é a de ontem. O regime
--    que substitui outro encerrado hoje passa a valer desde a noite em curso;
--    sem isso a Hoje ficava sem cuidado programado e o check-in da noite ficava
--    preso ao tratamento encerrado.
-- 3. Check-in enviado para um tratamento já encerrado (cache antigo no app ou
--    fila offline) vai para o tratamento ativo do mesmo tipo quando ele já vale
--    na data. O upsert do app (on conflict treatment_id,log_date) então não
--    grava uma segunda linha da mesma noite.

create or replace function private.carry_adherence_logs()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  logical_today date := ((now() at time zone 'America/Sao_Paulo') - interval '4 hours')::date;
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
        and l.log_date >= greatest(new.starts_on, logical_today)
        and not exists (
          select 1 from public.adherence_logs dup
           where dup.treatment_id = new.id and dup.log_date = l.log_date
        )
      order by l.log_date, l.created_at desc
   );

  return new;
end;
$$;

create or replace function private.treatment_starts_on_logical_night()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'America/Sao_Paulo';
begin
  if new.active
     and local_now::time < time '04:00'
     and new.starts_on = local_now::date
     and exists (
       select 1 from public.treatments prev
        where prev.child_id = new.child_id
          and prev.type = new.type
          and not prev.active
          and prev.ends_on >= local_now::date
     )
  then
    new.starts_on := new.starts_on - 1;
  end if;
  return new;
end;
$$;

revoke execute on function private.treatment_starts_on_logical_night() from anon, authenticated, public;

create trigger treatments_starts_on_logical_night
  before insert on public.treatments
  for each row execute function private.treatment_starts_on_logical_night();

create or replace function private.redirect_adherence_to_active()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  current_id uuid;
begin
  select cur.id into current_id
    from public.treatments prev
    join public.treatments cur
      on cur.child_id = prev.child_id
     and cur.type = prev.type
     and cur.active
     and cur.id <> prev.id
   where prev.id = new.treatment_id
     and prev.child_id = new.child_id
     and not prev.active
     and cur.starts_on <= new.log_date;

  if current_id is not null then
    new.treatment_id := current_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.redirect_adherence_to_active() from anon, authenticated, public;

create trigger adherence_logs_redirect_to_active
  before insert on public.adherence_logs
  for each row execute function private.redirect_adherence_to_active();
