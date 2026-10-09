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
--   * doses e rotina  → colírio várias vezes ao dia (dose), rotina da criança
--                       (child_routines) e troca de regime por dose
--   * lente           → limite de horas de uso (max_wear_hours) e horário de
--                       tirar escolhido pela família (reminder_prefs.remove_time)
--
-- Pré-requisito: 00-test-helpers.sql (basejump/supabase_test_helpers
-- vendorizado) roda antes — o pg_prove ordena os arquivos por nome.
-- Tudo dentro de uma transação com rollback: o banco fica intacto.
-- ============================================================
begin;
select plan(115);

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
  public.family_invites, public.push_tokens, public.deletion_requests,
  public.child_routines, public.contents
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

select ok(has_table_privilege('authenticated', 'public.children', 'select'),
  'authenticated tem GRANT explícito (não depende de auto_expose)');
select has_trigger('public', 'reminder_prefs', 'reminder_prefs_set_updated_at',
  'reminder_prefs atualiza updated_at em todo update');

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
select throws_ok('select count(*) from public.child_routines',    '42501', null, 'anon: child_routines bloqueada');

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
select throws_ok(
  format($q$ insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id)
             values ('%s', 'Mãe A', 'cccccccc-0000-4000-a000-000000000001',
                     'aaaaaaaa-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_a')),
  '23505', null,
  'segundo aceite ATIVO do mesmo termo para a mesma criança é recusado');
select results_eq(
  $q$ with u as (
        update public.consents set revoked_at = now()
        where child_id = 'aaaaaaaa-0000-4000-a000-000000000002' and revoked_at is null
        returning 1)
      select count(*)::int from u $q$,
  array[1],
  'responsável A revoga o próprio consentimento');
select lives_ok(
  format($q$ insert into public.consents (user_id, guardian_name_snapshot, term_id, child_id)
             values ('%s', 'Mãe A', 'cccccccc-0000-4000-a000-000000000001',
                     'aaaaaaaa-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_a')),
  'depois de revogar, responsável A consegue autorizar de novo (revogação fica na trilha)');
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
select results_eq('select count(*) from public.consents', array[3::bigint],
  'staff lê todos os consentimentos (prova LGPD)');
select results_eq('select count(*) from public.family_invites', array[1::bigint],
  'staff vê os convites');
select results_eq('select count(*) from public.deletion_requests', array[1::bigint],
  'staff vê os pedidos de deleção');
select lives_ok(
  $q$ insert into public.families (label) values ('Família C (teste staff)') $q$,
  'staff cria família nova');

-- ------------------------------------------------------------
-- DOSES E ROTINA (docs/especificacao-lumi-geral.md)
-- Colírio várias vezes ao dia, rotina da criança e troca de regime por dose.
--   tratamento ...-04 = Colírio X (2x) da criança A
--   tratamento ...-05 = Colírio Y (3x) da criança A
-- ------------------------------------------------------------
reset role;   -- postgres: a prescrição é da clínica, aqui só interessa a regra do banco

select lives_ok(
  $q$ insert into public.treatments (id, child_id, type, name, times_per_day) values
        ('aaaaaaaa-0000-4000-a000-000000000004', 'aaaaaaaa-0000-4000-a000-000000000002',
         'colirio', 'Colírio X', 2),
        ('aaaaaaaa-0000-4000-a000-000000000005', 'aaaaaaaa-0000-4000-a000-000000000002',
         'colirio', 'Colírio Y', 3) $q$,
  'dois colírios diferentes ATIVOS para a mesma criança são aceitos');
select throws_ok(
  $q$ insert into public.treatments (child_id, type)
      values ('aaaaaaaa-0000-4000-a000-000000000002', 'atropina') $q$,
  '23505', null,
  'duas atropinas ativas para a mesma criança continuam RECUSADAS');
select throws_ok(
  $q$ insert into public.treatments (child_id, type, name, times_per_day)
      values ('aaaaaaaa-0000-4000-a000-000000000002', 'colirio', '  colírio x ', 4) $q$,
  '23505', null,
  'o MESMO colírio (mesmo nome) ativo duas vezes é recusado');
select throws_ok(
  $q$ insert into public.treatments (child_id, type, times_per_day)
      values ('bbbbbbbb-0000-4000-a000-000000000002', 'atropina', 2) $q$,
  '23514', null,
  'atropina continua 1 vez por dia (times_per_day > 1 é recusado)');

select tests.authenticate_as('mae_a');

select lives_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000004',
                     'aaaaaaaa-0000-4000-a000-000000000002', current_date, 1, 'feito', '%1$s'),
                    ('aaaaaaaa-0000-4000-a000-000000000004',
                     'aaaaaaaa-0000-4000-a000-000000000002', current_date, 2, 'pulado', '%1$s') $q$,
         tests.get_supabase_uid('mae_a')),
  'duas doses no mesmo dia para o mesmo tratamento são aceitas');
select results_eq(
  $q$ select count(*) from public.adherence_logs
      where treatment_id = 'aaaaaaaa-0000-4000-a000-000000000004' and log_date = current_date $q$,
  array[2::bigint],
  'as duas doses do dia ficaram gravadas');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000004',
                     'aaaaaaaa-0000-4000-a000-000000000002', current_date, 1, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  '23505', null,
  'a MESMA dose duas vezes no mesmo dia é recusada (23505)');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000004',
                     'aaaaaaaa-0000-4000-a000-000000000002', current_date, 3, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  '23514', null,
  'dose maior que o times_per_day do tratamento é RECUSADA');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
             values ('aaaaaaaa-0000-4000-a000-000000000003',
                     'aaaaaaaa-0000-4000-a000-000000000002', current_date - 1, 2, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_a')),
  '23514', null,
  'tratamento de 1 vez por dia (atropina) não aceita dose 2');

-- child_routines: preferência pessoal do responsável
select lives_ok(
  format($q$ insert into public.child_routines (guardian_user_id, child_id, wake_time, bed_time)
             values ('%s', 'aaaaaaaa-0000-4000-a000-000000000002', '06:30', '20:30') $q$,
         tests.get_supabase_uid('mae_a')),
  'responsável A grava a rotina da própria criança');
select results_eq('select count(*) from public.child_routines', array[1::bigint],
  'responsável A lê a própria rotina');
select results_eq(
  $q$ with u as (
        update public.child_routines set bed_time = '21:30'
        where child_id = 'aaaaaaaa-0000-4000-a000-000000000002'
        returning 1)
      select count(*)::int from u $q$,
  array[1],
  'responsável A atualiza a própria rotina');
select throws_ok(
  format($q$ insert into public.child_routines (guardian_user_id, child_id)
             values ('%s', 'bbbbbbbb-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_a')),
  '42501', null,
  'rotina para criança de OUTRA família é RECUSADA');
select throws_ok(
  format($q$ insert into public.child_routines (guardian_user_id, child_id)
             values ('%s', 'aaaaaaaa-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('mae_b')),
  '42501', null,
  'rotina com guardian_user_id de OUTRA pessoa é RECUSADA');
select throws_ok(
  $q$ update public.child_routines set bed_time = '06:00'
      where child_id = 'aaaaaaaa-0000-4000-a000-000000000002' $q$,
  '23514', null,
  'rotina com dormir antes de acordar é recusada');

select tests.authenticate_as('mae_b');
select results_eq('select count(*) from public.child_routines', array[0::bigint],
  'responsável B NÃO lê a rotina gravada pela mãe A');
select results_eq(
  $q$ with u as (
        update public.child_routines set wake_time = '05:00'
        where child_id = 'aaaaaaaa-0000-4000-a000-000000000002'
        returning 1)
      select count(*)::int from u $q$,
  array[0],
  'responsável B NÃO altera a rotina da família A (0 linhas afetadas)');

select tests.authenticate_as('betania');
select results_eq('select count(*) from public.child_routines', array[0::bigint],
  'staff NÃO lê child_routines (preferência pessoal do responsável)');
select throws_ok(
  format($q$ insert into public.child_routines (guardian_user_id, child_id)
             values ('%s', 'aaaaaaaa-0000-4000-a000-000000000002') $q$,
         tests.get_supabase_uid('betania')),
  '42501', null,
  'staff NÃO grava rotina de criança');

-- Troca de regime com doses: Colírio Z de 4x vira 2x no mesmo dia, com 3 doses
-- já registradas. "Hoje" é a data lógica do app (São Paulo, corte às 04h).
reset role;
insert into public.treatments (id, child_id, type, name, times_per_day, starts_on) values
  ('bbbbbbbb-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000002',
   'colirio', 'Colírio Z', 4,
   ((now() at time zone 'America/Sao_Paulo') - interval '4 hours')::date - 5);
insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
select 'bbbbbbbb-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000002',
       ((now() at time zone 'America/Sao_Paulo') - interval '4 hours')::date,
       d, 'feito', tests.get_supabase_uid('mae_b')
  from generate_series(1, 3) as d;
update public.treatments
   set active = false, ends_on = (now() at time zone 'America/Sao_Paulo')::date
 where id = 'bbbbbbbb-0000-4000-a000-000000000004';
insert into public.treatments (id, child_id, type, name, times_per_day, starts_on) values
  ('bbbbbbbb-0000-4000-a000-000000000005', 'bbbbbbbb-0000-4000-a000-000000000002',
   'colirio', 'Colírio Z', 2, (now() at time zone 'America/Sao_Paulo')::date);

select results_eq(
  $q$ select dose::int from public.adherence_logs
      where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000005' order by dose $q$,
  array[1, 2],
  'troca de regime 4x -> 2x: só as doses 1 e 2 do dia passam para o regime novo');
select results_eq(
  $q$ select dose::int from public.adherence_logs
      where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000004' order by dose $q$,
  array[3],
  'troca de regime 4x -> 2x: a dose 3 fica no regime encerrado, sem duplicar');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
             values ('bbbbbbbb-0000-4000-a000-000000000004',
                     'bbbbbbbb-0000-4000-a000-000000000002',
                     ((now() at time zone 'America/Sao_Paulo') - interval '4 hours')::date,
                     2, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_b')),
  '23505', null,
  'check-in da dose 2 pelo regime encerrado é redirecionado ao novo e não duplica');
select throws_ok(
  format($q$ insert into public.adherence_logs (treatment_id, child_id, log_date, dose, status, logged_by)
             values ('bbbbbbbb-0000-4000-a000-000000000004',
                     'bbbbbbbb-0000-4000-a000-000000000002',
                     ((now() at time zone 'America/Sao_Paulo') - interval '4 hours')::date,
                     4, 'feito', '%s') $q$,
         tests.get_supabase_uid('mae_b')),
  '23514', null,
  'dose 4 pelo regime encerrado: validada DEPOIS do redirecionamento (novo só tem 2)');

-- ------------------------------------------------------------
-- LENTE COM HORÁRIO PRÓPRIO E LIMITE DE HORAS DE USO
--   tratamento bbbbbbbb-...-06 = lente da criança B, no máximo 8 horas
--   tratamento bbbbbbbb-...-07 = lente nova (troca de regime), no máximo 10 horas
-- ------------------------------------------------------------
reset role;
select lives_ok(
  $q$ insert into public.treatments (id, child_id, type, instructions, max_wear_hours) values
        ('bbbbbbbb-0000-4000-a000-000000000006', 'bbbbbbbb-0000-4000-a000-000000000002',
         'lente_contato', 'no máximo 8 horas', 8) $q$,
  'lente de contato aceita o limite de horas de uso (max_wear_hours)');
select throws_ok(
  $q$ insert into public.treatments (child_id, type, max_wear_hours)
      values ('bbbbbbbb-0000-4000-a000-000000000002', 'atropina', 8) $q$,
  '23514', null,
  'max_wear_hours em atropina é RECUSADO (só lente de contato)');
select throws_ok(
  $q$ update public.treatments set max_wear_hours = 0
      where id = 'bbbbbbbb-0000-4000-a000-000000000006' $q$,
  '23514', null,
  'max_wear_hours abaixo de 1 é recusado');
select throws_ok(
  $q$ update public.treatments set max_wear_hours = 25
      where id = 'bbbbbbbb-0000-4000-a000-000000000006' $q$,
  '23514', null,
  'max_wear_hours acima de 24 é recusado');

select tests.authenticate_as('mae_b');
select lives_ok(
  format($q$ insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time, remove_time)
             values ('%s', 'bbbbbbbb-0000-4000-a000-000000000006', '07:30', '15:00') $q$,
         tests.get_supabase_uid('mae_b')),
  'responsável grava a hora de colocar e a de tirar (remove_time) na própria preferência');
select results_eq(
  $q$ select remove_time::text from public.reminder_prefs
      where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000006' $q$,
  array['15:00:00'],
  'responsável lê o remove_time que gravou');

-- Troca de regime da lente: a preferência (colocar e tirar) vai para a lente nova.
reset role;
update public.treatments
   set active = false, ends_on = (now() at time zone 'America/Sao_Paulo')::date
 where id = 'bbbbbbbb-0000-4000-a000-000000000006';
insert into public.treatments (id, child_id, type, instructions, max_wear_hours) values
  ('bbbbbbbb-0000-4000-a000-000000000007', 'bbbbbbbb-0000-4000-a000-000000000002',
   'lente_contato', 'no máximo 10 horas', 10);
select results_eq(
  $q$ select reminder_time::text || ' ' || remove_time::text from public.reminder_prefs
      where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000007' $q$,
  array['07:30:00 15:00:00'],
  'troca de regime da lente: carry_reminder_prefs leva reminder_time e remove_time para a lente nova');

-- Preferência que chega pela lente ENCERRADA (app com cache antigo) vai para a ativa.
select tests.authenticate_as('mae_b');
select lives_ok(
  format($q$ insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time, remove_time)
             values ('%s', 'bbbbbbbb-0000-4000-a000-000000000006', '08:00', '16:00')
             on conflict (guardian_user_id, treatment_id) do update
               set reminder_time = excluded.reminder_time, remove_time = excluded.remove_time $q$,
         tests.get_supabase_uid('mae_b')),
  'upsert pela lente encerrada, com preferência já existente na ativa, não falha');
select results_eq(
  $q$ select reminder_time::text || ' ' || remove_time::text from public.reminder_prefs
      where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000007' $q$,
  array['08:00:00 16:00:00'],
  'o upsert foi redirecionado: atualizou a preferência da lente ATIVA');
select results_eq(
  $q$ select reminder_time::text || ' ' || remove_time::text from public.reminder_prefs
      where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000006' $q$,
  array['07:30:00 15:00:00'],
  'a preferência da lente encerrada ficou como estava');

reset role;
delete from public.reminder_prefs where treatment_id = 'bbbbbbbb-0000-4000-a000-000000000007';
select tests.authenticate_as('mae_b');
select lives_ok(
  format($q$ insert into public.reminder_prefs (guardian_user_id, treatment_id, reminder_time, remove_time)
             values ('%s', 'bbbbbbbb-0000-4000-a000-000000000006', '09:00', '17:00')
             on conflict (guardian_user_id, treatment_id) do update
               set reminder_time = excluded.reminder_time, remove_time = excluded.remove_time $q$,
         tests.get_supabase_uid('mae_b')),
  'upsert pela lente encerrada, sem preferência na ativa, não falha');
select results_eq(
  $q$ select treatment_id::text || ' ' || reminder_time::text || ' ' || remove_time::text
        from public.reminder_prefs
       where treatment_id in ('bbbbbbbb-0000-4000-a000-000000000006',
                              'bbbbbbbb-0000-4000-a000-000000000007')
       order by treatment_id $q$,
  array['bbbbbbbb-0000-4000-a000-000000000006 07:30:00 15:00:00',
        'bbbbbbbb-0000-4000-a000-000000000007 09:00:00 17:00:00'],
  'a preferência nova nasceu na lente ATIVA; a da encerrada não mudou');

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

-- ------------------------------------------------------------
-- MURAL DE CONTEÚDOS
-- ------------------------------------------------------------
select tests.clear_authentication();
select throws_ok('select count(*) from public.contents', '42501', null, 'anon: contents bloqueada');

select tests.authenticate_as('dra_christiane');
select lives_ok($$insert into public.contents (id, title, youtube_url, category, published)
  values ('cccccccc-0000-4000-a000-000000000001', 'Vídeo publicado', 'https://youtu.be/abcdefghijk', 'lente', true)$$,
  'staff publica conteúdo com link do YouTube');
select lives_ok($$insert into public.contents (id, title, body, published)
  values ('cccccccc-0000-4000-a000-000000000002', 'Rascunho', 'texto', false)$$,
  'staff cria rascunho');
select throws_ok($$insert into public.contents (title, youtube_url) values ('Link ruim', 'https://exemplo.com/video')$$,
  '23514', null, 'link que não é do YouTube é recusado');

select tests.authenticate_as('mae_a');
select results_eq('select count(*) from public.contents', array[1::bigint],
  'responsável lê só o conteúdo publicado');
select throws_ok($$insert into public.contents (title, body) values ('Da família', 'x')$$,
  '42501', null, 'responsável NÃO cria conteúdo');
select is_empty($$update public.contents set title = 'alterado' where id = 'cccccccc-0000-4000-a000-000000000001' returning 1$$,
  'responsável NÃO edita conteúdo (0 linhas)');

select * from finish();
rollback;
