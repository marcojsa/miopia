# API Externa do Klingo — referência (capturada 2026-06-12)

Fonte: https://app.swaggerhub.com/apis/agsx30/klingo-api-externa/1.0.0 (spec pública via api.swaggerhub.com — sem login)
Base URL: `https://api-externa.klingo.app/api`
Auth: header `X-APP-TOKEN` (nível app) + `Authorization: Bearer` (sessão do paciente)

## O que muda em relação à pesquisa de 10/06

A pesquisa original concluiu "nenhum endpoint de prontuário/refração documentado" — **continua verdade para o prontuário estruturado** (EE/cilindro/axial digitados pela médica NÃO são expostos; o painel manual do MVP continua sendo o caminho certo). MAS a doc completa revela um **fluxo de portal do paciente** que viabiliza a fase futura de integração:

- `POST /externo/portal/register` / `POST /externo/portal/login` — autenticação do paciente (email+senha), retorna `access_token` Bearer + dados do paciente.
- `GET /vouchers` — agendamentos do paciente: status (agendado/atendido/checkin), data/hora, profissional, unidade, procedimento, especialidade.
- `GET /resultado/{id_marcacao}` — **resultado estruturado de exame (laudo)**: `id_laudo`, `dt_atendimento`, `procedimento`, `status`, `pronto` (bool), `medico`, `unidade`, **`resultado_html`** (conteúdo do laudo em HTML), `resultado_pdf` (base64), `anexos`.
- `GET /resultado/pdf/{id_marcacao}` e `/resultado/pdf/an/{accession_number}` — PDFs de laboratório/imagem.
- `GET /atendimentos` — atendimentos clínicos por data (paciente, médico, plano, procedimentos).

## Implicações para o app de miopia (fase futura, NÃO mexe no MVP)

1. **Sync de consultas**: via portal-login do responsável + `/vouchers`, o app poderia mostrar/lembrar a próxima consulta e detectar consulta realizada (gatilho para "resultados disponíveis") sem digitação da Betânia.
2. **Laudos**: se a clínica emitir laudos de exames (ex. biometria/refração) no Klingo, `resultado_html` pode conter os valores — exibir o laudo oficial da médica é ANVISA-safe (conteúdo autoral dela). Extrair números do HTML para alimentar o gráfico automaticamente é possível mas frágil — avaliar na fase Klingo com exemplos reais de laudo da Dra.
3. **Medições do prontuário continuam manuais**: nada na API expõe refração/axial estruturados do prontuário. A decisão do MVP (painel próprio) permanece correta.
4. Perguntar ao Daniel/Klingo: como obter `X-APP-TOKEN` próprio da clínica; se o webhook (`POST /webhook-configurado`, status de agendamento) está disponível para integradores.

## Endpoints completos (resumo)

Agendamento: `GET /agenda/horarios`, `POST /agenda/horario` (confirma), `POST/DELETE /agenda/reservar`, `PUT /agenda/procedimento`, `GET /agenda/verificar_horario`, `GET /agenda/consultas|especialidades|exames|profissionais`, `GET /agenda/horario_procedimentos`
Paciente: `GET/PUT /paciente`, `POST /paciente/identificar` (por telefone), `GET /paciente/cpf`, `POST /externo/register|login`
Portal: `POST /externo/portal/register|login|recuperar`
Consultas/resultados: `GET /atendimentos`, `GET /vouchers`, `DELETE /voucher` (cancela), `GET /resultado/{id_marcacao}` (+ variantes PDF), `GET /requisicao`
Operacional: `POST/DELETE /checkin`, `GET /convenios`, `GET /convenio/{cnpj}`, `GET /unidades`, `GET /profissionais|profissional`, `GET /preco|precos`, `GET /formas_de_pagamento`, `GET /adiantamentos`, `POST /adiantamento`, `GET /regiao_cd`, `GET /live` (status)
Webhook: `POST /webhook-configurado` (atualização de status de agendamento)

## Implicações para a Iris (Kualiz)

As 7 funções ativas no Kualiz cobrem só uma fração. Candidatos a função nova (negociar com Daniel): `reservar` (segura o slot durante a coleta de dados — evita perder horário), `verificar_horario`, `preco/precos` (em vez do anexo de valores?), `checkin`, `voucher` (cancelamento direto). A instabilidade observada de madrugada é da API externa (`api-externa.klingo.app`) — citar nos reports.
