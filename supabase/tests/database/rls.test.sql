-- ============================================================
-- Suíte pgTAP de RLS — gate da Fase 1 (roda com `supabase test db`)
--
-- Matriz testada (design-backend.md §2-§3):
--   * anon            → acesso ZERO em todas as tabelas (42501: a migration
--                       revoga os privilégios do anon, mais forte que "0 linhas")
--   * responsável A   → lê só a própria família; escreve APENAS adesão,
--                       lembretes, consentimento e push token próprios
--   * responsável B   → simétrico (não vê nada da família A)
--   * staff (Betânia) → lê tudo, escreve dados clínicos; NÃO fabrica adesão
--                       e NÃO enxerga preferências pessoais de lembrete
--
-- Pré-requisito: 00-test-helpers.sql (basejump/supabase_test_helpers
-- vendorizado) roda antes — o pg_prove ordena os arquivos por nome.
-- Tudo dentro de uma transação com rollback: o banco fica intacto.
-- ============================================================
begin;
select plan(67);

-- ------------------------------------------------------------
-- O banco de dev chega SEEDADO (`supabase db reset` roda o seed.sql) e as
-- asserções de contagem do staff são absolutas — além de o termo ativo do
-- seed colidir com o termo de teste (uq_one_active_term). A transação
-- começa zerando as tabelas do app; o rollback final devolve o seed intacto.
-- ------------------------------------------------------------
truncate table
  public.staff, public.families, public.guardians, public.children,
  public.treatments, public.reminder_prefs, public.measurements,
  public.adherence_logs, public.consent_terms, public.consents,
  public.family_invites, public.push_tokens, public.deletion_requests
  cascade;

-- ------------------------------------------------------------
-- SEED DE TESTE (como postgres, dono das tabelas → bypassa RLS)
-- UUIDs fixos para legibilidade:
--   família A aaaaaaaa-...-01 / criança A ...-02 / tratamento A ...-03
--   família B bbbbbbbb-...-01 / criança B ...-02 / tratamento B ...-03
-- ------------------------------------------------------------
select tests.create_supabase_user('mae_a', 'mae.a@test.com');
select tests.create_supabase_user('mae_b', 'mae.b@test.com');
select tests.create_supabase_user('betania', 'betania@test.com');
select tests.create_supabase_user('dra_christiane', 'dra@test.com');

insert into public.staff (user_id, role, display_name) values
  (tests.get_supabase_uid('betania'),        'secretaria', 'Betânia'),
  (tests.get_supabase_uid('dra_christiane'), 'medica',     'Dra. Christiane');

insert into public.families (id, label, created_by) values
  ('aaaaaaaa-0000-4000-a000-000000000001', 'Família A (teste)', tests.get_supabase_uid('betania')),
  ('bbbbbbbb-0000-4000-a000-000000000001', 'Família B (teste)', tests.get_supabase_uid('betania'));

insert into public.guardians (user_id, family_id, display_name, relationship, is_primary) values
  (tests.get_supabase_uid('mae_a'), 'aaaaaaaa-0000-4000-a000-000000000001', 'Mãe A', 'mae', true),
  (tests.get_supabase_uid('mae_b'), 'bbbbbbbb-0000-4000-a000-000000000001', 'Mãe B', 'mae', true);

insert into public.children (id, family_id, first_name, birth_date) values
  ('aaaaaaaa-0000-4000-a000-000000000002', 'aaaaaaaa-0000-4000-a000-000000000001', 'Alice', '2018-03-10'),
  ('bbbbbbbb-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001', 'Bruno', '2016-07-22');

insert into public.treatments (id, child_id, type, instructions, suggested_time) values
  ('aaaaaaaa-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000002',
   'atropina', '1 gota em cada olho ao deitar', '20:30'),
  ('bbbbbbbb-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000002',
   'ortho_k', 'colocar as lentes ao deitar', '21:00');

insert into public.measurements
  (child_id, measured_on, od_sphere, od_cylinder, oe_sphere, oe_cylinder,
   od_axial_mm, oe_axial_mm, status, recorded_by) values
  ('aaaaaaaa-0000-4000-a000-000000000002', current_date - 30,
   -2.00, -0.50, -2.25, -0.25, 24.10, 24.05, 'sem_avaliacao', tests.get_supabase_uid('betania')),
  ('bbbbbbbb-0000-4000-a000-000000000002', current_date - 30,
   -3.50, -0.75, -3.25, -0.50, 24.80, 24.75, 'sem_avaliacao', tests.get_supabase_uid('betania'));

-- Família A: 1 check-in recente (editável) + 1 antigo (fora da janela de 7 dias)
insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by) values
  ('aaaaaaaa-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000002',
   current_date - 2,  'feito', tests.get_supabase_uid('mae_a')),
  ('aaaaaaaa-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000002',
   current_date - 10, 'feito', tests.get_supabase_uid('mae_a')),
  ('bbbbbbbb-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000002',
   current_date - 1,  'feito', tests.get_supabase_uid('mae_b'));

insert into public.consent_terms (id, version, content_md, content_sha256, active) values
  ('cccccccc-0000-4000-a000-000000000001', '2026-06-v1-test', '# Termo de teste', 'hash-de-teste', true);

insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id) values
  (tests.get_supabase_uid('mae_b'), 'Mãe B',
   'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000002');

insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time) values
  (tests.get_supabase_uid('mae_b'), 'bbbbbbbb-0000-4000-a000-000000000003', '21:00');

insert into public.family_invites (family_id, email, invited_by) values
  ('bbbbbbbb-0000-4000-a000-000000000001', 'pai.b@test.com', tests.get_supabase_uid('betania'));

insert into public.push_tokens (user_id, expo_token, platform) values
  (tests.get_supabase_uid('mae_b'), 'ExponentPushToken[seed-b]', 'android');

insert into public.deletion_requests (user_id, notes) values
  (gen_random_uuid(), 'pedido de teste');

-- ------------------------------------------------------------
-- T1 — RLS habilitado em TODAS as tabelas do schema public
-- ------------------------------------------------------------
select tests.rls_enabled('public');

-- ------------------------------------------------------------
-- T2..T14 — ANON: acesso zero em TODAS as tabelas.
-- A migration faz `revoke all ... from anon`, então o resultado é
-- "permission denied" (42501) — garantia ainda mais forte que 0 linhas
-- (sem o revoke, a ausência de policy devolveria 0 linhas).
-- ------------------------------------------------------------
select tests.clear_authentication();   -- vira anon

select throws_ok('select count(*) from public.staff',             '42501', null, 'anon: staff bloqueada');
select throws_ok('select count(*) from public.families',          '42501', null, 'anon: families bloqueada');
select throws_ok('select count(*) from public.guardians',         '42501', null, 'anon: guardians bloqueada');
select throws_ok('select count(*) from public.children',          '42501', null, 'anon: children bloqueada');
select throws_ok('select count(*) from public.treatments',        '42501', null, 'anon: treatments bloqueada');
select throws_ok('select count(*) from public.reminder_prefs',    '42501', null, 'anon: reminder_prefs bloqueada');
select throws_ok('select count(*) from public.measurements',      '42501', null, 'anon: measurements bloqueada');
select throws_ok('select count(*) from public.adherence_logs',    '42501', null, 'anon: adherence_logs bloqueada');
select throws_ok('select count(*) from public.consent_terms',     '42501', null, 'anon: consent_terms bloqueada');
select throws_ok('select count(*) from public.consents',          '42501', null, 'anon: consents bloqueada');
select throws_ok('select count(*) from public.family_invites',    '42501', null, 'anon: family_invites bloqueada');
select throws_ok('select count(*) from public.push_tokens',       '42501', null, 'anon: push_tokens bloqueada');
select throws_ok('select count(*) from public.deletion_requests', '42501', null, 'anon: deletion_requests bloqueada');

-- ------------------------------------------------------------
-- T15..T47 — RESPONSÁVEL A (mae_a)
-- ------------------------------------------------------------
select tests.authenticate_as('mae_a');

-- leitura: só a própria família
select results_eq('select count(*) from public.families', array[1::bigint],
  'responsável A vê exatamente 1 família');
select results_eq('select id from public.families',
  array['aaaaaaaa-0000-4000-a000-000000000001'::uuid],
  'responsável A vê a família A (não a B)');
select results_eq('select count(*) from public.guardians', array[1::bigint],
  'responsável A vê só os responsáveis da própria família');
select results_eq('select count(*) from public.children', array[1::bigint],
  'responsável A vê exatamente 1 criança');
select results_eq('select first_name from public.children', array['Alice'::text],
  'responsável A vê a própria criança (Alice)');
select results_eq('select count(*) from public.staff', array[0::bigint],
  'responsável A não enxerga a tabela de staff');
select results_eq('select count(*) from public.treatments', array[1::bigint],
  'responsável A vê só o tratamento da própria criança');
select results_eq('select count(*) from public.measurements', array[1::bigint],
  'responsável A vê só as medições da própria criança');
select results_eq(
  $$ select count(*) from public.measurements
     where child_id = 'bbbbbbbb-0000-4000-a000-000000000002' $$,
  array[0::bigint],
  'responsável A NÃO vê medições da criança da família B');

-- escrita clínica: proibida (medição e tratamento são da clínica)
select throws_ok(
  format($q$ insert into public.measurements (child_id, measured_on, od_sphere, recorded_by)
             values ('aaaaaaaa-0000-4000-a000-000000000002', current_date, -2.50, '%s') $q$,
         tests.get_supabase_uid('betania')),
  '42501', null,
  'responsável NÃO insere medição (só staff escreve dado clínico)');
select results_eq(
  $q$ with u as (
        update public.measurements set doctor_note = 'tentativa de escrita'
        where child_id = 'aaaaaaaa-0000-4000-a000-000000000002'
        returning 1)
      select count(*)::int from u $q$,
  array[0],
  'responsável NÃO atualiza medição (0 linhas afetadas)');
select throws_ok(
  $q$ insert into public.treatments (child_id, type)
      values ('aaaaaaaa-0000-4000-a000-000000000002', 'oculos_lentes') $q$,
  '42501', null,
  'responsável NÃO insere tratamento (prescrição é do staff)');
select results_eq(
  $q$ with u as (
        update public.treatments set instructions = 'tentativa de escrita'
        where id = 'aaaaaaaa-0000-4000-a000-000000000003'
        returning 1)
      select count(*)::int from u $q$,
  array[0],
  'responsável NÃO atualiza tratamento (0 linhas afetadas)');

-- adesão: insere para a própria criança, dentro da janela de 7 dias
select results_eq('select count(*) from public.adherence_logs', array[2::bigint],
  'responsável A vê só os check-ins da própria criança');
select lives_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002',
                     current_date, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  'responsável A insere check-in de hoje para a própria criança');
select lives_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002',
                     current_date - 7, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  'janela retroativa: check-in em current_date - 7 (limite) é aceito');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002',
                     current_date - 8, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  '42501', null,
  'janela retroativa: check-in em current_date - 8 é RECUSADO');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002',
                     current_date + 1, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  '42501', null,
  'check-in no futuro é RECUSADO');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('bbbbbbbb-0000-4000-a000-000000000003',
                     'bbbbbbbb-0000-4000-a000-000000000002',
                     current_date, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  '42501', null,
  'responsável A NÃO insere check-in para a criança da família B');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002',
                     current_date - 1, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_b')),
  '42501', null,
  'logged_by espoofado (uid de outra pessoa) é RECUSADO');
select results_eq(
  $q$ with u as (
        update public.adherence_logs set status = 'pulado'
        where treatment_id = 'aaaaaaaa-0000-4000-a000-000000000003'
          and log_date = current_date - 2
        returning 1)
      select count(*)::int from u $q$,
  array[1],
  'responsável A atualiza o próprio check-in recente (dentro da janela)');
select results_eq(
  $q$ with u as (
        update public.adherence_logs set status = 'pulado'
        where treatment_id = 'aaaaaaaa-0000-4000-a000-000000000003'
          and log_date = current_date - 10
        returning 1)
      select count(*)::int from u $q$,
  array[0],
  'check-in antigo (fora da janela) NÃO é editável: histórico preservado');

-- reminder_prefs: domínio exclusivo do dono
select lives_ok(
  format($q$ insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time)
             values ('%s', 'aaaaaaaa-0000-4000-a000-000000000003', '20:45') $q$,
         tests.get_supabase_uid('mae_a')),
  'responsável A cria a própria preferência de lembrete');
select results_eq('select count(*) from public.reminder_prefs', array[1::bigint],
  'responsável A vê SÓ a própria preferência (não a da mãe B)');
select throws_ok(
  format($q$ insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time)
             values ('%s', 'bbbbbbbb-0000-4000-a000-000000000003', '21:30') $q$,
         tests.get_supabase_uid('mae_a')),
  '42501', null,
  'preferência para tratamento de OUTRA família é RECUSADA');

-- consentimento: só o próprio aceite, só para criança visível
select lives_ok(
  format($q$ insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id)
             values ('%s', 'Mãe A', 'cccccccc-0000-4000-a000-000000000001',
                     'aaaaaaaa-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_a')),
  'responsável A registra consentimento da própria criança');
select throws_ok(
  format($q$ insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id)
             values ('%s', 'Mãe A', 'cccccccc-0000-4000-a000-000000000001',
                     'bbbbbbbb-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_a')),
  '42501', null,
  'consentimento para criança de OUTRA família é RECUSADO');
select throws_ok(
  format($q$ insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id)
             values ('%s', 'Mãe B', 'cccccccc-0000-4000-a000-000000000001',
                     'aaaaaaaa-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_b')),
  '42501', null,
  'consentimento com user_id de OUTRA pessoa é RECUSADO');
select results_eq('select count(*) from public.consent_terms', array[1::bigint],
  'responsável lê o termo de consentimento ativo');

-- tabelas administrativas: invisíveis para o responsável
select results_eq('select count(*) from public.family_invites', array[0::bigint],
  'responsável não vê convites (nem os da própria família)');
select results_eq('select count(*) from public.deletion_requests', array[0::bigint],
  'responsável não vê pedidos de deleção');

-- push token: dono total
select lives_ok(
  format($q$ insert into public.push_tokens (user_id, expo_token, platform)
             values ('%s', 'ExponentPushToken[teste-a]', 'ios') $q$,
         tests.get_supabase_uid('mae_a')),
  'responsável A registra o próprio push token');
select results_eq('select count(*) from public.push_tokens', array[1::bigint],
  'responsável A vê SÓ o próprio push token');

-- ------------------------------------------------------------
-- T48..T51 — RESPONSÁVEL B (simétrico: nada da família A vaza)
-- ------------------------------------------------------------
select tests.authenticate_as('mae_b');

select results_eq('select count(*) from public.children', array[1::bigint],
  'responsável B vê exatamente 1 criança');
select results_eq('select first_name from public.children', array['Bruno'::text],
  'responsável B vê a própria criança (Bruno)');
select results_eq(
  $$ select count(*) from public.measurements
     where child_id = 'aaaaaaaa-0000-4000-a000-000000000002' $$,
  array[0::bigint],
  'responsável B NÃO vê medições da criança da família A');
select results_eq('select count(*) from public.adherence_logs', array[1::bigint],
  'responsável B vê só os check-ins da própria criança');

-- ------------------------------------------------------------
-- T52..T65 — STAFF (Betânia): lê tudo, escreve dado clínico,
-- não fabrica adesão nem enxerga preferência pessoal
-- ------------------------------------------------------------
select tests.authenticate_as('betania');

select results_eq('select count(*) from public.staff', array[2::bigint],
  'staff vê a equipe inteira');
select results_eq('select count(*) from public.families', array[2::bigint],
  'staff vê todas as famílias');
select results_eq('select count(*) from public.children', array[2::bigint],
  'staff vê todas as crianças');
select results_eq('select count(*) from public.measurements', array[2::bigint],
  'staff vê todas as medições');
select results_eq('select count(*) from public.adherence_logs', array[5::bigint],
  'staff lê a adesão de todas as famílias');
select lives_ok(
  format($q$ insert into public.measurements
               (child_id, measured_on, od_sphere, od_cylinder, oe_sphere, oe_cylinder,
                od_axial_mm, oe_axial_mm, status, recorded_by)
             values ('aaaaaaaa-0000-4000-a000-000000000002', current_date,
                     -2.25, -0.50, -2.50, -0.25, 24.20, 24.15, 'controle_adequado', '%s') $q$,
         tests.get_supabase_uid('betania')),
  'staff insere medição');
select results_eq('select count(*) from public.measurements', array[3::bigint],
  'medição inserida pelo staff está visível');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002',
                     current_date - 3, 'feito', '%s') $q$,
         tests.get_supabase_uid('betania')),
  '42501', null,
  'staff NÃO fabrica check-in de adesão (só lê)');
select results_eq('select count(*) from public.reminder_prefs', array[0::bigint],
  'staff NÃO enxerga preferências pessoais de lembrete');
select results_eq(
  $q$ with u as (
        update public.treatments set instructions = '2 gotas em cada olho ao deitar'
        where id = 'aaaaaaaa-0000-4000-a000-000000000003'
        returning 1)
      select count(*)::int from u $q$,
  array[1],
  'staff atualiza prescrição de tratamento');
select results_eq('select count(*) from public.consents', array[2::bigint],
  'staff lê todos os consentimentos (prova LGPD)');
select results_eq('select count(*) from public.family_invites', array[1::bigint],
  'staff vê os convites');
select results_eq('select count(*) from public.deletion_requests', array[1::bigint],
  'staff vê os pedidos de deleção');
select lives_ok(
  $q$ insert into public.families (label) values ('Família C (teste staff)') $q$,
  'staff cria família nova');

-- ------------------------------------------------------------
-- T66..T67 — criança arquivada some do app, mas não da clínica
-- ------------------------------------------------------------
reset role;   -- volta a postgres (dono) para arquivar a criança A
update public.children set archived_at = now()
  where id = 'aaaaaaaa-0000-4000-a000-000000000002';

select tests.authenticate_as('mae_a');
select results_eq('select count(*) from public.children', array[0::bigint],
  'criança arquivada SOME para o responsável');

select tests.authenticate_as('betania');
select results_eq('select count(*) from public.children', array[2::bigint],
  'criança arquivada CONTINUA visível para o staff (registro clínico)');

select * from finish();
rollback;
