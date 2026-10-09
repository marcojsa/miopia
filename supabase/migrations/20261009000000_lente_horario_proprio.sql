-- Lente de contato com horário próprio e limite de horas de uso.
-- Decisão do Marco (09/10/2026): a Dra. passa a regra e pode limitar as horas de
-- uso ("no máximo 8 horas"); o responsável escolhe a hora de colocar e a de tirar.
--
-- 1. treatments.max_wear_hours: limite de horas de uso por dia (só lente de contato).
-- 2. reminder_prefs.remove_time: horário de TIRAR a lente. Na lente, reminder_time
--    passa a ser o horário de COLOCAR. PK, RLS e gatilhos continuam os mesmos.
-- 3. A preferência segue o regime (20261008000001, 5a) levando também o remove_time.
--
-- Regra da casa em plpgsql: nunca usar "old"/"new" como apelido de tabela dentro
-- de função de gatilho (colide com OLD/NEW). Aqui: prev, rp, c, g.

-- ------------------------------------------------------------
-- 1. TREATMENTS: máximo de horas de uso por dia
-- ------------------------------------------------------------
alter table public.treatments
  add column max_wear_hours smallint;

alter table public.treatments
  add constraint treatments_max_wear_hours_faixa
  check (max_wear_hours is null or max_wear_hours between 1 and 24);

alter table public.treatments
  add constraint treatments_max_wear_hours_so_lente
  check (type = 'lente_contato' or max_wear_hours is null);

-- ------------------------------------------------------------
-- 2. REMINDER_PREFS: horário de tirar a lente
-- ------------------------------------------------------------
alter table public.reminder_prefs
  add column remove_time time;

-- ------------------------------------------------------------
-- 3. Preferência de lembrete segue o regime, agora com o remove_time.
--    Igual à versão de 20261008000001 (5a), mais a coluna nova: na troca de
--    regime da lente, a hora de tirar escolhida pela família vai para a lente
--    nova. Se o limite de horas mudou, o app avisa a família na tela de horários.
-- ------------------------------------------------------------
create or replace function private.carry_reminder_prefs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not new.active then
    return new;
  end if;

  insert into public.reminder_prefs
    (guardian_user_id, treatment_id, reminder_time, remove_time, enabled)
  select distinct on (rp.guardian_user_id)
         rp.guardian_user_id,
         new.id,
         case
           when rp.reminder_time = prev.suggested_time and new.suggested_time is not null
             then new.suggested_time
           else rp.reminder_time
         end,
         rp.remove_time,
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
