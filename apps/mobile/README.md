# @miopia/mobile — app do responsável

App Expo (React Native, TypeScript, expo-router) do projeto de adesão ao controle da
miopia infantil — Oftalmologia Alto de Pinheiros. Usuário do app = responsável
(pai/mãe); paciente é criança.

Estado atual: **scaffold da Fase 4**. A lógica de `src/lib/` é real e completa;
as telas são placeholders estruturais — **o visual entra após a aprovação dos mockups
(gate da Fase 2)**.

## Regras inegociáveis

- **ANVISA RDC 657/2022:** o app só EXIBE dados. Nenhum cálculo/cor/seta/média/percentil
  interpretativo. Status clínico = campo digitado pela médica (`measurements.status`).
- Texto de UI em pt-BR; identificadores de código em inglês.

## Setup

```bash
# na RAIZ do monorepo (npm workspaces)
npm install

# variáveis de ambiente
cp apps/mobile/.env.example apps/mobile/.env   # e preencher com o projeto Supabase (sa-east-1)
```

## Comandos

```bash
npm run typecheck   # tsc --noEmit
npm run test:date   # testes do corte da noite às 04h (node --test, sem Jest)
npm run start       # expo start (não rodar em sessões automatizadas)
```

## Mapa do código

- `src/app/` — rotas expo-router: `(auth)/` welcome|sign-in|consent · `(app)/` tabs
  Hoje, Progresso (`progress/`), Família (`family/`) · `checkin/[id]` (modal de
  check-in, id = `childId:tipo`) · `+not-found`
- `src/lib/supabase.ts` — cliente supabase-js (AsyncStorage + url-polyfill)
- `src/lib/queryClient.ts` — TanStack Query com cache persistido (dashboard abre offline)
- `src/lib/date.ts` — `localDateString()` com corte da noite às 04h
- `src/lib/outbox.ts` — fila local de check-ins; upsert idempotente em `adherence_logs`
  com `onConflict 'treatment_id,log_date'` (docs/notas-implementacao.md §1)
- `src/lib/notifications/` — canais Android, categoria com botões Feito/Pular,
  `syncSchedulesForFamily()` (reconciliação declarativa, triggers DAILY, identifier
  `childId:tipo`), tratamento de respostas (foreground + cold start deduplicado), push (stub)
- `src/stores/ui.ts` — Zustand: só estado efêmero de UI (filho ativo)
- `src/types/domain.ts` — tipos espelhando o schema Supabase

## Notas de monorepo

`metro.config.js` aponta `watchFolders`/`nodeModulesPaths` para a raiz do repo
(doc oficial Expo monorepos). Instalar dependências sempre pela raiz.

Documentos de referência: `docs/plano-recuperado.md`, `docs/design-mobile.md`,
`docs/notas-implementacao.md`.
