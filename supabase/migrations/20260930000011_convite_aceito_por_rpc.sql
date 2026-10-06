-- Convite aceito passa a ser marcado pelo próprio app, depois que o responsável
-- grava a senha. Nem email_confirmed_at (20260930000005) nem encrypted_password
-- (20260930000007) servem de sinal: no GET /auth/v1/verify do convite o GoTrue
-- confirma o e-mail E grava uma senha aleatória temporária, então os dois
-- gatilhos disparavam no clique do link. O convite virava "aceito" sem senha
-- escolhida, e a invite-family respondia 409 em vez de reenviar.
--
-- A tela "Crie sua senha" (e a de nova senha) chama accept_my_invites() depois
-- do updateUser({ password }) bem-sucedido.

drop trigger if exists on_auth_user_password_set_mark_invite on auth.users;
drop trigger if exists on_auth_user_confirmed_mark_invite on auth.users;

create or replace function public.accept_my_invites()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mail text := (select auth.email());
begin
  if uid is null or mail is null then
    return;
  end if;
  update public.family_invites fi
     set accepted_at = now()
   where fi.accepted_at is null
     and lower(fi.email) = lower(mail)
     and fi.family_id in (
       select g.family_id from public.guardians g where g.user_id = uid
     );
end;
$$;

revoke execute on function public.accept_my_invites() from anon, public;
grant execute on function public.accept_my_invites() to authenticated;

-- Convites marcados como aceitos no clique do link, sem senha criada depois,
-- voltam a ficar pendentes. Critério pelo log de auditoria do GoTrue: a conta
-- nasceu pelo link do convite (user_signedup) e nunca gravou senha
-- (user_updated_password) nem entrou com senha (login com provider email).
-- Contas criadas direto no banco (seed) não têm auditoria e ficam como estão.
update public.family_invites fi
   set accepted_at = null
  from auth.users u
 where fi.accepted_at is not null
   and lower(u.email) = lower(fi.email)
   and exists (
     select 1 from auth.audit_log_entries a
      where a.payload->>'actor_id' = u.id::text
        and a.payload->>'action' = 'user_signedup'
   )
   and not exists (
     select 1 from auth.audit_log_entries a
      where a.payload->>'actor_id' = u.id::text
        and (
          a.payload->>'action' = 'user_updated_password'
          or (a.payload->>'action' = 'login'
              and a.payload->'traits'->>'provider' = 'email')
        )
   );
