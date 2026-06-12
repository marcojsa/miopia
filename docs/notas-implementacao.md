# Notas de implementação — reconciliações e pendências técnicas

Decisões pequenas tomadas ao consolidar as perspectivas do design (backend × mobile × produto). Fonte dos designs: `design-arquitetura.json`.

## 1. Idempotência do check-in: `(treatment_id, log_date)`, sem `client_id`

O pseudocódigo mobile (`outbox.ts`) upserta numa tabela `checkins` com `onConflict: 'client_id'`. O schema final do backend usa `adherence_logs` com `UNIQUE(treatment_id, log_date)` e não tem coluna `client_id`.

**Resolução:** o outbox do app faz upsert com `onConflict: 'treatment_id,log_date'`. Isso já dá idempotência de retry E resolve pai e mãe marcando a mesma noite (segundo grava por cima ou é ignorado com `ignoreDuplicates`). O `client_id` UUID local pode continuar existindo só dentro do outbox (deduplicação local antes do flush), sem coluna no banco. Ajustar o pseudocódigo na hora de implementar `outbox.ts`; o payload do upsert usa `treatment_id` + `child_id` + `log_date` + `status` + `note` + `logged_by`.

Atenção ao corte da "noite": `log_date` é a data lógica (até 04h conta como o dia anterior), calculada no cliente (`localDateString()` precisa implementar esse corte).

## 2. Tabela no app vs schema

O pseudocódigo mobile fala em tabela `checkins` e campos `reminder_type`/`due_date`/`answered_at`/`source`. O schema real é `adherence_logs` (`status`, `log_date`, `note`, `logged_by`, `created_at`). O tipo do lembrete não vai no log — ele é derivável do `treatment_id` (cada tratamento tem um tipo). `orthok_on`/`orthok_off` são DOIS lembretes locais do mesmo tratamento `ortho_k`; o check-in registra a noite do tratamento uma vez (a retirada de manhã não gera log próprio no MVP — confirmar com Marco/Dra. se a retirada deve ser rastreada separadamente; se sim, vira coluna extra ou enum).

## 3. Navegação: 3 abas (design mobile) vs 4 tabs (plano)

O design mobile fechou em 3 abas (Hoje, Progresso, Família) com o plano sintetizado falando em 4 (Hoje, Céu, Evolução, Mais). A perspectiva de produto coloca o "Céu" como tela da criança. **Resolver na Fase 2 (mockups)** — candidato: 3 abas com o Céu acessível a partir de Hoje (modo criança), mantendo a tab bar enxuta.

## 4. Validação pendente da migration

`supabase/migrations/20260611000000_initial_schema.sql` foi extraída do design e ainda **não rodou** — precisa de Docker Desktop (`supabase start` + `supabase db reset`) na máquina. Primeiro item da Fase 1 quando o Docker estiver instalado. O esqueleto pgTAP (`supabase/tests/database/rls.test.sql`) tem placeholders de seed a completar.
