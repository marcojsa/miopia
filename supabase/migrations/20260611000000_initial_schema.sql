-- ============================================================
-- App de adesão — controle de miopia infantil
-- Oftalmologia Alto de Pinheiros · Supabase Postgres
-- Regras de ouro:
--  * RLS habilitado em TODAS as tabelas; nenhuma policy p/ anon.
--  * Status clínico é SEMPRE digitado pela médica (ANVISA RDC 657/2022).
--  * Sem CPF, endereço ou foto de criança (minimização LGPD).
-- ============================================================

-- Schema privado: helpers de RLS, fora do PostgREST
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- ENUMS ----------
create type public.staff_role      as enum ('medica', 'secretaria', 'admin');
create type public.treatment_type  as enum ('atropina', 'ortho_k', 'oculos_lentes');
-- ANVISA: interpretação clínica = campo preenchido por humano, nunca calculado
create type public.clinical_status as enum ('controle_adequado', 'atencao', 'sem_avaliacao');
-- 'pulado' consciente (doença/férias) é dado valioso e alimenta o streak que perdoa
create type public.adherence_status as enum ('feito', 'pulado');

-- ---------- STAFF DA CLÍNICA ----------
-- Linhas criadas manualmente (SQL editor) ou por admin; nunca pelo app.
create table public.staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         public.staff_role not null,
  display_name text not null,                -- "Dra. Christiane", "Betânia"
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------- FAMÍLIAS E RESPONSÁVEIS ----------
create table public.families (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,                  -- "Família Silva" (uso interno)
  created_by uuid references public.staff(user_id),
  created_at timestamptz not null default now()
);

-- Vários responsáveis por família (pai + mãe); SEM CPF/RG.
create table public.guardians (
  user_id      uuid not null references auth.users(id) on delete cascade,
  family_id    uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  relationship text,                          -- 'mae' | 'pai' | 'avo' | livre
  is_primary   boolean not null default false, -- quem assinou o consentimento 1º
  created_at   timestamptz not null default now(),
  primary key (user_id, family_id)
);

-- ---------- CRIANÇAS ----------
-- Minimização: primeiro nome + nascimento. Avatar é preset, não foto.
create table public.children (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  first_name  text not null,
  birth_date  date not null,                 -- idade é contexto clínico necessário
  avatar_key  text,                          -- chave de avatar pré-definido (gamification)
  chart_ref   text,                          -- nº do prontuário p/ conferência interna; NUNCA exibido no app
  archived_at timestamptz,                   -- alta / família saiu: some do app, registro retido
  created_at  timestamptz not null default now()
);

-- ---------- TRATAMENTOS (prescrição — staff escreve) ----------
-- Uma criança pode ter atropina E ortho-k simultâneos (regimes distintos).
create table public.treatments (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.children(id) on delete cascade,
  type          public.treatment_type not null,
  instructions  text,                        -- "1 gota em cada olho ao deitar"
  suggested_time time,                       -- horário sugerido pela clínica (ex. 20:30)
  days_of_week  int[] not null default '{0,1,2,3,4,5,6}', -- 0=dom; atropina/ortho-k = diário
  starts_on     date not null default current_date,
  ends_on       date,
  active        boolean not null default true,
  created_by    uuid references public.staff(user_id),
  created_at    timestamptz not null default now()
);
-- no máx. 1 tratamento ativo de cada tipo por criança
create unique index uq_treatment_active
  on public.treatments(child_id, type) where active;

-- ---------- PREFERÊNCIA DE LEMBRETE (responsável escreve) ----------
-- Notificações são LOCAIS por device: pai e mãe podem ter horários distintos.
-- Separar da prescrição mantém o responsável sem UPDATE em dado clínico.
create table public.reminder_prefs (
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  treatment_id     uuid not null references public.treatments(id) on delete cascade,
  reminder_time    time not null,
  enabled          boolean not null default true,
  updated_at       timestamptz not null default now(),
  primary key (guardian_user_id, treatment_id)
);

-- ---------- MEDIÇÕES CLÍNICAS (staff escreve, família só lê) ----------
create table public.measurements (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children(id) on delete cascade,
  measured_on date not null,
  -- Refração por olho (dioptrias, passo 0,25)
  od_sphere   numeric(4,2), od_cylinder numeric(4,2),
  oe_sphere   numeric(4,2), oe_cylinder numeric(4,2),
  -- EE = esfera + cilindro/2: conversão óptica DEFINICIONAL (consta na receita),
  -- não é interpretação de risco. A interpretação fica só em `status`.
  od_se numeric(5,2) generated always as (od_sphere + coalesce(od_cylinder,0)/2) stored,
  oe_se numeric(5,2) generated always as (oe_sphere + coalesce(oe_cylinder,0)/2) stored,
  -- Comprimento axial (mm) — padrão-ouro de progressão
  od_axial_mm numeric(4,2) check (od_axial_mm between 15 and 35),
  oe_axial_mm numeric(4,2) check (oe_axial_mm between 15 and 35),
  -- ANVISA RDC 657/2022: SEMPRE definido pela médica. O app apenas EXIBE.
  status      public.clinical_status not null default 'sem_avaliacao',
  doctor_note text,                          -- recado da Dra. para a família
  recorded_by uuid not null references public.staff(user_id),
  created_at  timestamptz not null default now(),
  unique (child_id, measured_on)             -- 1 medição por consulta/dia
);

-- ---------- ADESÃO (check-ins do responsável) ----------
create table public.adherence_logs (
  id           uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  child_id     uuid not null references public.children(id) on delete cascade, -- desnormalizado p/ RLS barato
  log_date     date not null,                -- a "noite de" (corte definido no cliente)
  status       public.adherence_status not null default 'feito',
  note         text,                         -- "doente, médica orientou pausar"
  logged_by    uuid references auth.users(id) on delete set null, -- preserva histórico pós-deleção
  created_at   timestamptz not null default now(),
  unique (treatment_id, log_date)            -- idempotente: pai e mãe não duplicam
);
-- Janela retroativa (7 dias) fica no WITH CHECK da policy, não em CHECK
-- constraint: current_date em CHECK quebra na re-validação de dump/restore.

-- ---------- CONSENTIMENTO LGPD (art. 14 §1º) ----------
create table public.consent_terms (
  id             uuid primary key default gen_random_uuid(),
  version        text not null unique,       -- '2026-06-v1'
  content_md     text not null,              -- TEXTO INTEGRAL: prova do que foi aceito
  content_sha256 text not null,
  active         boolean not null default false,
  published_at   timestamptz not null default now()
);
create unique index uq_one_active_term on public.consent_terms(active) where active;

-- Aceite POR CRIANÇA (consentimento específico). user_id anulável: na deleção
-- da conta vira NULL, mas snapshot + termo + timestamp seguem como prova.
create table public.consents (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  guardian_name_snapshot text not null,
  term_id                uuid not null references public.consent_terms(id),
  child_id               uuid not null references public.children(id) on delete cascade,
  granted_at             timestamptz not null default now(),
  revoked_at             timestamptz,
  app_version            text,
  unique (user_id, term_id, child_id)
);

-- ---------- CONVITES ----------
create table public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  email       text not null,
  invited_by  uuid not null references public.staff(user_id),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at  timestamptz not null default now() + interval '7 days'
);

-- ---------- PUSH TOKENS (fase 2: "novos resultados disponíveis") ----------
create table public.push_tokens (
  user_id    uuid not null references auth.users(id) on delete cascade,
  expo_token text not null,
  platform   text check (platform in ('ios','android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_token)
);

-- ---------- PEDIDOS DE DELEÇÃO (trilha p/ Apple/LGPD) ----------
create table public.deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,                -- sem FK: sobrevive à deleção do user
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  notes        text
);


-- ============ HELPERS (SECURITY DEFINER, schema private) ============
-- Evitam recursão de RLS e centralizam a lógica. search_path vazio +
-- nomes qualificados = imune a hijack de search_path.

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.active
  );
$$;

create or replace function private.is_my_family(fam uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.guardians g
    where g.user_id = (select auth.uid()) and g.family_id = fam
  );
$$;

create or replace function private.can_see_child(cid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.children c
    join public.guardians g on g.family_id = c.family_id
    where c.id = cid and g.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_staff(), private.is_my_family(uuid),
  private.can_see_child(uuid) from anon, public;
grant  execute on function private.is_staff(), private.is_my_family(uuid),
  private.can_see_child(uuid) to authenticated;

-- ============ HABILITAR RLS EM TUDO ============
alter table public.staff             enable row level security;
alter table public.families          enable row level security;
alter table public.guardians         enable row level security;
alter table public.children          enable row level security;
alter table public.treatments        enable row level security;
alter table public.reminder_prefs    enable row level security;
alter table public.measurements      enable row level security;
alter table public.adherence_logs    enable row level security;
alter table public.consent_terms     enable row level security;
alter table public.consents          enable row level security;
alter table public.family_invites    enable row level security;
alter table public.push_tokens       enable row level security;
alter table public.deletion_requests enable row level security;

-- Cinto e suspensório: anon não enxerga NADA (além de não haver policy p/ ele)
revoke all on all tables in schema public from anon;

-- ============ POLICIES ============
-- Padrão: staff = acesso total operacional; responsável = leitura do que é
-- da sua família + escrita apenas em adesão, lembretes e consentimento.

-- STAFF: cada um se vê; staff vê a equipe. Gestão só via service role/SQL.
create policy staff_select on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff());

-- FAMILIES
create policy fam_staff_all on public.families for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy fam_guardian_read on public.families for select to authenticated
  using (private.is_my_family(id));

-- GUARDIANS (responsável vê a si e ao cônjuge da mesma família)
create policy guard_staff_all on public.guardians for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy guard_family_read on public.guardians for select to authenticated
  using (private.is_my_family(family_id));

-- CHILDREN (responsável não vê criança arquivada)
create policy child_staff_all on public.children for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy child_guardian_read on public.children for select to authenticated
  using (private.is_my_family(family_id) and archived_at is null);

-- TREATMENTS (prescrição: só staff escreve)
create policy treat_staff_all on public.treatments for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy treat_guardian_read on public.treatments for select to authenticated
  using (private.can_see_child(child_id));

-- MEASUREMENTS — responsável: SELECT apenas. Sem policy de escrita = negado.
create policy meas_staff_all on public.measurements for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy meas_guardian_read on public.measurements for select to authenticated
  using (private.can_see_child(child_id));

-- ADHERENCE_LOGS — coração do app do responsável
create policy adh_guardian_read on public.adherence_logs for select to authenticated
  using (private.can_see_child(child_id));
create policy adh_guardian_insert on public.adherence_logs for insert to authenticated
  with check (
    private.can_see_child(child_id)
    and logged_by = (select auth.uid())
    and log_date between current_date - 7 and current_date  -- streak que perdoa, sem reescrever história
    and exists (select 1 from public.treatments t
                where t.id = treatment_id and t.child_id = adherence_logs.child_id)
  );
create policy adh_guardian_update on public.adherence_logs for update to authenticated
  using (logged_by = (select auth.uid())
         and log_date between current_date - 7 and current_date)
  with check (logged_by = (select auth.uid())
              and log_date between current_date - 7 and current_date);
create policy adh_staff_read on public.adherence_logs for select to authenticated
  using (private.is_staff());   -- staff LÊ adesão; não a fabrica

-- REMINDER_PREFS — domínio exclusivo do responsável
create policy rp_owner_all on public.reminder_prefs for all to authenticated
  using (guardian_user_id = (select auth.uid()))
  with check (guardian_user_id = (select auth.uid())
              and exists (select 1 from public.treatments t
                          where t.id = treatment_id and private.can_see_child(t.child_id)));

-- CONSENT_TERMS: leitura geral; publicação só via service role (sem policy)
create policy terms_read on public.consent_terms for select to authenticated
  using (true);

-- CONSENTS: usuário registra e revoga o próprio aceite; staff lê
create policy cons_self_insert on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_see_child(child_id));
create policy cons_self_read on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff());
create policy cons_self_revoke on public.consents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- FAMILY_INVITES / DELETION_REQUESTS: só staff (escrita real via Edge Function)
create policy inv_staff_all on public.family_invites for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy delreq_staff_read on public.deletion_requests for select to authenticated
  using (private.is_staff());

-- PUSH_TOKENS: dono total
create policy pt_owner_all on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
