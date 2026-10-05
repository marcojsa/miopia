# Decisões pendentes do Lumi (levantadas no teste de 30/09 a 05/10/2026)

Bugs que não dá para corrigir sem uma decisão do Marco ou da Dra. Cada um traz uma recomendação.

## Para a Dra. (clínico e regulatório)

- **Secretária grava avaliação clínica.** Hoje qualquer pessoa da equipe pode escolher o status ("Controle adequado" etc.) e o app mostra como avaliação da médica, com CRM. Recomendação: só a médica grava status e recado; a secretária digita os números e a medição fica "aguardando avaliação".
- **Recado para a família é opcional no painel.** O app trata o recado como o card principal. Recomendação: obrigatório quando houver status.
- **O que a família vê antes de consentir.** O banco já entrega os tratamentos de uma criança nova antes do aceite LGPD (o app esconde, mas o dado trafega). Recomendação: bloquear no banco até haver consentimento.

## Para o Marco (produto e publicação)

- **Nome da aba: "Progresso" ou "Evolução".** A aba diz uma coisa, a tela diz outra. Recomendação: "Evolução" nos dois.
- **Ícone e tela de abertura.** O APK usa o ícone e o splash do modelo do Expo. Precisa da arte do Lumi (coruja) em PNG.
- **Projeto Supabase de produção.** O antigo sumiu. Criar um novo, de preferência na conta da clínica, região São Paulo. Sem ele, os perfis de build de loja abrem o app e fecham na hora.
- **Conta para builds.** O EAS está na conta pessoal marcojsa. Decidir se migra para a conta da clínica antes da loja.
