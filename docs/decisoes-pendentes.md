# Decisões pendentes do Lumi (levantadas no teste de 30/09 a 05/10/2026)

Bugs que não dá para corrigir sem uma decisão do Marco ou da Dra. Cada um traz uma recomendação.

## Para a Dra. (clínico e regulatório)

- **Secretária grava avaliação clínica.** Hoje qualquer pessoa da equipe pode escolher o status ("Controle adequado" etc.) e o app mostra como avaliação da médica, com CRM. Recomendação: só a médica grava status e recado; a secretária digita os números e a medição fica "aguardando avaliação".
- **Recado para a família é opcional no painel.** O app trata o recado como o card principal. Recomendação: obrigatório quando houver status.
- **Equivalente esférico com o cilíndrico em branco.** O banco passou a deixar o EE vazio quando falta o cilíndrico (antes supunha 0,00). Confirmar: se "em branco" significa sem astigmatismo, o painel deve gravar 0,00 explicitamente.
- **O que a família vê antes de consentir.** O banco já entrega os tratamentos de uma criança nova antes do aceite LGPD (o app esconde, mas o dado trafega). Recomendação: bloquear no banco até haver consentimento.

## Para o Marco (produto e publicação)

- **Nome da aba: "Progresso" ou "Evolução".** A aba diz uma coisa, a tela diz outra. Recomendação: "Evolução" nos dois.
- **Ícone e tela de abertura.** O APK usa o ícone e o splash do modelo do Expo. Precisa da arte do Lumi (coruja) em PNG.
- **Projeto Supabase: feito em 07/10/2026.** Projeto "Lumi" (ref ghfsnwrrkpclkdiogbtc, São Paulo), plano grátis, com as 16 migrations, as duas funções e a família de demonstração. Falta decidir: (a) quem paga o plano Pro quando entrarem famílias reais (o grátis pausa após 7 dias sem uso); (b) serviço de e-mail próprio (ex.: Resend) — sem ele os e-mails de convite saem em inglês e só chegam a membros da conta; (c) apagar os usuários de demonstração (@example.com) antes do piloto.
- **Conta para builds.** O EAS está na conta pessoal marcojsa. Decidir se migra para a conta da clínica antes da loja.
- **Registros de cuidado na exclusão de conta.** Decidido seguir a matriz do design-backend §5: os check-ins ficam no histórico da criança, sem autoria (logged_by vira nulo). Os textos do app foram alinhados a isso. Se a decisão mudar para apagar, a delete-account precisa de `delete from adherence_logs where logged_by = user.id` antes do deleteUser, e os textos voltam a dizer "apagados".
