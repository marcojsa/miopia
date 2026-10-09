-- Preferência de lembrete que chega por tratamento ENCERRADO vai para o ativo que
-- o substituiu (defesa do banco; espelha private.redirect_adherence_to_active).
--
-- Por quê: o app guarda os tratamentos em cache. Logo depois de a clínica trocar o
-- regime (encerra um, cria outro do mesmo tipo), o app ainda pode gravar o horário
-- com o treatment_id antigo: a tela dizia "salvo" e o regime ativo ficava com o
-- horário velho. O app passou a rebuscar os tratamentos antes de gravar; este
-- gatilho cobre o que escapar (app antigo, corrida entre a busca e o salvamento).
--
-- "O ativo que o substituiu": mesma criança e mesmo tipo; no colírio, mesmo nome
-- (sem diferença de maiúsculas e de espaços nas pontas), como nos outros gatilhos.
--
-- Chave primária (guardian_user_id, treatment_id): o BEFORE INSERT roda antes de o
-- Postgres procurar o conflito do ON CONFLICT. O upsert do app, redirecionado,
-- cai no caminho de UPDATE da linha que já existe no regime ativo.
-- No UPDATE direto de uma linha antiga, só redireciona se o responsável ainda não
-- tem preferência no regime ativo (senão a troca de chave bateria na PK).
--
-- Regra da casa em plpgsql: nunca usar "old"/"new" como apelido de tabela dentro
-- de função de gatilho (colide com OLD/NEW). Aqui: prev, cur, dup.

create or replace function private.redirect_reminder_pref_to_active()
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
     and (prev.type <> 'colirio'
          or lower(btrim(coalesce(cur.name, ''))) = lower(btrim(coalesce(prev.name, ''))))
   where prev.id = new.treatment_id
     and not prev.active
   order by cur.created_at desc
   limit 1;

  if current_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and exists (
       select 1 from public.reminder_prefs dup
        where dup.guardian_user_id = new.guardian_user_id
          and dup.treatment_id = current_id
     )
  then
    return new;
  end if;

  new.treatment_id := current_id;
  return new;
end;
$$;

revoke execute on function private.redirect_reminder_pref_to_active() from anon, authenticated, public;

-- Gatilhos BEFORE da mesma tabela rodam em ordem alfabética de nome:
-- reminder_prefs_redirect_to_active < reminder_prefs_set_updated_at.
create trigger reminder_prefs_redirect_to_active
  before insert or update of treatment_id on public.reminder_prefs
  for each row execute function private.redirect_reminder_pref_to_active();
