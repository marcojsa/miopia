# Design — backend

> Extraído de docs/design-arquitetura.json (designs[0]). Fonte de verdade: o JSON.

## Perspectiva

BACKEND, DADOS E SEGURANÇA (Supabase: Postgres + RLS + Auth + Edge Functions) para o app de adesão ao controle de miopia da Oftalmologia Alto de Pinheiros. Princípios norteadores: (1) o banco é a fronteira de segurança — toda autorização vive em RLS, o cliente nunca é confiável; (2) ANVISA RDC 657/2022 como restrição de modelagem — o status clínico é um CAMPO digitado pela Dra. Christiane (enum), nunca derivado; o único campo calculado é o equivalente esférico (EE = esfera + cilindro/2), que é conversão óptica definicional, não interpretação de risco; (3) minimização LGPD desde o schema — não existe coluna para CPF, endereço ou foto da criança; (4) separação entre prescrição clínica (staff escreve) e preferência pessoal de lembrete (responsável escreve), que resolve elegantemente o RLS de escrita; (5) prontuário ≠ conta — deleção de conta apaga a identidade do responsável no app, mas medições/tratamentos pertencem ao registro clínico da clínica (obrigação legal CFM de retenção) e são retidos/desvinculados, nunca destruídos pelo botão de deletar conta.

## Decisões

### Modelagem dos olhos nas medições

**Escolha:** Colunas por olho (od_*/oe_*) na mesma linha, em vez de uma linha por olho

**Racional:** Uma consulta gera UMA medição com os dois olhos; o dashboard sempre plota OD e OE juntos. Colunas eliminam joins/pivots, simplificam o formulário do painel (uma linha = um formulário) e a constraint unique(child_id, measured_on) fica trivial. Linha-por-olho só valeria se houvesse N tipos de exame variáveis — não é o caso.

### Equivalente esférico: calculado ou digitado

**Escolha:** Coluna GENERATED (od_se = od_sphere + coalesce(od_cylinder,0)/2, STORED), com a médica digitando esfera e cilindro

**Racional:** EE é definição matemática da óptica (consta em qualquer receita), não interpretação clínica — não muda a classificação ANVISA. O que a RDC 657 proíbe é o app concluir 'progressão acelerada': isso fica exclusivamente no campo status (enum) preenchido pela médica, com default 'sem_avaliacao'. Se a clínica preferir máxima cautela, troca-se por coluna comum digitada — mudança de 1 linha de migration (deixei como pergunta aberta).

### Autorização

**Escolha:** RLS em 100% das tabelas, com funções helper SECURITY DEFINER em schema privado (private.is_staff(), private.is_my_family(), private.can_see_child()) e nenhuma policy para o role anon

**Racional:** Funções security definer evitam recursão de RLS (policy de guardians consultando guardians) e centralizam a lógica — cada policy vira uma linha legível. Schema private não é exposto pelo PostgREST. Sem policy para anon + revoke explícito = acesso anônimo zero por construção. auth.uid() embrulhado em (select ...) para o initplan cachear por statement (recomendação oficial Supabase de performance).

### Auth: convite vs auto-cadastro

**Escolha:** Convite exclusivo pela clínica (invite-only): Betânia cadastra família/criança/tratamento no painel → Edge Function chama auth.admin.inviteUserByEmail() → responsável recebe e-mail, define senha e cai no onboarding com o termo LGPD. Auto-cadastro público DESATIVADO no Supabase Auth

**Racional:** Piloto fechado com 5-10 famílias selecionadas: auto-cadastro criaria o problema de casar conta anônima com paciente real (e contas órfãs de curiosos). Convite garante que toda conta já nasce vinculada a family_id (via app_metadata), combina com o posicionamento premium (onboarding 'white-glove' na recepção) e elimina tela de cadastro + validações. O convite por admin API continua funcionando mesmo com signup público desabilitado. Login recorrente: senha + opção de magic link.

### Painel da clínica

**Escolha:** SPA web separada: Vite + React + TypeScript + supabase-js, deploy estático (Cloudflare Pages/Vercel free), no mesmo monorepo do app, compartilhando os tipos gerados por supabase gen types

**Racional:** Usuárias são médica e secretária em DESKTOP preenchendo formulário denso pós-consulta — RN-web (expo-router web) é atrito puro para tabelas e forms desktop e incharia o bundle mobile. Telas role-based dentro do app Expo colocariam features administrativas no binário revisado pela Apple (risco extra na guideline 5.1.1 de saúde) e ampliariam a superfície de ataque do app distribuído. Next.js seria overhead sem ganho: não há SSR/SEO/segredos no front — a autorização é 100% RLS com o JWT do staff. Vite SPA é o caminho de menor manutenção para dev solo. Custo: zero.

### Lembretes: prescrição vs preferência

**Escolha:** Tabela treatments (staff escreve: tipo, instruções, dias, horário sugerido) separada de reminder_prefs (responsável escreve: horário real e on/off do lembrete no SEU device, PK guardian+treatment)

**Racional:** Resolve três problemas de uma vez: (a) RLS limpo — responsável nunca tem UPDATE em dados clínicos; (b) pai e mãe podem ter lembretes em horários diferentes nos seus próprios celulares (notificações são locais por device); (c) a clínica preserva a prescrição original intacta para auditoria. O app agenda notificações locais lendo reminder_prefs — 1 notificação repetitiva por tratamento, longe do limite de 64 do iOS.

### Check-in de adesão

**Escolha:** adherence_logs com UNIQUE(treatment_id, log_date) + janela retroativa de 7 dias imposta no WITH CHECK da policy (não em CHECK constraint), status enum 'feito'|'pulado' com nota opcional, logged_by com ON DELETE SET NULL

**Racional:** Unique torna o check-in idempotente (upsert) e resolve pai e mãe marcando a mesma noite. Janela de 7 dias permite preencher dias esquecidos (streak que perdoa) sem permitir reescrever o histórico — e fica na policy porque CHECK constraint com current_date quebra em dump/restore. 'pulado' registrado conscientemente (criança doente, férias) é dado de adesão valioso e alimenta o perdão do streak. SET NULL preserva o histórico de adesão da criança se o responsável deletar a conta.

### Consentimento LGPD

**Escolha:** Termos versionados com texto integral + hash (consent_terms) e aceite por responsável POR CRIANÇA (consents), com snapshot do nome para prova e revogação por timestamp

**Racional:** Art. 14 §1º exige consentimento específico e em destaque de ao menos um dos pais — por criança, não genérico. Guardar o texto integral aceito (não só o número da versão) é a prova jurídica de O QUE foi consentido. Snapshot do nome + user_id anulável permite manter a prova do aceite mesmo após deleção da conta (legítimo interesse/defesa em processo) sem reter a conta. Não guardo IP — timestamp + versão + app_version bastam e respeitam minimização.

### Deleção de conta (Apple + LGPD)

**Escolha:** Edge Function delete-account com matriz em 3 categorias: APAGA (auth.user, guardians, reminder_prefs, push_tokens, convites pendentes), ANONIMIZA (logged_by dos check-ins → null; consents.user_id → null mantendo snapshot), RETÉM (children arquivado, treatments, measurements — prontuário da clínica)

**Racional:** Medições e tratamentos são registro clínico: LGPD art. 16/art. 11 II permite retenção por obrigação legal (CFM exige guarda de prontuário por 20 anos) — o termo de consentimento deve declarar isso explicitamente. Se a família inteira sai, children ganha archived_at e some do app sem destruir o registro. Edge Function (service role) é obrigatória porque o cliente não pode chamar auth.admin.deleteUser.

### Edge Functions

**Escolha:** Apenas 2 no MVP: invite-family e delete-account. Opcional fase 2: notify-new-measurement (webhook de INSERT em measurements → Expo Push 'novos resultados disponíveis'). Todo o resto é PostgREST direto + RLS

**Racional:** As duas obrigatórias existem por um único motivo: precisam da service role key (admin API de Auth), que jamais entra no cliente. CRUD de medições, check-ins e tratamentos não precisa de função — RLS já é a autorização. Menos funções = menos superfície, menos deploy, menos custo para dev solo.

### Teste de RLS

**Escolha:** 3 camadas: pgTAP via supabase test db (CI), script de impersonação SQL (set_config('request.jwt.claims')) para exploração rápida, e smoke test de integração com supabase-js usando 4 personas (anon, responsável A, responsável B, staff)

**Racional:** pgTAP roda no banco local do CLI e trava regressão de policy em CI. A impersonação via set_config é o jeito mais rápido de responder 'o que o usuário X enxerga?' durante o dev. O smoke test JS valida o caminho real (PostgREST + JWT de verdade), incluindo o caso crítico: anon key sem login retorna 0 linhas em TODAS as tabelas. Complemento: Security Advisor do dashboard Supabase acusa tabela sem RLS.

## Estrutura

# Backend Supabase — Schema, RLS, Auth, LGPD

## 0. Mapa de entidades

```
auth.users ──┬── staff (medica | secretaria | admin)
             └── guardians ──► families ──► children ──► treatments ──► adherence_logs
                    │                          │              └──► reminder_prefs (por responsável)
                    │                          └──► measurements (staff escreve, família lê)
                    └──► consents ──► consent_terms (versionado)
             family_invites · push_tokens · deletion_requests
```

## 1. Schema SQL completo (migration inicial)

```sql
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
```

## 2. Helpers + RLS

```sql
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
```

## 3. Como testar as policies

**Camada 1 — pgTAP no CI** (`supabase/tests/database/rls.test.sql`, roda com `supabase test db` contra o banco local do CLI; usar os helpers do `basejump/supabase_test_helpers` para criar/impersonar usuários):

```sql
begin;
select plan(6);
select tests.create_supabase_user('mae_a');
select tests.create_supabase_user('mae_b');
select tests.create_supabase_user('betania');
-- seed: staff(betania), familia A com filho A, familia B com filho B ...

select tests.authenticate_as('mae_a');
select results_eq('select count(*) from children', array[1::bigint],
  'responsável A vê só o próprio filho');
select throws_ok($$ insert into measurements (child_id, measured_on, recorded_by)
  values ('<child_a>', current_date, '<betania>') $$,
  '42501', null, 'responsável NÃO insere medição');

select tests.authenticate_as('betania');
select results_eq('select count(*) from children', array[2::bigint],
  'staff vê todas as crianças');

select tests.clear_authentication();   -- vira anon
select results_eq('select count(*) from children', array[0::bigint],
  'anon vê zero');
select * from finish();
rollback;
```

**Camada 2 — impersonação rápida no SQL editor** (responde "o que o usuário X enxerga?" em segundos):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"<UUID_DO_USUARIO>","role":"authenticated"}', true);
select * from children;   -- deve listar só os filhos da família dele
rollback;
```

**Camada 3 — smoke test de integração** (script Node com supabase-js no repo, roda contra `supabase start` local): 4 personas — anon (espera 0 linhas em todas as tabelas), responsável A (vê família A, falha ao ler família B e ao inserir measurement), responsável B (simétrico), staff (vê tudo, insere measurement). Rodar antes de cada release do piloto. Complemento contínuo: Security Advisor do dashboard acusa tabela sem RLS ou função sem search_path.

## 4. Auth — fluxo de convite (recomendado)

1. Betânia, no painel, cria família + criança(s) + tratamento(s) e digita o e-mail do responsável.
2. Painel chama a Edge Function `invite-family` (JWT do staff no header; a função valida `private.is_staff()` antes de qualquer coisa).
3. A função, com service role: cria/atualiza `families`, `guardians` "pendente", registra `family_invites` e chama `auth.admin.inviteUserByEmail(email, { data: { family_id }, redirectTo: <deep link do app> })`.
4. Responsável (que já instalou o app via TestFlight/Play Internal — orientado na recepção) abre o link, define senha, e o app detecta primeiro login → tela de consentimento LGPD **em destaque, por criança, bloqueante** → grava em `consents` → home.
5. Config do projeto: **"Allow new users to sign up" = OFF** (convite por admin API continua funcionando); e-mail OTP/magic link habilitado como login alternativo.
6. Segundo responsável (cônjuge): convidado pela clínica no mesmo fluxo (mais simples e auditável que convite peer-to-peer no MVP).

## 5. Matriz LGPD de deleção de conta (Edge Function `delete-account`)

| Categoria | Dados | Ação |
|---|---|---|
| Identidade no app | auth.users, guardians, reminder_prefs, push_tokens, convites pendentes | **APAGA** |
| Prova de consentimento | consents | **ANONIMIZA** (user_id→null, mantém snapshot+termo+timestamp) |
| Histórico de adesão | adherence_logs.logged_by | **DESVINCULA** (set null; o dado clínico da criança permanece) |
| Registro clínico | children, treatments, measurements | **RETÉM** (prontuário da clínica; CFM ~20 anos; se família toda sai → children.archived_at) |

Minimização aplicada no schema: zero CPF/RG/endereço/foto; criança = primeiro nome + nascimento + avatar preset; telefone fica no Klingo (sistema da clínica), não no app. O termo de consentimento deve declarar a retenção do registro clínico e nomear o encarregado (DPO) da clínica.

## 6. Edge Functions

| Função | Auth | Por que precisa existir |
|---|---|---|
| `invite-family` | JWT staff (valida is_staff) | `auth.admin.inviteUserByEmail` exige service role — nunca no cliente |
| `delete-account` | JWT do responsável | `auth.admin.deleteUser` + matriz transacional de deleção/anonimização |
| `notify-new-measurement` (fase 2) | DB webhook (INSERT em measurements) | Expo Push "os resultados da consulta estão disponíveis" — toque premium |

Todo o resto (check-ins, leitura de dashboard, prefs de lembrete, formulário da médica) é supabase-js direto contra PostgREST com RLS.

## 7. Sequência de implementação

1. `supabase init` + migration única acima (`supabase db diff`/`migration new`) + seed de staff e 1 família fake — rodar 100% local com `supabase start`.
2. pgTAP + smoke test JS das policies (antes de qualquer UI).
3. Edge Function `invite-family` + configurar SMTP custom (Resend free) — o SMTP default do Supabase é rate-limitado (~3/h) e inviabiliza até o piloto.
4. Painel Vite/React: login staff → CRUD família/criança/tratamento → formulário de medição pós-consulta (esfera/cilindro/axial por olho + status + recado).
5. App Expo: deep link do convite → consentimento → home (filhos, check-in, dashboard de medições) → reminder_prefs + notificações locais (canal Android dedicado + fallback inexact alarm).
6. Edge Function `delete-account` + tela de deleção in-app (bloqueia review da Apple se faltar).
7. `supabase gen types typescript` compartilhado entre app e painel no monorepo.

## Riscos

- ANVISA — borda da classificação: o EE como coluna gerada é defensável (conversão definicional), mas QUALQUER evolução futura ('seu filho progrediu acima do esperado', cores automáticas por faixa de axial, percentis de crescimento ocular) reclassifica o app como SaMD e exige registro. Congelar a regra: gráfico mostra números, rótulo/cor vem exclusivamente do campo status digitado pela médica. Documentar essa decisão por escrito com a Dra. Christiane.
- Free tier do Supabase pausa o projeto após ~1 semana de inatividade — inaceitável com famílias reais no piloto. Orçar Pro (US$25/mês) a partir do piloto, somado ao eventual EAS Starter (US$19/mês) e Apple Developer (US$99/ano no CNPJ da clínica). Dado o caixa apertado do Marco, esses custos devem ser da clínica e estar na proposta antes de começar.
- E-mail de convite é o elo frágil do onboarding: SMTP default do Supabase é rate-limitado e cai em spam; sem SMTP custom (Resend/Postmark) configurado ANTES do piloto, o fluxo invite-only morre na praia. Além disso, o deep link do convite exige app já instalado — o roteiro da recepção (Betânia) precisa ser: instala primeiro, convite depois.
- SECURITY DEFINER mal configurado é o risco técnico nº 1 do design: função sem search_path vazio ou com EXECUTE para anon vira bypass de RLS. O smoke test da persona anon (0 linhas em tudo) e o Security Advisor precisam rodar a cada migration.
- Retenção vs LGPD: reter medições após deleção de conta é correto (obrigação legal CFM), mas SÓ se o termo de consentimento declarar isso explicitamente. Termo precisa de revisão jurídica (advogado da clínica) — não é entregável de dev. Sem isso, o 'apagar conta' do app promete algo que o backend deliberadamente não cumpre.
- Semântica do log_date na virada do dia: atropina/ortho-k acontecem ao deitar; um check-in feito 00h30 se refere à 'noite de ontem'. Sem um corte definido (ex.: até 04h conta como dia anterior, calculado no cliente), o streak quebra injustamente — exatamente o tipo de rigidez que a evidência diz causar abandono.
- Dois responsáveis + unique(treatment_id, log_date): o segundo check-in da mesma noite deve virar upsert silencioso ou estado 'já registrado pelo outro responsável' na UI — se o app tratar o conflito 409 como erro, a experiência do casal degrada rápido.

## Perguntas em aberto

- A Dra. Christiane prefere digitar esfera+cilindro (EE calculado pela coluna gerada) ou digitar o EE pronto da receita? Se preferir o EE pronto, a coluna gerada vira coluna comum e o ponto ANVISA fica ainda mais conservador — decidir antes da migration inicial.
- Qual a janela retroativa de check-in aceitável clinicamente (proposta: 7 dias) e qual o horário de corte da 'noite' (proposta: até 04h conta como dia anterior)? Validar com a Dra.
- O termo de consentimento LGPD será redigido pelo advogado da clínica? Quem será o encarregado (DPO) nomeado no termo? Prazo disso condiciona o início do piloto.
- Convite do segundo responsável: sempre pela clínica (proposto para o MVP) ou o primeiro responsável pode convidar o cônjuge de dentro do app (fase 2)?
- Medições históricas pré-app (consultas de 2024-2025 no Klingo): a clínica quer digitar retroativamente 2-3 medições por criança no onboarding do piloto para o gráfico já nascer com tendência? Afeta o esforço da Betânia e o valor percebido na primeira abertura do app.
- Quem paga e em nome de quem ficam Supabase Pro, EAS e Resend — confirmar que tudo entra como custo da clínica na proposta (contas no CNPJ dela, como já decidido para as lojas).
- Auditoria de acesso do staff a dados sensíveis (quem viu o quê): fica para fase 2 com pgaudit/trigger simples, ou a clínica exige desde o piloto?
