-- O Início do tratamento é o que a médica digitou.
--
-- O gatilho treatments_starts_on_logical_night recuava starts_on para ontem na
-- troca de regime feita entre 0h e 4h. O dado clínico ficava diferente do campo
-- e, se o regime anterior tinha começado na mesma madrugada, o novo começava
-- antes dele. Sai o gatilho; a noite em curso passa a ser resolvida sem mexer
-- no dado gravado:
--
-- Regra (a mesma de isScheduledTonight no app): o regime que começa hoje no
-- calendário e substitui outro do mesmo tipo encerrado hoje cobre também a
-- noite em curso, que até as 04h ainda é a de ontem.
-- 1. carry_adherence_logs move o check-in dessa noite para o regime novo.
-- 2. redirect_adherence_to_active manda para ele o check-in dessa noite que
--    chegar pelo tratamento encerrado (cache antigo ou fila offline).

drop trigger if exists treatments_starts_on_logical_night on public.treatments;
drop function if exists private.treatment_starts_on_logical_night();

create or replace function private.carry_adherence_logs()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'America/Sao_Paulo';
  logical_today date := (local_now - interval '4 hours')::date;
  covers_from date := new.starts_on;
begin
  if not new.active then
    return new;
  end if;

  if new.starts_on > logical_today
     and new.starts_on <= local_now::date
     and exists (
       select 1 from public.treatments prev
        where prev.child_id = new.child_id
          and prev.type = new.type
          and prev.id <> new.id
          and not prev.active
          and prev.ends_on >= local_now::date
     )
  then
    covers_from := logical_today;
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
        and l.log_date >= greatest(covers_from, logical_today)
        and not exists (
          select 1 from public.adherence_logs dup
           where dup.treatment_id = new.id and dup.log_date = l.log_date
        )
      order by l.log_date, l.created_at desc
   );

  return new;
end;
$$;

create or replace function private.redirect_adherence_to_active()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'America/Sao_Paulo';
  logical_today date := (local_now - interval '4 hours')::date;
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
     and (
       cur.starts_on <= new.log_date
       or (
         new.log_date = logical_today
         and cur.starts_on <= local_now::date
         and prev.ends_on >= local_now::date
       )
     );

  if current_id is not null then
    new.treatment_id := current_id;
  end if;
  return new;
end;
$$;
