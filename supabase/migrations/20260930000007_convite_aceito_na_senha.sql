-- Convite só conta como aceito quando o responsável grava a senha.
-- Antes o gatilho disparava em email_confirmed_at, que o GoTrue preenche no
-- clique do link (GET /verify), antes da tela "Crie sua senha". Quem fechava o
-- app, abria o link no computador ou tinha o link aberto por antivírus ficava
-- sem senha e com o convite "aceito", e a clínica não conseguia reenviar.
-- private.mark_invite_accepted() (20260930000005) é reaproveitada sem mudança.

drop trigger if exists on_auth_user_confirmed_mark_invite on auth.users;

create trigger on_auth_user_password_set_mark_invite
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password
        and coalesce(new.encrypted_password, '') <> '')
  execute function private.mark_invite_accepted();

-- Convites marcados como aceitos sem que a pessoa tenha criado senha voltam a
-- ficar pendentes, para a clínica poder reenviar.
update public.family_invites fi
   set accepted_at = null
  from auth.users u
 where fi.accepted_at is not null
   and lower(u.email) = lower(fi.email)
   and coalesce(u.encrypted_password, '') = '';
