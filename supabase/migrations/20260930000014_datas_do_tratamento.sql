-- Datas do tratamento coerentes no banco, além da validação do painel.
-- Início com ano absurdo (ex.: 0202 digitado no lugar de 2026) e Fim anterior
-- ao Início (encerrar um tratamento que ainda não começou) eram aceitos.
-- NOT VALID: vale para toda linha nova ou alterada, sem barrar a migration por
-- linhas antigas já gravadas.

alter table public.treatments
  add constraint treatments_starts_on_plausivel
  check (starts_on >= date '2000-01-01') not valid;

alter table public.treatments
  add constraint treatments_ends_on_depois_do_inicio
  check (ends_on is null or ends_on >= starts_on) not valid;
