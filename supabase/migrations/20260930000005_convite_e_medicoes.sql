-- 1. Faixa física da refração (o axial já tinha CHECK de 15 a 35 mm).
--    Barra erro de digitação (30 em vez de -3,00) antes de chegar ao app.
--    Faixa provisória; a definitiva é decisão da Dra.
alter table public.measurements
  add constraint measurements_od_sphere_faixa   check (od_sphere   between -30 and 20),
  add constraint measurements_oe_sphere_faixa   check (oe_sphere   between -30 and 20),
  add constraint measurements_od_cylinder_faixa check (od_cylinder between -10 and 10),
  add constraint measurements_oe_cylinder_faixa check (oe_cylinder between -10 and 10);

-- 2. No máximo um responsável principal por família.
--    Antes do índice, desfaz duplicidades já existentes (o convite marcava
--    "principal" por padrão): fica principal só o mais antigo da família.
with ranked as (
  select user_id, family_id,
         row_number() over (partition by family_id order by created_at, user_id) as rn
    from public.guardians
   where is_primary
)
update public.guardians g
   set is_primary = false
  from ranked r
 where g.user_id = r.user_id
   and g.family_id = r.family_id
   and r.rn > 1;

create unique index if not exists uq_guardian_primary
  on public.guardians (family_id)
  where is_primary;

-- 3. Convite aceito: quando o responsável confirma o e-mail pelo link do
--    convite, o GoTrue preenche email_confirmed_at. O responsável não tem
--    permissão de escrever em family_invites (inv_staff_all), então o registro
--    é feito aqui, com security definer.
create or replace function private.mark_invite_accepted()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.family_invites fi
     set accepted_at = now()
   where fi.accepted_at is null
     and lower(fi.email) = lower(new.email)
     and fi.family_id in (
       select g.family_id from public.guardians g where g.user_id = new.id
     );
  return new;
end;
$$;

revoke execute on function private.mark_invite_accepted() from anon, authenticated, public;

create trigger on_auth_user_confirmed_mark_invite
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.mark_invite_accepted();
