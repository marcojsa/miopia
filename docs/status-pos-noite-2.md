# Status do app — pós sessão noturna 2 (11/06/2026)

Balanço gerado pelo crítico de completude do workflow + verificação manual dos builds. Para a próxima sessão.

## ✅ Feito (e verificado)

- **Backend/schema** (`supabase/`): migration única (13 tabelas, 4 enums, helpers SECURITY DEFINER, RLS em 100% + revoke anon, EE GENERATED, status só digitado, axial CHECK 15-35, janela retroativa de 7 dias na policy). Edge Functions `invite-family` e `delete-account` (matriz LGPD). Suíte pgTAP `plan(67)`. Seed realista. **Tudo escrito, nada rodou ainda (sem Docker).**
- **Painel da clínica** (`apps/painel`): Vite+React 19+TS. Lógica REAL e completa — auth de staff (signInWithPassword + guard RequireStaff), CRUD famílias/crianças/tratamentos, **formulário de medição por olho com validação de faixa + confirmação dupla**, convites via Edge Function. Visual neutro de propósito (gate de mockups). **`npm run build` ✓ limpo; tsc ✓ limpo.**
- **App mobile** (`apps/mobile`): scaffold + camada `lib` real (outbox, notificações, datas com corte 04h, supabase, queryClient). Telas placeholder com TODO. **tsc ✓ limpo.**
- **Mockups** (`docs/mockups/`): 6 telas (`index`, `hoje`, `ceu`, `evolucao`, `onboarding-consentimento`, `painel-medicao`) na direção "céu noturno". **Aguardando aprovação do Marco.**
- **packages/shared**: stubs criados (`index.ts` + `database.types.ts` placeholder) — antes apontava para arquivos inexistentes.

## ⏳ Falta (ordem de prioridade)

- **P0 — destravar com Docker:** rodar migration + `db reset`, **testes RLS** (`supabase test db` + `smoke-rls.mjs` — gate inegociável da Fase 1), `supabase gen types` (gera os tipos reais; trocar os tipos à mão), Security Advisor.
- **P1 — SMTP Resend** antes do piloto (bloco pronto em config.toml, comentado); **telas reais do app** (pós-aprovação de mockup); **deleção de conta no app** (Edge Function pronta, tela é placeholder — Apple exige); **dev build físico + matriz de notificações** (maior risco técnico).
- **P2 — termo LGPD real** (advogado), **política de privacidade publicada** (DPO), **scheme definitivo do app** (hoje `miopia://convite` placeholder), **runner de testes JS** (date.test/measurementValidation sem runner).
- **P3 — 3 vs 4 tabs** (decidir nos mockups), **rastreio da retirada da lente ortho-k** (perguntar à Dra.), **deploy estático do painel**.

## 🚧 Bloqueios

Docker ausente (bloqueia todo o gate da Fase 1) · aprovação de mockups (bloqueia telas reais) · conta Apple org + D-U-N-S · Google Play org · advogado LGPD · GO + 8 perguntas da Dra. · conta Resend · projeto Supabase de produção (região SP).

## ⚠️ DECISÃO PENDENTE IMPORTANTE — ANVISA na tela de Evolução

O mockup `evolucao.html` exibe **deltas computados** entre consultas ("variação −0,25 D", "+0,08 mm") e usa "→" como conector entre valor anterior e atual. **Há uma tensão real:**
- O `design-produto.md` (fonte de verdade do produto) **especifica esse card** com esse formato e enquadra a diferença crua como "dado, não julgamento".
- Mas a regra dura do plano lista "seta" e "média" entre os elementos interpretativos **vetados** por ANVISA, e diferença crua (último − anterior) é um cálculo sobre dado clínico.

**A diferença entre os dois:** mostrar "−0,25 D" (número) vs. concluir "progressão acelerada" (juízo). O primeiro é defensável como dado; o segundo reclassifica como SaMD. **Decisão a tomar por escrito com Marco + Dra. + revisão jurídica ANTES de codar a tela de Evolução.** O painel, por contraste, não calcula nada e está 100% safe. Opções: (a) manter o delta como dado neutro (seguir o design-produto); (b) mostrar só os valores absolutos por consulta, sem o delta calculado, deixando a comparação para o olho do responsável + a fala da Dra.

## 🔎 Riscos técnicos (do crítico)

- Tipos à mão (painel/mobile) espelham a migration hoje, mas é dívida técnica até `supabase gen types`. Divergência de versão do supabase-js entre workspaces (painel 2.108 vs raiz 2.49).
- RLS/seed nunca executados — corretos na leitura, mas o seed de `auth.users` e os helpers SECURITY DEFINER só se confirmam rodando (gate Docker).
- Edge Functions não-transacionais (rollback best-effort) — testar caminho de erro antes do piloto.
- Auto-relato infla adesão — UX deve apresentar como "relato da família".
