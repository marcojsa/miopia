-- O painel troca horário/regime encerrando o tratamento e criando outro do mesmo
-- tipo. reminder_prefs aponta para o treatment_id antigo, então o horário que o
-- responsável escolheu sumia sem aviso e o lembrete mudava de hora sozinho.
-- Ao criar um tratamento ativo, cada responsável da família herda a preferência
-- que tinha no tratamento mais recente do mesmo tipo para a mesma criança.

create or replace function private.carry_reminder_prefs()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not new.active then
    return new;
  end if;

  insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time, enabled)
  select distinct on (rp.guardian_user_id)
         rp.guardian_user_id, new.id, rp.reminder_time, rp.enabled
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

create trigger treatments_carry_reminder_prefs
  after insert on public.treatments
  for each row execute function private.carry_reminder_prefs();
