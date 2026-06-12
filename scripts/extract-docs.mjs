// Extrai do artefato de design (docs/design-arquitetura.json) os documentos
// legíveis e os arquivos SQL da fundação do backend. Idempotente: sobrescreve.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifact = JSON.parse(readFileSync(join(root, 'docs', 'design-arquitetura.json'), 'utf8'));
const designs = artifact.result.designs;

const slugs = ['backend', 'mobile', 'produto'];

designs.forEach((d, i) => {
  const slug = slugs[i] ?? `perspectiva-${i}`;
  const md = [
    `# Design — ${slug}`,
    '',
    `> Extraído de docs/design-arquitetura.json (designs[${i}]). Fonte de verdade: o JSON.`,
    '',
    '## Perspectiva',
    '',
    d.perspective,
    '',
    '## Decisões',
    '',
    ...d.decisions.map(dec => `### ${dec.topic}\n\n**Escolha:** ${dec.choice}\n\n**Racional:** ${dec.rationale}\n`),
    '## Estrutura',
    '',
    d.structure,
    '',
    '## Riscos',
    '',
    ...d.risks.map(r => `- ${r}`),
    '',
    '## Perguntas em aberto',
    '',
    ...(d.open_questions ?? []).map(q => `- ${q}`),
    '',
  ].join('\n');
  writeFileSync(join(root, 'docs', `design-${slug}.md`), md);
  console.log(`docs/design-${slug}.md (${md.length} chars)`);
});

// SQL: blocos do design de backend (designs[0].structure)
const sqlBlocks = [...designs[0].structure.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1]);
console.log(`Blocos SQL encontrados: ${sqlBlocks.length}`);

mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true });
mkdirSync(join(root, 'supabase', 'tests', 'database'), { recursive: true });

// Blocos 1 (schema) + 2 (helpers + RLS) => migration inicial
writeFileSync(
  join(root, 'supabase', 'migrations', '20260611000000_initial_schema.sql'),
  sqlBlocks[0] + '\n\n' + sqlBlocks[1],
);
console.log('supabase/migrations/20260611000000_initial_schema.sql');

// Bloco 3 (pgTAP) => esqueleto de teste de RLS (placeholders a preencher)
const pgtapHeader = [
  '-- ESQUELETO inicial vindo do design (designs[0].structure §3).',
  '-- TODO: completar o seed das personas/famílias e substituir os placeholders',
  '--       <child_a>/<betania> antes de rodar `supabase test db`.',
  '-- Requer basejump/supabase_test_helpers instalado no banco de teste.',
  '',
].join('\n');
writeFileSync(join(root, 'supabase', 'tests', 'database', 'rls.test.sql'), pgtapHeader + sqlBlocks[2]);
console.log('supabase/tests/database/rls.test.sql');
