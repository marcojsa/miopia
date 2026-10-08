-- Lumi para qualquer criança (docs/especificacao-lumi-geral.md, Banco, item 1).
-- Tipos novos de tratamento: colírio (1 a 6 vezes por dia) e lente de contato.
--
-- Fica num arquivo só dele: o Postgres não deixa usar um valor de enum na mesma
-- transação em que ele foi criado, e a CLI roda cada migration numa transação.
-- O que usa os valores novos está em 20261008000001_doses_e_rotina.sql.

alter type public.treatment_type add value if not exists 'colirio';
alter type public.treatment_type add value if not exists 'lente_contato';
