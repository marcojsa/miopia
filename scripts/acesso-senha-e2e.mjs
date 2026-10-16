// Teste ponta a ponta do acesso com senha provisória (sem e-mail), contra o
// Supabase de desenvolvimento (túnel: bash scripts/dev-remoto.sh tunel).
// 1) médica cria o acesso  2) senha volta só na resposta  3) família entra com ela
// 4) vê os filhos  5) mesmo e-mail de novo dá 409  6) família troca a senha
import { createRequire } from 'node:module'
const require = createRequire(new globalThis.URL('../package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')

const URL = 'http://127.0.0.1:54321'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const email = `acesso.senha.${process.pid}@example.com`
let falhas = 0
const ok = (n, c, x = '') => { if (!c) falhas++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' :: ' + x : ''}`) }
const corpo = async r => r.error ? String(await r.error.context?.text?.()) : JSON.stringify({ ...r.data, senha_provisoria: r.data?.senha_provisoria ? '***' : undefined })

const medica = createClient(URL, ANON, opts)
await medica.auth.signInWithPassword({ email: 'medica@example.com', password: 'senha-local-123' })
const { data: fams } = await medica.from('families').select('id').limit(1)
const familyId = fams?.[0]?.id

const r1 = await medica.functions.invoke('invite-family', { body: { family_id: familyId, email, display_name: 'Teste Senha', relationship: 'mae', is_primary: false, modo: 'senha' } })
ok('acesso criado com senha provisória', !r1.error && r1.data?.modo === 'senha', await corpo(r1))
const senha = r1.data?.senha_provisoria ?? ''
ok('senha tem 10 caracteres sem ambíguos', /^[a-km-zA-HJ-NP-Z2-9]{10}$/.test(senha))

const fam = createClient(URL, ANON, opts)
const li = await fam.auth.signInWithPassword({ email, password: senha })
ok('família entra com a senha provisória', !li.error, li.error?.message)
const filhos = await fam.from('children').select('id')
ok('família vê os filhos', (filhos.data || []).length > 0, `${(filhos.data || []).length} criança(s)`)
const conv = await medica.from('family_invites').select('accepted_at').ilike('email', email)
ok('convite já consta como aceito', !!conv.data?.[0]?.accepted_at)

const r2 = await medica.functions.invoke('invite-family', { body: { family_id: familyId, email, display_name: 'Teste Senha', modo: 'senha' } })
const st2 = r2.error?.context?.status
ok('mesmo e-mail de novo dá 409', st2 === 409, `${st2} ${await corpo(r2)}`)

const up = await fam.auth.updateUser({ password: 'senha-da-familia-123' })
ok('família troca a senha', !up.error, up.error?.message)
const fam2 = createClient(URL, ANON, opts)
const li2 = await fam2.auth.signInWithPassword({ email, password: 'senha-da-familia-123' })
ok('entra com a senha nova', !li2.error, li2.error?.message)

const sec = createClient(URL, ANON, opts)
const anon = await sec.functions.invoke('invite-family', { body: { family_id: familyId, email: `x${email}`, display_name: 'x', modo: 'senha' } })
ok('sem login não cria acesso', !!anon.error, String(anon.error?.context?.status))

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.')
process.exit(falhas ? 1 : 0)
