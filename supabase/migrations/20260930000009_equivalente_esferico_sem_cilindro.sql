-- Equivalente esférico só existe quando esfera E cilindro foram digitados.
-- Antes: sphere + coalesce(cylinder, 0)/2. Com o cilíndrico em branco, o banco
-- supunha astigmatismo zero e o app exibia um EE que a médica não registrou.
-- Agora qualquer um dos dois nulo deixa o EE nulo (exibido como "—").
-- Se "em branco" significar 0,00 para a clínica, o painel deve gravar 0,00.

alter table public.measurements
  alter column od_se set expression as (od_sphere + od_cylinder / 2);

alter table public.measurements
  alter column oe_se set expression as (oe_sphere + oe_cylinder / 2);
