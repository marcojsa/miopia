-- Lumi para qualquer criança (docs/especificacao-lumi-geral.md, Banco, itens 2 a 6).
-- Os valores 'colirio' e 'lente_contato' do enum nascem na migration anterior
-- (20261008000000_tipos_colirio_e_lente.sql).
--
-- 1. treatments: nome do colírio/produto e vezes por dia (1 a 6).
-- 2. "Um ativo por tipo por criança" deixa de valer para colírio.
-- 3. adherence_logs: dose do dia; a chave única passa a incluir a dose.
-- 4. child_routines: a que horas a criança acorda e dorme (escrita do responsável).
-- 5. Gatilhos de troca de regime passam a considerar dose e, no colírio, o nome.
-- 6. Dose não pode passar do times_per_day do tratamento.
--
-- Regra da casa em plpgsql: nunca usar "old"/"new" como apelido de tabela dentro
-- de função de gatilho (colide com OLD/NEW). Aqui: prev, cur, t, l, al, dup.

-- ------------------------------------------------------------
-- 1. TREATMENTS: nome e vezes por dia
-- ------------------------------------------------------------
alter table public.treatments
  add column name text,
  add column times_per_day smallint not null default 1;

alter table public.treatments
  add constraint treatments_times_per_day_faixa
  check (times_per_day between 1 and 6);

-- Atropina, ortho-k e óculos continuam em 1 vez por dia (especificação, item 2).
alter table public.treatments
  add constraint treatments_times_per_day_so_colirio_e_lente
  check (type not in ('atropina', 'ortho_k', 'oculos_lentes') or times_per_day = 1);

-- ------------------------------------------------------------
-- 2. Um ativo por tipo por criança, MENOS para colírio
-- ------------------------------------------------------------
drop index if exists public.uq_treatment_active;

create unique index uq_treatment_active
  on public.treatments (child_id, type)
  where active and type <> 'colirio';

-- Colírio: a criança pode ter dois ativos, desde que sejam colírios diferentes.
-- O nome (sem diferença de maiúsculas e de espaços nas pontas) é o que identifica
-- "o mesmo colírio" na troca de regime; dois ativos com o mesmo nome deixariam o
-- redirecionamento do check-in sem saber para qual ir.
create unique index uq_treatment_active_colirio
  on public.treatments (child_id, lower(btrim(coalesce(name, ''))))
  where active and type = 'colirio';

-- ------------------------------------------------------------
-- 3. ADHERENCE_LOGS: dose do dia
-- ------------------------------------------------------------
alter table public.adherence_logs
  add column dose smallint not null default 1;

alter table public.adherence_logs
  add constraint adherence_logs_dose_faixa
  check (dose between 1 and 6);

-- Idempotência passa a ser por dose: pai e mãe não duplicam a MESMA dose.
alter table public.adherence_logs
  drop constraint if exists adherence_logs_treatment_id_log_date_key;

alter table public.adherence_logs
  add constraint adherence_logs_treatment_id_log_date_dose_key
  unique (treatment_id, log_date, dose);

-- ------------------------------------------------------------
-- 4. CHILD_ROUTINES: rotina da criança (responsável escreve)
--    Preferência pessoal, como reminder_prefs: cada responsável tem a sua e a
--    equipe da clínica não lê.
-- ------------------------------------------------------------
create table public.child_routines (
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  child_id         uuid not null references public.children(id) on delete cascade,
  wake_time        time not null default '07:00',
  bed_time         time not null default '21:00',
  updated_at       timestamptz not null default now(),
  primary key (guardian_user_id, child_id),
  constraint child_routines_dorme_depois_de_acordar check (bed_time > wake_time)
);

create index if not exists child_routines_child_id_idx
  on public.child_routines (child_id);

alter table public.child_routines enable row level security;

revoke all on public.child_routines from anon;
grant select, insert, update, delete on public.child_routines to authenticated;
grant all on public.child_routines to service_role;

create policy cr_owner_all on public.child_routines for all to authenticated
  using (guardian_user_id = (select auth.uid()))
  with check (guardian_user_id = (select auth.uid())
              and private.can_see_child(child_id));

create trigger child_routines_set_updated_at
  before update on public.child_routines
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------
-- 5a. Preferência de lembrete segue o regime (20260930000008), agora sabendo
--     que dois colírios diferentes coexistem: no colírio, "o regime anterior"
--     é o do mesmo nome.
-- ------------------------------------------------------------
create or replace function private.carry_reminder_prefs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not new.active then
    return new;
  end if;

  insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time, enabled)
  select distinct on (rp.guardian_user_id)
         rp.guardian_user_id,
         new.id,
         case
           when rp.reminder_time = prev.suggested_time and new.suggested_time is not null
             then new.suggested_time
           else rp.reminder_time
         end,
         rp.enabled
    from public.reminder_prefs rp
    -- (alias "prev", não "old": em plpgsql "old" é a variável OLD do gatilho)
    join public.treatments prev on prev.id = rp.treatment_id
    join public.children c on c.id = new.child_id
    join public.guardians g on g.user_id = rp.guardian_user_id and g.family_id = c.family_id
   where prev.child_id = new.child_id
     and prev.type = new.type
     and prev.id <> new.id
     and (new.type <> 'colirio'
          or lower(btrim(coalesce(prev.name, ''))) = lower(btrim(coalesce(new.name, ''))))
   order by rp.guardian_user_id, prev.created_at desc
  on conflict (guardian_user_id, treatment_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.carry_reminder_prefs() from anon, public;

-- ------------------------------------------------------------
-- 5b. Check-ins seguem o regime (20260930000013), por (data, dose).
--     * no colírio, só os do mesmo nome;
--     * regime novo com MENOS doses: as doses acima do novo times_per_day ficam
--       no regime encerrado (foram dadas sob ele; no novo não existem).
-- ------------------------------------------------------------
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
          and (new.type <> 'colirio'
               or lower(btrim(coalesce(prev.name, ''))) = lower(btrim(coalesce(new.name, ''))))
          and not prev.active
          and prev.ends_on >= local_now::date
     )
  then
    covers_from := logical_today;
  end if;

  update public.adherence_logs al
     set treatment_id = new.id
   where al.id in (
     select distinct on (l.log_date, l.dose) l.id
       from public.adherence_logs l
       join public.treatments prev on prev.id = l.treatment_id
      where prev.child_id = new.child_id
        and prev.type = new.type
        and prev.id <> new.id
        and (new.type <> 'colirio'
             or lower(btrim(coalesce(prev.name, ''))) = lower(btrim(coalesce(new.name, ''))))
        and l.log_date >= greatest(covers_from, logical_today)
        and l.dose <= new.times_per_day
        and not exists (
          select 1 from public.adherence_logs dup
           where dup.treatment_id = new.id
             and dup.log_date = l.log_date
             and dup.dose = l.dose
        )
      order by l.log_date, l.dose, l.created_at desc
   );

  return new;
end;
$$;

revoke execute on function private.carry_adherence_logs() from anon, authenticated, public;

-- ------------------------------------------------------------
-- 5c. Check-in que chega por tratamento encerrado vai para o ativo que o
--     substituiu (20260930000013). No colírio, o ativo do mesmo nome. A dose
--     vai junto: o upsert do app (on conflict treatment_id,log_date,dose) cai
--     na linha certa do regime novo e não duplica.
-- ------------------------------------------------------------
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
     and (prev.type <> 'colirio'
          or lower(btrim(coalesce(cur.name, ''))) = lower(btrim(coalesce(prev.name, ''))))
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
     )
   order by cur.created_at desc
   limit 1;

  if current_id is not null then
    new.treatment_id := current_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.redirect_adherence_to_active() from anon, authenticated, public;

-- ------------------------------------------------------------
-- 6. Dose não passa do times_per_day do tratamento.
--    Gatilho, não policy: vale para qualquer papel e enxerga a linha DEPOIS do
--    redirecionamento. Gatilhos BEFORE da mesma tabela rodam em ordem alfabética
--    de nome: adherence_logs_redirect_to_active < adherence_logs_validate_dose.
--    Só dispara quando dose ou tratamento mudam; corrigir a resposta (status,
--    note) de uma dose antiga continua livre, mesmo se a clínica reduziu as
--    doses do tratamento depois.
-- ------------------------------------------------------------
create or replace function private.validate_adherence_dose()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  max_dose smallint;
begin
  -- Upsert reenvia todas as colunas: sem mudança real de dose/tratamento, passa.
  if tg_op = 'UPDATE'
     and new.dose = old.dose
     and new.treatment_id = old.treatment_id then
    return new;
  end if;

  select t.times_per_day into max_dose
    from public.treatments t
   where t.id = new.treatment_id;

  if max_dose is not null and new.dose > max_dose then
    raise exception 'dose % acima das % vez(es) por dia do tratamento', new.dose, max_dose
      using errcode = '23514', constraint = 'adherence_logs_dose_dentro_do_tratamento';
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_adherence_dose() from anon, authenticated, public;

create trigger adherence_logs_validate_dose
  before insert or update of treatment_id, dose on public.adherence_logs
  for each row execute function private.validate_adherence_dose();
