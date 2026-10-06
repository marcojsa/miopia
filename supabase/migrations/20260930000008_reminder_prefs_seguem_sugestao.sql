-- Correção de 20260930000004: ao recriar o tratamento, a preferência herdada
-- copiava sempre o horário antigo. Quando esse horário era só a sugestão
-- anterior da médica (o responsável nunca escolheu outro), a mudança feita no
-- painel não chegava ao app. Agora:
--   * horário igual à sugestão anterior  -> passa a seguir a nova sugestão;
--   * horário diferente (personalizado)  -> é mantido.
-- O "enabled" é sempre herdado (lembrete desligado continua desligado).

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
   order by rp.guardian_user_id, prev.created_at desc
  on conflict (guardian_user_id, treatment_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.carry_reminder_prefs() from anon, public;
