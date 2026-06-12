# Plano (RECUPERADO) — App de Controle da Miopia · Clínica Alto de Pinheiros

> **Status: FINAL — recuperado integralmente da sessão de 10/06/2026** que caiu com a queda de energia.
> A pesquisa de viabilidade (25 agentes, 5 frentes + verificação adversarial) e o design (3 perspectivas: backend/dados, mobile/notificações, produto/UX) **sobreviveram no disco** e foram verificados nesta sessão:
> - Plano final anterior: `C:\Users\User\.claude\plans\agora-estou-pensando-em-gentle-crab.md`
> - Pesquisa completa (54 KB): `C:\Users\User\AppData\Local\Temp\claude\C--Users-User-OneDrive-Documents-Claude-Code\fb37ccf0-cd43-4ca8-b4d8-05aa3ea7a050\tasks\w8ubbmbhy.output`
> - Design completo (92 KB — schema SQL integral, árvore de telas, wireframes): `...\fb37ccf0-cd43-4ca8-b4d8-05aa3ea7a050\tasks\wtc1hw9fg.output`

## Passo 0 — RESGATE IMEDIATO (primeira ação ao sair do plan mode)

Os dois `.output` estão em `%LOCALAPPDATA%\Temp`, que o Windows pode limpar a qualquer momento. Antes de qualquer outra coisa:
1. Criar a pasta do projeto e copiar para dentro dela: os 2 artefatos de workflow + o plano final anterior (`agora-estou-pensando-em-gentle-crab.md`) como `docs/` do projeto.
2. **Local do repo (decisão nova desta sessão):** `C:\dev\miopia-app\` — **fora do OneDrive**. Razão: monorepo JS com `node_modules` dentro de pasta sincronizada pelo OneDrive causa lentidão brutal, locks de arquivo e corrupção de sync. Documentos de consultoria continuam em `clientes\oftalmologistas\`; só o código fica fora. Git é o backup do código (repo privado no GitHub do Marco).

## Contexto

Marco (consultor da Oftalmologia Alto de Pinheiros) quer um app mobile **nativo nas duas lojas** para pacientes do tratamento de controle da progressão da miopia infantil. O usuário do app é o **responsável** (paciente é criança, geralmente sem celular). Funções: dashboard de evolução do tratamento (grau e comprimento axial desde o início e desde a última consulta), lembretes de colírio (atropina, noturno) e de colocar/tirar lente (ortho-k), e gamification da adesão. A médica insere os dados clínicos no Klingo; a integração automática é desejada mas a API não expõe dados clínicos (confirmado na pesquisa).

## Decisões já tomadas (com Marco, 10/06/2026 — reconfirmadas por ele em 11/06)

1. **MVP sem integração Klingo** — a clínica digita os dados clínicos num painel administrativo do próprio produto (poucos campos, 2–3×/ano por paciente). Integração Klingo é fase futura.
2. **Sem Lovable** — Claude Code constrói o app (React Native/Expo) e o backend (Supabase) direto. Compromisso: etapa dedicada de design visual com mockups aprovados pelo Marco antes de codar telas.
3. **Custo total documentado antes de decidir quem banca** (planilha abaixo).
4. **Piloto fechado primeiro** — MVP via TestFlight (iOS) e Internal Testing (Android) para 5–10 famílias reais; lojas públicas depois do gate do piloto (condição do Marco: lojas oficiais continuam no roadmap).

## Veredito de viabilidade: VIÁVEL

**Lovable — descartado com evidência:** web-only em 2026 (não gera binário nativo); CVE-2025-48757 (RLS desligado por padrão, 170+ apps expostos) + incidente fev/2026 (18.696 usuários, 4.538 menores) — desqualificante para dados de saúde de menores. Claude Code + Expo + Supabase validado para dev solo.

**Klingo — sem acesso a dados clínicos via API:** Swagger existe (SwaggerHub `agsx30/klingo-api-externa`, SDK `ValleSaude/klingo-node-sdk`) mas só agendamento/cadastro/valores — nenhum endpoint de prontuário/refração. Sem programa de integradores, sem FHIR/HL7. API instável de madrugada (falhas observadas em 1ª mão nos testes Kualiz). Perguntar ao Daniel/Klingo sobre endpoint de prontuário = trilha paralela, não bloqueia.

**Expo/lojas — viável já, 3 descobertas:** (a) Apple guideline 5.1.1(ix): app de saúde DEVE ser submetido por **pessoa jurídica** — conta de organização no CNPJ da clínica, D-U-N-S ~5 dias úteis; (b) Google Play exige conta org para health apps + Health Apps Declaration; (c) lembretes Android exigem canal de notificação dedicado + alarmes **inexatos** (Android 14+ nega exatos por padrão); iOS: limite de 64 notificações locais. Timeline: ~3 meses até piloto, 4-5 meses até loja.

**Regulatório — melhor que o esperado:** ANVISA dispensa registro para uso in-house da clínica (art. 5º IV, RDC 657/2022) — condição estrutural: o app só EXIBE dados; **toda interpretação clínica é campo preenchido pela médica**, nunca calculado. LGPD: consentimento específico e em destaque de pelo menos um dos pais (art. 14 §1º), account deletion in-app (Apple). Supabase região São Paulo (residência BR não é exigida, mas elimina a discussão).

**Produto:** comprimento axial (mm) = padrão-ouro de progressão; dashboard mostra axial + equivalente esférico por olho. Gamification: lembretes melhoram adesão (+23%); **streaks rígidos causam abandono** — mecânica perdoadora. Concorrente BR: Mioview. Diferencial: ferramenta da própria clínica com dados clínicos reais e relação com a Dra. Se o piloto funcionar: replicável para as outras 3 clínicas do grupo (exigiria notificação ANVISA Classe I/II, ~30 dias).

## Arquitetura

**Monorepo** (`C:\dev\miopia-app\`) com 3 pacotes compartilhando tipos de `supabase gen types typescript`:

1. **App do responsável** — Expo (RN, TypeScript), expo-router com grupos `(auth)/(app)`, 4 tabs: **Hoje** (check-ins pendentes de todos os filhos), **Céu** (gamification), **Evolução** (dashboard clínico por filho), **Mais** (Aprender, Família, Conta/deleção). TanStack Query + supabase-js com cache persistido em AsyncStorage (dashboard abre offline); Zustand só UI efêmera. Dev build EAS desde a semana 1.

2. **Backend Supabase** (região São Paulo) — Postgres + RLS em 100% das tabelas, zero acesso anônimo. Entidades:
   `staff` (medica|secretaria|admin) · `families` → `guardians` (N responsáveis/família) → `children` (sem CPF/foto; avatar preset; `archived_at`) → `treatments` (prescrição, só staff escreve: atropina|ortho_k|oculos_lentes, horário sugerido, dias) → `adherence_logs` (check-ins, UNIQUE(treatment,data), janela retroativa de 7 dias na policy) e `measurements` (por olho: esfera/cilindro → EE em coluna GENERATED, axial mm com CHECK 15–35, **`status` enum digitado pela médica** + `doctor_note`, UNIQUE(child,data)) · `reminder_prefs` (horário real POR RESPONSÁVEL — separa prescrição de preferência, resolve RLS de escrita) · `consent_terms` (texto integral versionado + hash) → `consents` (aceite POR CRIANÇA, snapshot do nome, sobrevive à deleção) · `family_invites`, `push_tokens`, `deletion_requests`.
   RLS via helpers SECURITY DEFINER em schema `private` (`is_staff()`, `is_my_family()`, `can_see_child()`, search_path vazio). Responsável: lê a própria família, escreve APENAS adesão/lembretes/consentimento; medições read-only para a família por ausência de policy de escrita.
   **Edge Functions: só 2 no MVP** (`invite-family`, `delete-account` — únicas que precisam de service role) + `notify-new-measurement` na fase 2. Resto = PostgREST + RLS.
   Deleção de conta em matriz: APAGA (auth.user, guardians, reminder_prefs, push_tokens) / ANONIMIZA (logged_by→null, consents.user_id→null mantendo snapshot) / RETÉM (children arquivado, treatments, measurements — prontuário da clínica, CFM 20 anos; explícito no termo).
   Schema SQL integral: no artefato de design (`wtc1hw9fg.output`).

3. **Painel da clínica** — SPA separada: Vite + React + TS + supabase-js, deploy estático grátis (Vercel/Cloudflare Pages). Usuárias: Dra. e Betânia, desktop. Telas: login staff, famílias/crianças, tratamentos, formulário de medição pós-consulta (confirmação dupla + validação de faixa), avaliação textual da Dra., convites. Fora do app Expo de propósito (binário Apple menor, menos superfície de ataque).

**Auth (invite-only):** auto-cadastro DESATIVADO. Betânia pré-cadastra → Edge Function convida por e-mail → responsável instala o app (orientado na recepção: instalar ANTES do convite) → e-mail + OTP/senha → consentimento LGPD bloqueante → home semeada. **SMTP custom (Resend, free) ANTES do piloto** — o default do Supabase é ~3 e-mails/h.

**Sistema de lembretes (coração do produto):**
- Notificações **locais repetitivas diárias** (`repeats: true`) — 1 slot iOS permanente por lembrete; pior caso 9 de 64 slots. Sem janela rolante. Conteúdo estático; celebração dinâmica na tela Hoje.
- Android: canal dedicado `lembretes-tratamento` (MAX) + canal `clinica` (DEFAULT). **Alarme INEXATO** (janela ~10min ok para colírio) — não pedir SCHEDULE_EXACT_ALARM nem USE_EXACT_ALARM (risco de rejeição no Play). Battery killers OEM: tela "Lembretes atrasando?" + levantar aparelhos das famílias do piloto.
- Identifier determinístico `${childId}:${tipo}`, reconciliação declarativa (`syncSchedulesForFamily()`). Consolidação por horário: "Hora do cuidado: Alice e Pedro" — máx. 3 toques/dia por família.
- Check-in de 1 toque **na notificação** ('Feito' / 'Não foi possível') com outbox em AsyncStorage + sync idempotente. Validar handling em background em aparelho físico na semana 1; fallback: ação abre sheet no app. Retroativo até 12h; corte da "noite": até 04h conta como dia anterior.
- Push remoto (Expo Push): MVP só registra token + 1 caso ("resultados da consulta disponíveis").

## Produto e UX (corte do MVP)

**Conceito:** dois loops. **Noturno diário** (atropina/ortho-k ao deitar) sustenta retenção: lembrete + check-in 1 toque + recompensa visual. **Trimestral** (consulta) sustenta valor: dados novos + palavra da Dra. Universo visual: **céu noturno** — cada noite de cuidado acende uma estrela; mascote coruja; telas de celebração NUNCA exibem números clínicos.

- **IN (MVP):** onboarding 7 passos (convite → OTP → consentimento em camadas → confirmação dos filhos → horários → primer de notificação → dashboard semeado) · tab Hoje · Céu (estrelas mensais, constelações 7/30/90 noites, Diploma do Cuidado aos 90 dias) · Evolução (cards "desde a última consulta"/"desde o início" por olho + gráfico com toggle Grau|Comprimento do olho, **tinta neutra, zero verde/vermelho/setas/médias** — ANVISA; única interpretação: card "Avaliação da Dra. Christiane", datado, CRM/RQE) · bottom sheet explicando axial pra leigo · Aprender (5-6 cards aprovados pela Dra.) · streak perdoador: **escudos** (1 a cada 7 noites, máx. 3), **modo férias** (noites viram nuvens), **pausa clínica** (selo "pausa orientada pela Dra.") · adesão como meta semanal ("5 de 7 noites"), nunca streak seco.
- **OUT (v2+):** integração Klingo, chat (Iris já resolve), agendamento, segundo responsável com conta própria (schema suporta; UX depois), avatar customizável, pontos/loja/leaderboard, fotos/diário, PDF, curvas de percentil (vetadas até reavaliação ANVISA), CMS, push de marketing.
- **Nome:** recomendação **Lumi** (nome da coruja; loja: "Lumi | Oftalmologia Alto de Pinheiros"). Alternativas: Mirante, Horizonte, Noctua, Foco. **Veto: "Íris"** (colide com a IA do WhatsApp). Aprovação da Dra. pendente.
- **Direção visual:** roxo profundo #453A94 (céu noturno), amarelo-estrela #FFC857 só em conquistas, verde sóbrio #88B04B em confirmações, dados clínicos em tinta neutra; Nunito/Quicksand + Inter tabular; ilustração flat, zero fotos de crianças. **Gate: mockups aprovados pelo Marco antes de codar telas.**

## Custos (verificados, junho/2026)

| Item | Custo | Quando | Obrigatório? |
|---|---|---|---|
| Apple Developer Program (org, CNPJ da clínica) | **US$ 99/ano** | antes do TestFlight | Sim — PJ exigida p/ saúde (5.1.1) |
| D-U-N-S Number | grátis | ~5 dias úteis, pedir cedo | Sim |
| Google Play Console (org) | **US$ 25 único** | antes do Internal Testing | Sim |
| Supabase | grátis (free tier) | desde o início | **Pro US$ 25/mês recomendado a partir do piloto** (free pausa após ~1 sem. inativa; Pro tem backup) |
| EAS Build | grátis (15 builds/mês) | builds | Starter US$ 19/mês se apertar |
| Resend (SMTP convites/OTP) | grátis | antes do piloto | free tier basta |
| Hospedagem painel (Vercel/CF Pages) | grátis | fase 3 | — |
| **1º ano (cenário base)** | **~US$ 124 (~R$ 660)** | | |
| **1º ano (cenário piloto completo c/ Supabase Pro + EAS)** | **~US$ 345 (~R$ 1.850)** | | |

Recorrente do 2º ano em diante: US$ 99/ano (Apple) + Supabase/EAS conforme uso. **Decisão pendente: quem banca** — recomendação: a clínica (as contas precisam estar no CNPJ dela de qualquer jeito). Nenhum centavo antes da Fase 0; dev e protótipo em emulador custam zero.

## Regulatório — checklist obrigatório do MVP

1. Consentimento LGPD no onboarding: específico, em destaque, de ao menos um dos pais (art. 14 §1º), com timestamp + versão do termo.
2. Política de privacidade publicada (URL exigida pelas 2 lojas), com contato do encarregado.
3. Account deletion in-app (Apple); medições pertencem ao prontuário da clínica — explícito no termo.
4. **Design ANVISA-safe:** o app exibe dados e registra adesão; nunca calcula risco nem emite juízo clínico — status por consulta é selecionado pela médica.
5. Lojas: Health Apps Declaration (Google) + disclaimer "não é dispositivo médico"; privacy labels (Apple) e Data Safety (Google) como health data, sem compartilhamento.
6. Supabase região São Paulo (sa-east-1).
7. Minimização: sem CPF da criança; só nome/apelido + nascimento. Responsável: nome, e-mail, telefone.

## Fases de implementação

**Fase 0 — Resgate + proposta e contas (iniciar JÁ, roda em paralelo):**
(a) **Passo 0 acima** (resgatar artefatos do Temp, criar repo em `C:\dev\miopia-app\`); (b) Marco apresenta o projeto à Dra. (proposta com custos); GO → pedir **D-U-N-S do CNPJ** → enrollment **Apple Developer Organization** (1-4+ semanas — se não começar agora vira O gargalo) → **Google Play Console org** (US$ 25). Confirmar iPhone físico de teste. Projeto Supabase região São Paulo.

**Fase 1 — Fundação backend (1-2 semanas):**
`supabase init` + migration única (schema do artefato de design) + seed, 100% local com `supabase start`. **Testes de RLS ANTES de qualquer UI** (3 camadas — ver Verificação). Edge Function `invite-family` + SMTP Resend. `supabase gen types`.

**Fase 2 — Design visual (1 semana, paralela à Fase 1):**
Identidade (paleta/tipografia/coruja), mockups das telas-chave. **Gate: aprovação do Marco** (e nome com a Dra.).

**Fase 3 — Painel da clínica (1-2 semanas):**
Vite SPA: login staff → CRUD famílias/crianças/tratamentos → formulário de medição → avaliação da Dra. (frases-modelo) → convites. Pronto = Betânia cadastra família e lança consulta em ≤ 5 min sem ajuda.

**Fase 4 — App Expo (3-4 semanas):**
Semana 1: scaffolding → **dev build físico imediato** → validar o maior risco técnico: ações de check-in na notificação em background (iOS e Android). Depois: onboarding + consentimento → tab Hoje + check-in + outbox → módulo de lembretes → Evolução → Céu → Aprender → deleção de conta in-app desde o primeiro build TestFlight.

**Fase 5 — Hardening e preparação do piloto (1-2 semanas):**
Builds preview → TestFlight + Play Internal Testing; conta demo pro revisor Apple; termo revisado pelo advogado da clínica (paraleliza desde a Fase 1); política de privacidade publicada; levantar aparelhos das famílias (battery killers); roteiro de onboarding da recepção; seed de medições retroativas.

**Fase 6 — Piloto fechado (8-10 semanas):**
5-10 famílias. Gate: adesão mediana ≥ 70% das noites (semanas 2-8), retenção D30 ≥ 7/10 famílias, funil onboarding ≥ 90%, crash-free ≥ 99%, entrevistas D30, esforço do painel ≤ 5 min/consulta. **Não adicionar features no meio do piloto.**

**Fase 7 — Lojas públicas (condicionada ao gate):**
Health Apps Declaration + disclaimer, privacy labels, Data Safety, review. Estimativa total: 4-5 meses do zero à loja.

**Fase futura — Klingo e expansão:** integração se/quando a API de prontuário existir (perguntar ao Daniel sem bloquear); replicação para as outras 3 clínicas exige notificação ANVISA Classe I/II.

## Verificação

- **RLS (gate da Fase 1):** pgTAP via `supabase test db` em CI (anon=0 linhas em TUDO; responsável A não lê família B nem insere medição; staff lê tudo) + impersonação via `set_config('request.jwt.claims')` + smoke test supabase-js com 4 personas. Security Advisor a cada migration.
- **Notificações (gate da Fase 4, semana 1):** matriz em aparelho físico — Android 14+ (canal toca? sobrevive a Doze? ação grava no outbox?) e iOS (repetitiva dispara? ação em background?). Instável → fallback sheet, documentado.
- **E2E pré-piloto:** Betânia cadastra → convite chega → onboarding + consentimento → lembrete à noite → check-in → estrela → clínica lança medição → push → dashboard atualiza → deleção executa a matriz LGPD.
- **Piloto = verificação final** (métricas e gate da Fase 6).

## Perguntas em aberto (não bloqueiam — levar à Dra. na Fase 0)

1. Quem opera o painel: Betânia digita medidas e a Dra. só escreve a avaliação? (recomendado)
2. Avaliação da Dra.: texto livre ou frases-modelo? (frases-modelo evitam gargalo)
3. Esfera+cilindro digitados (EE calculado) ou EE pronto? (1 coluna da migration)
4. Histórico retroativo: digitar 2-3 consultas antigas por criança?
5. Famílias só com óculos/lentes especiais entram no piloto?
6. Horários de fim de semana diferentes? (2 triggers por lembrete — ok)
7. Nome do app (Lumi?) e mascote — aprovação da Dra.
8. Advogado para o termo LGPD + quem será o encarregado (DPO).

## Riscos principais

- **Burocracia Apple (D-U-N-S + org)** = caminho crítico — começar na Fase 0.
- **Battery killers Android** — levantar aparelhos do piloto antes; tela de troubleshooting.
- **Scope creep ANVISA:** qualquer cor semafórica/seta/média/percentil reclassifica como SaMD — revisar cada release; regra por escrito com a Dra.
- **Gargalo operacional:** se a Dra. não alimentar o painel, o app morre — frases-modelo + medir esforço no piloto.
- **Termo LGPD depende de advogado** — disparar cedo.
- **Auto-relato infla adesão** — apresentar como relato da família, não medida objetiva.
- **(Novo) Artefatos no Temp** — resgatar no Passo 0 antes que o Windows limpe.
