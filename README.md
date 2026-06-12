# App de Controle da Miopia — Oftalmologia Alto de Pinheiros

App mobile (Expo/React Native) para responsáveis de pacientes do tratamento de controle da progressão da miopia infantil, com backend Supabase e painel administrativo web para a clínica.

**Funções:** lembretes de colírio (atropina) e lente (ortho-k) com check-in de 1 toque, dashboard de evolução clínica (equivalente esférico + comprimento axial por olho), gamification de adesão ("céu noturno" — cada noite de cuidado acende uma estrela).

## Estrutura do monorepo

```
miopia-app/
├── apps/
│   ├── mobile/      # App Expo do responsável (fase 4)
│   └── painel/      # SPA Vite/React da clínica (fase 3)
├── packages/
│   └── shared/      # Tipos gerados por `supabase gen types typescript`
├── supabase/        # Migrations, Edge Functions, testes pgTAP de RLS
├── docs/            # Pesquisa de viabilidade, design de arquitetura, planos
└── scripts/         # Utilitários de build/extração
```

## Princípios inegociáveis

1. **ANVISA RDC 657/2022** — o app só EXIBE dados e registra adesão. Toda interpretação clínica (`status` da medição) é digitada pela médica, nunca calculada. Zero cores semafóricas, setas, médias ou percentis no dashboard.
2. **LGPD** — consentimento específico e em destaque de ao menos um dos pais (art. 14 §1º), por criança, versionado. Minimização: sem CPF/endereço/foto de criança. Deleção de conta in-app com matriz APAGA/ANONIMIZA/RETÉM.
3. **RLS em 100% das tabelas** — zero acesso anônimo; o banco é a fronteira de segurança. Testes de RLS antes de qualquer UI.
4. **Lembrete confiável > tudo** — notificações locais repetitivas (1 slot iOS por lembrete), canal Android dedicado, alarme inexato (sem SCHEDULE_EXACT_ALARM), outbox offline-first para check-ins.

## Documentação

- `docs/plano-recuperado.md` — plano de implementação aprovado (fases 0-7)
- `docs/pesquisa-viabilidade.json` — pesquisa completa (Klingo, Lovable, lojas, regulatório, produto)
- `docs/design-arquitetura.json` — design completo (backend, mobile, produto/UX)
- `docs/design-*.md` — extrações legíveis do design por perspectiva

## Desenvolvimento

Requisitos: Node 20+, Docker Desktop (para `supabase start` local).

```sh
npm install
npx supabase start    # banco local (precisa de Docker)
npx supabase test db  # testes pgTAP de RLS
```
