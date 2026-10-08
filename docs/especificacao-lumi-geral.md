# Lumi para qualquer criança: colírio várias vezes ao dia e lente de contato

Decisão do Marco em 08/10/2026. O Lumi deixa de ser só do protocolo de miopia e passa a
servir qualquer criança ou adolescente que pinga colírio todo dia ou usa lente de contato.
O acompanhamento do paciente adulto vai para outro app, depois.

## O que muda para a família

- **Rotina da criança.** O responsável informa a que horas a criança acorda e a que horas
  dorme. É a única configuração de horário que ele precisa fazer.
- **Colírio de 1 a 6 vezes por dia.** A Dra. cadastra o colírio com o nome e quantas vezes
  por dia. O app espalha os lembretes entre o acordar e o dormir: o primeiro ao acordar, o
  último antes de dormir e os outros a intervalos iguais no meio. Nunca durante o sono.
  Exemplo, acorda 7h e dorme 21h, 4 vezes: 7h, 11h40, 16h20 e 21h.
- **Lente de contato comum.** A Dra. escreve a regra de uso ("usar o dia todo", "no máximo
  8 horas"). O app lembra de colocar ao acordar e de tirar antes de dormir. O responsável
  pode ajustar os dois horários.
- **Tela Hoje.** Um cartão por dose do dia ("Colírio X, 2ª de 4, 11h40"), cada um com
  Feito e Não foi possível.
- **Céu.** A estrela da noite acende quando todas as doses e cuidados do dia foram feitos.
- **Aba Progresso.** Só aparece para a criança que tem medição de consulta lançada.
- **Textos.** Nada mais fala só de miopia: lembretes, cartões e termo de consentimento.

## O que muda para a clínica (painel)

- Tipos de tratamento: atropina, ortho-k, óculos, **colírio** e **lente de contato**.
- Campos novos no tratamento: **nome** (ex.: "Lubrificante X") e **vezes por dia** (1 a 6).
- A regra de uso da lente vai no campo de instruções que já existe.

## Banco

1. `treatment_type` ganha `colirio` e `lente_contato`.
2. `treatments` ganha `name text` e `times_per_day smallint not null default 1`
   (check 1 a 6). Atropina, ortho-k e óculos continuam em 1.
3. O índice "um ativo por tipo por criança" deixa de valer para `colirio`: a criança pode
   ter dois colírios diferentes ao mesmo tempo.
4. `adherence_logs` ganha `dose smallint not null default 1` (check 1 a 6). A chave única
   passa de (treatment_id, log_date) para (treatment_id, log_date, dose).
5. Nova tabela `child_routines` (guardian_user_id, child_id, wake_time, bed_time), escrita
   pelo responsável, com RLS igual à de `reminder_prefs`.
6. Os gatilhos de troca de regime (`carry_adherence_logs`, `redirect_adherence_to_active`)
   passam a considerar a dose.
7. `reminder_prefs` continua valendo para os tratamentos de 1 vez por dia. Para colírio de
   várias doses e para lente, os horários saem da rotina.

## Regras que não mudam

- ANVISA: o app registra e lembra. Não interpreta, não calcula, não sugere conduta.
- O dia continua virando às 4h da manhã.
- Check-in offline, correção da resposta e pausa de férias funcionam por dose.

## Fora deste trabalho

- Mural de vídeos da Dra. (tarefa MIO.7).
- Direcionar conteúdo por paciente.
- Lente com troca programada (quinzenal, mensal) e contagem de dias de uso.
