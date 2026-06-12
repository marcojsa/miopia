# @miopia/painel — Painel da clínica

SPA (Vite + React + TypeScript) usada pela equipe da clínica (Dra. Christiane e
secretária Betânia) em **desktop**. Faz parte do monorepo `miopia-app`
(workspaces npm).

> **Estado: placeholder estrutural (gate de design).** Os mockups ainda não
> foram aprovados. Este painel tem HTML semântico e layout mínimo, **sem
> identidade visual** (sem paleta/tipografia da marca). A **lógica** (auth,
> data, validação, hooks, roteamento com guard) é completa e real. A camada
> visual entra depois que os mockups forem aprovados.

## Stack

- Vite + React 19 + TypeScript
- `@supabase/supabase-js` (auth e dados via PostgREST; autorização real por RLS)
- `react-router-dom` (roteamento com guard de staff)
- `@tanstack/react-query` (cache/estado de servidor por recurso)

## Configuração

```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
```

Apenas a URL pública e a **anon key** vão no bundle (prefixo `VITE_`). A
`service_role` key JAMAIS entra aqui — operações privilegiadas (convites) vão
pela Edge Function `invite-family`.

## Scripts

```bash
npm run build       # tsc -b && vite build (verificação)
npm run typecheck   # tsc --noEmit
npm run dev         # servidor de desenvolvimento (não rodar no CI)
```

## Telas

- **Login** — e-mail + senha (`signInWithPassword`). Auto-cadastro desativado;
  contas de staff são criadas via SQL/admin.
- **Famílias** — lista + criar família.
- **Detalhe da família** — crianças (criar) + por criança: tratamentos
  (criar/encerrar) e medições (histórico + nova).
- **Nova medição** — formulário por olho (esfera, cilindro, axial) com validação
  de faixa e **confirmação dupla** (resumo + segundo "Confirmar"). Status clínico
  é selecionado pela médica. EE (`od_se`/`oe_se`) é GENERATED no banco e não é
  enviado.
- **Convites** — chama a Edge Function `invite-family`.

## Notas

- Tipos do banco escritos à mão em `src/types/database.ts` (sem Docker para
  `supabase gen types`). `// TODO: trocar por supabase gen types`.
- A autorização é do banco (RLS). O guard de rota (`RequireStaff`) é a primeira
  linha de defesa na UI: bloqueia quem não tem perfil em `public.staff`.

## ANVISA RDC 657/2022

O painel **registra** dados e a **interpretação humana** (campo `status` +
`doctor_note`, digitados pela médica). NÃO calcula risco, NÃO usa cores
semafóricas/setas/médias/percentis/faixas-alvo sobre dados clínicos.
