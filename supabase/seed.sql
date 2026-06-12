-- ============================================================
-- Seed de DESENVOLVIMENTO — roda em `supabase db reset` (local).
-- NUNCA aplicar em produção: usuários fake com senha conhecida.
--
-- Usuários (senha de todos: senha-local-123):
--   medica@example.com      → Dra. Christiane (staff/medica)
--   secretaria@example.com  → Betânia (staff/secretaria)
--   responsavel@example.com → Fernanda (responsável da Família Souza)
--
-- Família Souza: Alice (atropina) e Pedro (ortho_k), com medições
-- retroativas realistas e check-ins da última semana.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Usuários fake direto em auth.users (padrão de seed local).
--    * instance_id fixo 00000000-... (único instance do GoTrue local)
--    * encrypted_password via pgcrypto (extensions.crypt + gen_salt)
--    * colunas de token como '' (NULL quebra o scan do GoTrue ao logar)
--    * auth.identities com provider 'email' (exigida p/ login com senha)
-- ------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'medica@example.com',
   extensions.crypt('senha-local-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Dra. Christiane"}',
   now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'secretaria@example.com',
   extensions.crypt('senha-local-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Betânia"}',
   now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'responsavel@example.com',
   extensions.crypt('senha-local-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Fernanda"}',
   now(), now(), '', '', '', '', '', '', '', '');

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in ('10000000-0000-4000-8000-000000000001',
               '10000000-0000-4000-8000-000000000002',
               '20000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- 2. Staff da clínica
-- ------------------------------------------------------------
insert into public.staff (user_id, role, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'medica',     'Dra. Christiane'),
  ('10000000-0000-4000-8000-000000000002', 'secretaria', 'Betânia');

-- ------------------------------------------------------------
-- 3. Família fake com 2 crianças
-- ------------------------------------------------------------
insert into public.families (id, label, created_by) values
  ('30000000-0000-4000-8000-000000000001', 'Família Souza (dev)',
   '10000000-0000-4000-8000-000000000002');

insert into public.guardians (user_id, family_id, display_name, relationship, is_primary) values
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'Fernanda', 'mae', true);

insert into public.children (id, family_id, first_name, birth_date, avatar_key) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'Alice', '2018-03-10', 'coruja-roxa'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
   'Pedro', '2015-09-02', 'coruja-azul');

-- ------------------------------------------------------------
-- 4. Tratamentos: Alice = atropina noturna, Pedro = ortho-k
-- ------------------------------------------------------------
insert into public.treatments (id, child_id, type, instructions, suggested_time, starts_on, created_by) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'atropina', '1 gota de atropina 0,05% em cada olho ao deitar', '20:30',
   current_date - 400, '10000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002',
   'ortho_k', 'Colocar as lentes de ortoceratologia ao deitar; retirar ao acordar', '21:00',
   current_date - 400, '10000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- 5. Medições retroativas (3 por criança, valores realistas).
--    status SEMPRE digitado pela médica (ANVISA RDC 657/2022) —
--    os números não geram interpretação alguma no app.
-- ------------------------------------------------------------
insert into public.measurements
  (child_id, measured_on, od_sphere, od_cylinder, oe_sphere, oe_cylinder,
   od_axial_mm, oe_axial_mm, status, doctor_note, recorded_by) values
  -- Alice (atropina): progressão lenta
  ('40000000-0000-4000-8000-000000000001', current_date - 360,
   -1.25, -0.25, -1.50, -0.50, 23.40, 23.50, 'sem_avaliacao',
   null, '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000001', current_date - 180,
   -1.50, -0.25, -1.75, -0.50, 23.60, 23.70, 'controle_adequado',
   'A evolução da Alice está dentro do esperado para o tratamento. Continuem com a gotinha todas as noites.',
   '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000001', current_date - 30,
   -1.75, -0.50, -2.00, -0.50, 23.70, 23.80, 'controle_adequado',
   'Ótimo resultado neste período. Parabéns pelo cuidado da família.',
   '10000000-0000-4000-8000-000000000001'),
  -- Pedro (ortho-k): miopia mais alta, um período de atenção
  ('40000000-0000-4000-8000-000000000002', current_date - 360,
   -3.00, -0.75, -3.25, -0.50, 24.60, 24.70, 'sem_avaliacao',
   null, '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', current_date - 180,
   -3.25, -0.75, -3.50, -0.75, 24.80, 24.90, 'atencao',
   'Notei uma progressão um pouco maior neste período. Vamos reforçar o uso das lentes todas as noites e reavaliar em 3 meses.',
   '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', current_date - 30,
   -3.50, -1.00, -3.75, -0.75, 24.90, 25.00, 'controle_adequado',
   'A adesão melhorou e o resultado apareceu. Seguimos com o mesmo plano.',
   '10000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- 6. Check-ins de adesão da última semana (registrados pela mãe)
-- ------------------------------------------------------------
insert into public.adherence_logs (treatment_id, child_id, log_date, status, note, logged_by) values
  -- Alice (atropina)
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   current_date - 1, 'feito', null, '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   current_date - 2, 'feito', null, '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   current_date - 3, 'pulado', 'Alice estava gripada, pulamos a gotinha', '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   current_date - 4, 'feito', null, '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   current_date - 5, 'feito', null, '20000000-0000-4000-8000-000000000001'),
  -- Pedro (ortho-k) — sem registro em current_date - 3 (noite esquecida)
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002',
   current_date - 1, 'feito', null, '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002',
   current_date - 2, 'feito', null, '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002',
   current_date - 4, 'feito', null, '20000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- 7. Termo de consentimento ativo + aceites da responsável
--    (hash calculado do próprio conteúdo, como em produção)
-- ------------------------------------------------------------
with term as (
  select $md$# Termo de Consentimento — Lumi (DEV)

Texto de desenvolvimento. O termo real será redigido pelo advogado da
clínica e versionado aqui antes do piloto (LGPD art. 14, par. 1º):
consentimento específico e em destaque de ao menos um dos pais, com
declaração explícita da retenção do registro clínico (CFM ~20 anos)
mesmo após a exclusão da conta.$md$::text as content_md
)
insert into public.consent_terms (id, version, content_md, content_sha256, active)
select '60000000-0000-4000-8000-000000000001', '2026-06-dev-v1',
       content_md, encode(extensions.digest(content_md, 'sha256'), 'hex'), true
from term;

insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id, app_version) values
  ('20000000-0000-4000-8000-000000000001', 'Fernanda',
   '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'dev'),
  ('20000000-0000-4000-8000-000000000001', 'Fernanda',
   '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'dev');

-- ------------------------------------------------------------
-- 8. Preferências de lembrete da responsável (horário REAL por device,
--    separado da prescrição — design-backend.md)
-- ------------------------------------------------------------
insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time, enabled) values
  ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '20:30', true),
  ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '21:15', true);
