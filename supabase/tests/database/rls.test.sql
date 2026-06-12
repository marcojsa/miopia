-- ESQUELETO inicial vindo do design (designs[0].structure §3).
-- TODO: completar o seed das personas/famílias e substituir os placeholders
--       <child_a>/<betania> antes de rodar `supabase test db`.
-- Requer basejump/supabase_test_helpers instalado no banco de teste.
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
