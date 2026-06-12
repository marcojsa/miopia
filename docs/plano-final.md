# Plano — App de Controle da Miopia · Clínica Alto de Pinheiros

> **Status: FINAL** — pesquisa de viabilidade (25 agentes, 5 frentes + verificação adversarial) e design (3 perspectivas: backend/dados, mobile/notificações, produto/UX) concluídos.
> Artefatos completos dos workflows (schema SQL integral, árvore de telas, wireframes): `%LOCALAPPDATA%\Temp\claude\...\tasks\w8ubbmbhy.output` (pesquisa) e `wtc1hw9fg.output` (design) — copiar para a pasta do projeto na primeira sessão de implementação, antes que o Temp seja limpo.

## Contexto

Marco (consultor da Oftalmologia Alto de Pinheiros) quer um app mobile **nativo nas duas lojas** para pacientes do tratamento de controle da progressão da miopia infantil. O usuário do app é o **responsável** (paciente é criança, geralmente sem celular). Funções: dashboard de evolução do tratamento (grau e comprimento axial desde o início e desde a última consulta), lembretes de colírio (atropina, noturno) e de colocar/tirar lente (ortho-k), e gamification da adesão. A médica insere os dados clínicos no Klingo (gestão da clínica); a integração automática é desejada mas incerta.

Antes de construir, Marco pediu **avaliação honesta de viabilidade** — incluindo se vale usar Lovable ou não.

## Decisões já tomadas (com Marco, 10/06/2026)

1. **MVP sem integração Klingo** — a clínica digita os dados clínicos num painel administrativo do próprio produto (poucos campos, 2–3×/ano por paciente). Integração Klingo é fase futura, condicionada ao que a pesquisa revelar sobre a API.
2. **Sem Lovable** — Claude Code constrói o app direto (React Native/Expo) e o backend (Supabase) com código próprio do Marco/clínica. Compromisso assumido: etapa dedicada de design visual com mockups aprovados pelo Marco antes de codar telas.
3. **Custo total documentado antes de decidir quem banca** — planilha completa de custos (setup + recorrentes) neste plano; decisão clínica × Marco fica para depois da leitura.
4. **Piloto fechado primeiro** — MVP enxuto distribuído via TestFlight (iOS) e Internal Testing (Android) para 5–10 famílias reais antes de publicação pública nas lojas.

## Veredito de viabilidade: VIÁVEL

Resultados da pesquisa (5 frentes, com verificação adversarial das alegações críticas):

**Lovable — descartado com evidência (decisão do Marco validada):**
- Lovable é confirmadamente **web-only** em 2026 (docs oficiais: "exclusively a web-only platform") — não gera binário nativo (.ipa/.apk). O plano original nem produziria app de loja sem wrapper de terceiros. [verificado: refutada a capacidade nativa]
- Segurança desqualificante para dados de saúde de menores: **CVE-2025-48757** (CVSS 8.26) — RLS desligado por padrão, 170+ apps expostos; novo incidente em fev/2026 expôs 18.696 usuários (4.538 menores). [verificado: confirmada]
- Claude Code + Expo + Supabase direto: stack validada para dev solo, melhor manutenibilidade. [verificado: confirmada]

**Klingo — sem acesso a dados clínicos via API (MVP sem Klingo confirmado):**
- API existe (Swagger em SwaggerHub `agsx30/klingo-api-externa`, SDK Node `ValleSaude/klingo-node-sdk`) mas cobre só agendamento/cadastro/valores — **nenhum endpoint de prontuário/refração documentado**. Sem programa oficial de integradores, sem FHIR/HL7.
- API instável de madrugada (falhas 00:04–00:48 em 10/06, observadas em primeira mão nos testes Kualiz).
- Caminho: clínica digita dados no painel do produto. Perguntar ao Daniel/Klingo sobre endpoint de prontuário fica como trilha paralela sem bloquear nada. *(verificações desta frente falharam por limite de sessão — mas as alegações batem com o mapeamento em primeira mão do `portal-mapa.md`, risco baixo)*

**Expo/lojas — viável imediatamente, 3 descobertas importantes:**
- **Apple guideline 5.1.1(ix): app de saúde DEVE ser submetido por pessoa jurídica** — conta de organização no CNPJ da clínica é obrigatória, não opcional. D-U-N-S leva ~5 dias úteis. [verificado]
- Google Play exige conta de organização para health apps (política de jan/2026) + Health Apps Declaration Form + restrições severas de uso de dados de saúde. [verificado, deadline exato incerto]
- Lembretes Android: dois problemas independentes a tratar — canal de notificação dedicado (senão cai em 'Miscellaneous' silencioso) e alarmes exatos (Android 14+ nega por padrão). iOS: limite de 64 notificações locais pendentes. [verificado, com correção técnica incorporada]
- Timeline realista da frente: ~3 meses até piloto TestFlight, 4-5 meses até loja pública.

**Regulatório — melhor que o esperado:**
- **ANVISA**: app de uso exclusivo in-house da clínica **dispensa registro/notificação** (exceção art. 5º IV, RDC 657/2022) — piloto liberado. Condição inegociável de design: o app só EXIBE dados e adesão; **toda interpretação clínica ("controle adequado/atenção") é campo preenchido pela médica**, nunca calculado pelo app. Se um dia for comercializado para outras clínicas: notificação Classe I/II (~30 dias), não 6-12 meses. [verificado, com nuance importante]
- **LGPD**: consentimento específico e em destaque de **pelo menos um dos pais** (art. 14 §1º + Enunciado ANPD nº 1/2023) no onboarding; dados de saúde são sensíveis (art. 11); account deletion in-app (exigência Apple desde 2022). [verificado]
- Residência de dados no Brasil **não é exigência legal** — mas usaremos Supabase região São Paulo de toda forma (risco zero). [verificado: refutada a exigência]

**Produto — nicho real, com lições:**
- Concorrência: **Mioview** (Brasil, conecta médico-pais-óticas) existe; vision.app/myopia.app são rastreadores de hábito digital. Diferencial nosso: ferramenta da própria clínica, dados clínicos reais (axial), adesão ativa, relação com a Dra.
- **Comprimento axial (mm) confirmado como padrão-ouro** de progressão; dashboard mostra axial + equivalente esférico, por olho.
- Gamification: lembretes melhoram adesão em +23% (evidência); progresso visual/avatares positivos; **streaks rígidos causam abandono** — mecânica precisa perdoar doença/férias; leaderboards sem evidência em crianças.
- Retenção B2C de apps de saúde é brutal (3-12% D30) — mas este app é **B2B2C ancorado na clínica** (a clínica recaptura o paciente a cada consulta trimestral), o que muda a dinâmica. Métrica de sucesso do piloto: adesão aos lembretes e percepção da Dra., não download.
- Oportunidade estratégica (fora do escopo deste plano): se o piloto funcionar, o produto é replicável para as outras 3 clínicas do grupo — e vendável como produto B2B. *(verificações desta frente falharam por limite de sessão; alegações de retenção são plausíveis mas não-verificadas — não são load-bearing para o piloto)*

## Arquitetura

**Monorepo** com 3 pacotes compartilhando tipos gerados por `supabase gen types typescript`:

1. **App do responsável** — Expo (React Native, TypeScript), expo-router com grupos `(auth)/(app)`, 4 tabs: **Hoje** (home: check-ins pendentes de todos os filhos), **Céu** (gamification, tela da criança), **Evolução** (dashboard clínico por filho), **Mais** (Aprender, Família, Conta/deleção). Estado: TanStack Query + supabase-js com cache persistido em AsyncStorage (dashboard abre offline); Zustand só para UI efêmera. Dev build EAS desde a semana 1 (Expo Go só para scaffolding — notificações reais exigem dev build).

2. **Backend Supabase** (região São Paulo) — Postgres + RLS em 100% das tabelas, zero acesso anônimo. Mapa de entidades:
   `staff` (medica|secretaria|admin) · `families` → `guardians` (N responsáveis/família) → `children` (sem CPF/foto; avatar preset; `archived_at`) → `treatments` (prescrição, só staff escreve: tipo atropina|ortho_k|oculos_lentes, horário sugerido, dias) → `adherence_logs` (check-ins, UNIQUE(treatment,data), janela retroativa de 7 dias na policy) e `measurements` (por olho: esfera/cilindro → EE em coluna GENERATED, axial mm com CHECK 15–35, **`status` enum digitado pela médica** + `doctor_note`, UNIQUE(child,data)) · `reminder_prefs` (horário real do lembrete, POR RESPONSÁVEL — separa prescrição de preferência e resolve RLS de escrita) · `consent_terms` (texto integral versionado + hash) → `consents` (aceite POR CRIANÇA, snapshot do nome, sobrevive à deleção) · `family_invites`, `push_tokens`, `deletion_requests`.
   RLS via helpers SECURITY DEFINER em schema `private` (`is_staff()`, `is_my_family()`, `can_see_child()`, search_path vazio). Responsável: lê a própria família, escreve APENAS adesão/lembretes/consentimento; staff: acesso operacional total; medições são read-only para a família por ausência de policy de escrita.
   **Edge Functions: só 2 no MVP** (`invite-family`, `delete-account` — as únicas que precisam de service role) + `notify-new-measurement` na fase 2. Todo o resto é PostgREST + RLS.

3. **Painel da clínica** — SPA separada: Vite + React + TS + supabase-js, deploy estático gratuito (Vercel/Cloudflare Pages). Usuárias: Dra. e Betânia, desktop. Telas: login staff, famílias/crianças, tratamentos, **formulário de medição pós-consulta** (com confirmação dupla e validação de faixa — erro de digitação de axial assusta família), avaliação textual da Dra., convites. Fora do app Expo de propósito: não inflar o binário revisado pela Apple nem a superfície de ataque.

**Auth (invite-only):** auto-cadastro DESATIVADO. Betânia pré-cadastra família/filhos/tratamento no painel → Edge Function convida por e-mail → responsável instala o app (orientado na recepção: instalar ANTES do convite), entra com e-mail + OTP/senha → primeiro login cai no consentimento LGPD bloqueante → home já semeada com a consulta-base. SMTP custom (Resend, free) configurado ANTES do piloto — o SMTP default do Supabase é rate-limitado (~3/h) e mataria o onboarding.

**Sistema de lembretes (coração do produto):**
- Notificações **locais repetitivas diárias** (`repeats: true`) — 1 slot iOS permanente por lembrete; pior caso 3 filhos × 3 lembretes = 9 de 64 slots. Sem janela rolante (exigiria abrir o app semanalmente para reagendar — falha catastrófica). Conteúdo estático; celebração dinâmica fica na tela Hoje. *(Resolve a divergência entre as perspectivas mobile e produto a favor da mobile.)*
- Android: canal dedicado `lembretes-tratamento` (importância MAX) criado no startup + canal `clinica` (DEFAULT) — sem channelId explícito cai no 'Miscellaneous' silencioso. **Alarme INEXATO** (janela ~10min é clinicamente ok para colírio): não pedir SCHEDULE_EXACT_ALARM (Android 14+ nega por padrão) nem USE_EXACT_ALARM (restrita por política do Play a apps de relógio — risco de rejeição). Mitigação de battery killers OEM (Xiaomi/Samsung): tela "Lembretes atrasando?" + levantar os aparelhos das famílias do piloto antes.
- Identifier determinístico `${childId}:${tipo}`, reconciliação declarativa (`syncSchedulesForFamily()` compara desejado×pendente, ajusta o delta). Consolidação por horário: filhos com mesmo horário compartilham 1 notificação ("Hora do cuidado: Alice e Pedro") — máx. 3 toques/dia por família.
- Check-in de 1 toque **na própria notificação** ('Feito' / 'Não foi possível') com outbox local em AsyncStorage + sync idempotente (upsert por client_id). Validar o handling em background em aparelho físico na semana 1; fallback aceitável: ação abre sheet rápida no app. Check-in retroativo até 12h (noite registrável até meio-dia seguinte); corte da "noite": até 04h conta como dia anterior.
- Push remoto (Expo Push, grátis): MVP só registra o token + 1 caso de uso ("os resultados da consulta estão disponíveis", disparado quando a clínica salva medições). Resto fica pra v2.

## Produto e UX (corte do MVP)

**Conceito:** dois loops de frequências diferentes. O **loop noturno diário** (atropina e ortho-k acontecem ao deitar) sustenta a retenção: lembrete confiável + check-in de 1 toque + recompensa visual. O **loop trimestral** (consulta) sustenta o valor percebido: dados novos + a palavra da Dra. O universo visual é um **céu noturno**: cada noite de cuidado acende uma estrela; mascote coruja (enxerga no escuro); a criança vê o app no celular do pai — telas de celebração NUNCA exibem números clínicos.

- **IN (MVP):** onboarding 7 passos (código de convite → e-mail OTP → consentimento em camadas com aceite de saúde destacado e separado → confirmação dos filhos → horários → primer de notificação → dashboard semeado) · tab Hoje · Céu (estrelas mensais, constelações em 7/30/90 noites, Diploma do Cuidado aos 90 dias — sem dado clínico) · Evolução (cards "desde a última consulta"/"desde o início" por olho + gráfico de linha com toggle Grau|Comprimento do olho, pontos como herói, **tinta neutra, zero verde/vermelho/setas/médias** — ANVISA; única interpretação: card "Avaliação da Dra. Christiane" com texto dela, datado e assinado com CRM/RQE) · bottom sheet explicando axial pra leigo ("o tamanho do olho em mm; quem avalia o ritmo é a Dra.") · Aprender (5-6 cards estáticos aprovados pela Dra.) · streak perdoador: **escudos** (1 a cada 7 noites, máx. 3, absorvem falha automaticamente), **modo férias** (noites viram nuvens), **pausa clínica** (médica suspende pelo painel, selo "pausa orientada pela Dra.") · adesão exibida como meta semanal ("5 de 7 noites"), nunca streak seco.
- **OUT explícito (v2+):** integração Klingo, chat (WhatsApp/Iris já resolve), agendamento, segundo responsável com conta própria (schema já suporta; UX fica pra depois), avatar customizável, pontos/loja/leaderboard, fotos/diário, exportação PDF, curvas de percentil (vetadas até reavaliação ANVISA), CMS, push de marketing.
- **Nome do app:** recomendação **Lumi** (vira o nome da coruja; loja: "Lumi | Oftalmologia Alto de Pinheiros"). Alternativas: Mirante, Horizonte, Noctua, Foco. **Veto: "Íris"** (colide com a IA de WhatsApp da clínica). Aprovação da Dra. pendente.
- **Direção visual:** roxo profundo #453A94 como primária/céu noturno, amarelo-estrela #FFC857 exclusivo de conquistas, verde sóbrio #88B04B em confirmações, dados clínicos em tinta neutra; Nunito/Quicksand (títulos) + Inter tabular (números); ilustração flat, zero fotos de crianças. Mockups para aprovação do Marco antes de codar telas (compromisso assumido).

## Custos (verificados na pesquisa, junho/2026)

| Item | Custo | Quando | Obrigatório? |
|---|---|---|---|
| Apple Developer Program (organização, CNPJ da clínica) | **US$ 99/ano** | antes do TestFlight | Sim — e PJ é exigência da Apple p/ saúde (5.1.1) |
| D-U-N-S Number (pré-requisito Apple org) | grátis | ~5 dias úteis, pedir cedo | Sim |
| Google Play Console (organização) | **US$ 25 único** | antes do Internal Testing | Sim (org p/ health apps) |
| Supabase | **grátis** (free tier: 500MB DB, 50k MAU) | desde o início | Pro US$ 25/mês só se escalar — piloto não precisa |
| EAS Build | **grátis** (15 builds/mês, timeout 45min) | fase de builds | Starter US$ 19/mês se o free apertar (provável em sprint intenso) |
| Expo Push / notificações locais | grátis | — | — |
| Hospedagem do painel da clínica (Vercel/Netlify free) | grátis | fase 2 | — |
| **Total 1º ano (cenário base)** | **~US$ 124** (~R$ 660) | | |
| **Total 1º ano (cenário com EAS Starter 5 meses)** | **~US$ 220** (~R$ 1.170) | | |

Ajustes pós-design: **Resend** (SMTP dos convites/OTP) tem free tier suficiente pro piloto; **Supabase Pro (US$ 25/mês) recomendado a partir do piloto** (free tier pausa projeto após ~1 semana sem atividade + Pro traz backups — com famílias reais, vale). Cenário piloto completo: ~US$ 345 no 1º ano (~R$ 1.850).

Recorrente a partir do 2º ano: US$ 99/ano (Apple) + Supabase/EAS conforme uso. **Decisão pendente do Marco: quem banca** — recomendação continua sendo a clínica (é exigência prática: as contas têm que estar no CNPJ dela de qualquer jeito, e a Apple exige PJ para app de saúde). Nenhum centavo precisa ser gasto antes da Fase 0 (validação com a Dra.) — desenvolvimento e protótipo em emulador custam zero.

## Regulatório — checklist obrigatório do MVP

1. **Consentimento LGPD no onboarding**: específico e em destaque, de pelo menos um dos pais (art. 14 §1º), registrado com timestamp + versão do termo. Texto curto e claro, não wall of text.
2. **Política de privacidade** publicada (URL exigida pelas duas lojas): o que coleta, por quê, dados sensíveis de menores, direitos do titular, contato do encarregado (a clínica indica — pode ser a própria Dra. num piloto).
3. **Account deletion in-app** (Apple): apaga conta/dados do app; medições clínicas pertencem ao prontuário da clínica (Klingo) e não são afetadas — deixar isso explícito no termo.
4. **Design ANVISA-safe (condição estrutural)**: o app exibe dados e registra adesão; **nunca calcula risco nem emite juízo clínico** — o status de cada consulta ("controle adequado" / "atenção") é selecionado pela médica no painel e exibido como avaliação dela.
5. **Lojas**: Health Apps Declaration (Google) + disclaimer "este app não é um dispositivo médico"; privacy nutrition labels (Apple) e Data Safety form (Google) preenchidos como health data, sem compartilhamento com terceiros.
6. **Infra**: Supabase região São Paulo (sa-east-1). Sem necessidade legal de residência, mas elimina a discussão.
7. **Minimização**: não coletar CPF da criança; só nome/apelido + data de nascimento. Responsável: nome, e-mail, telefone.

## Fases de implementação

**Fase 0 — Proposta e contas (caminho crítico burocrático — iniciar JÁ, roda em paralelo com tudo):**
Marco apresenta o projeto à Dra. (proposta com custos acima); decidido o GO: pedir **D-U-N-S do CNPJ** (grátis, ~5 dias úteis) → enrollment **Apple Developer Organization** (pode levar 1-4+ semanas, com verificação por telefone — se não começar agora vira O gargalo do cronograma) → **Google Play Console org** (US$ 25). Confirmar se Marco tem acesso a um iPhone físico de teste. Criar repo (monorepo) + projeto Supabase região São Paulo.

**Fase 1 — Fundação backend (1-2 semanas):**
`supabase init` + migration única (schema da seção Arquitetura) + seed (staff + 1 família fake), 100% local com `supabase start`. **Testes de RLS ANTES de qualquer UI** (3 camadas — ver Verificação). Edge Function `invite-family` + SMTP Resend. `supabase gen types`.

**Fase 2 — Design visual (1 semana, parcialmente paralela à Fase 1):**
Identidade (paleta/tipografia/coruja), mockups das telas-chave (Hoje, Céu, Evolução, onboarding/consentimento, formulário do painel). **Gate: aprovação do Marco** (e nome do app com a Dra.).

**Fase 3 — Painel da clínica (1-2 semanas):**
Vite SPA: login staff → CRUD famílias/crianças/tratamentos → formulário de medição (validação de faixa + confirmação dupla) → avaliação textual da Dra. (com frases-modelo dela) → convites. Critério de pronto: Betânia consegue cadastrar família e lançar consulta em ≤ 5 min sem ajuda.

**Fase 4 — App Expo (3-4 semanas):**
Semana 1: scaffolding (Expo Go) → **dev build físico imediato** → validar o item de maior risco técnico: ações de check-in na notificação em background (iOS e Android), antes de construir o resto em cima. Depois: onboarding completo com consentimento LGPD → tab Hoje + check-in + outbox/sync → módulo de lembretes (canais, reconciliação, consolidação) → Evolução (gráficos) → Céu (estrelas/escudos/férias) → Aprender → deleção de conta in-app (Edge Function `delete-account`) — desde o primeiro build de TestFlight, não "depois".

**Fase 5 — Hardening e preparação do piloto (1-2 semanas):**
Builds preview → TestFlight + Play Internal Testing; conta demo com dados fictícios pro revisor da Apple; termo de consentimento revisado pelo advogado da clínica (paraleliza desde a Fase 1 — bloqueia o piloto, não o dev); política de privacidade publicada; levantar aparelhos das famílias (battery killers); roteiro de onboarding da recepção (instalar app ANTES do convite); seed de medições retroativas se a clínica tiver histórico.

**Fase 6 — Piloto fechado (8-10 semanas de janela de avaliação):**
5-10 famílias. Métricas e gate: adesão mediana ≥ 70% das noites (semanas 2-8, excluindo lua de mel), retenção D30 ≥ 7/10 famílias ativas, funil de onboarding ≥ 90%, crash-free ≥ 99%, entrevistas de 20 min no D30, esforço do painel sustentável pra Dra./Betânia (≤ 5 min/consulta). **Não adicionar features no meio do piloto** (mascararia a medição do vale do tédio).

**Fase 7 — Lojas públicas (condicionada ao gate):**
Health Apps Declaration (Google) + disclaimer "não é dispositivo médico", privacy labels (Apple), Data Safety (Google), review. Estimativa total pesquisada: 4-5 meses do zero à loja.

**Fase futura — Klingo e expansão:** integração automática se/quando o acesso à API de prontuário existir (trilha paralela: perguntar a Daniel/Klingo sem bloquear nada); replicação para as outras 3 clínicas do grupo exige notificação ANVISA Classe I/II (~30 dias) — deixa de ser "uso in-house".

## Verificação

- **RLS (gate da Fase 1):** pgTAP via `supabase test db` em CI (personas: anon=0 linhas em TUDO; responsável A não lê família B nem insere medição; staff lê tudo) + impersonação rápida via `set_config('request.jwt.claims')` no SQL editor + smoke test supabase-js com 4 personas contra `supabase start`. Security Advisor do dashboard a cada migration (SECURITY DEFINER sem search_path é o risco técnico nº 1).
- **Notificações (gate da Fase 4, semana 1):** matriz em aparelho físico — Android 14+ (canal toca? sobrevive a Doze? ação de check-in grava no outbox?) e iOS (repetitiva dispara? ação em background ou via getLastNotificationResponseAsync?). Se ação em background for instável → fallback sheet, documentado.
- **E2E pré-piloto:** fluxo completo real — Betânia cadastra família no painel → convite chega (Resend) → onboarding + consentimento → lembrete dispara à noite → check-in → estrela acende → clínica lança medição → push "resultados disponíveis" → dashboard atualiza → deleção de conta executa a matriz LGPD (apaga/anonimiza/retém).
- **Piloto = verificação final do produto** (métricas e gate da Fase 6).

## Perguntas em aberto (não bloqueiam o início — levar à Dra. na Fase 0)

1. Quem opera o painel: Betânia digita medidas e a Dra. só escreve a avaliação? (proposta recomendada)
2. Avaliação da Dra.: texto livre ou conjunto de frases-modelo dela? (frases-modelo evitam gargalo operacional)
3. Esfera+cilindro digitados (EE calculado) ou EE pronto da receita? (afeta 1 coluna da migration)
4. Histórico retroativo: digitar 2-3 consultas antigas por criança pro gráfico nascer com tendência?
5. Famílias só com óculos/lentes especiais entram no piloto?
6. Horários de fim de semana diferentes (criança dorme mais tarde)? Se sim, 2 triggers por lembrete — ainda longe do limite de 64.
7. Nome do app (Lumi?) e mascote — aprovação da Dra.
8. Advogado da clínica para o termo LGPD + quem será o encarregado (DPO) nomeado.

## Riscos principais (resumo)

- **Burocracia Apple (D-U-N-S + org enrollment)** é o caminho crítico — começar na Fase 0, não quando o app estiver pronto.
- **Battery killers Android (Xiaomi/Samsung)** podem matar lembretes — levantar aparelhos do piloto antes; tela de troubleshooting no app.
- **Scope creep ANVISA**: qualquer cor semafórica, seta, média ou percentil no dashboard reclassifica o app como SaMD — revisar cada release com essa lente; documentar a regra por escrito com a Dra.
- **Gargalo operacional da clínica**: se a Dra. não alimentar o painel, o app morre — frases-modelo + medir o esforço no piloto.
- **Termo LGPD depende de advogado** (não é entregável de dev) — disparar cedo.
- **Auto-relato infla adesão** — apresentar o dado à Dra. como relato da família, não medida objetiva.
