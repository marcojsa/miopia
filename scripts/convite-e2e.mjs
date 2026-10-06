// Teste ponta a ponta do convite contra o GoTrue local real (sem navegador).
// 1) médica convida  2) família clica no link (GET /verify)  3) convite deve continuar pendente
// 4) reenvio antes da senha deve dar 200  5) família cria senha + RPC  6) convite aceito  7) login com a senha
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const require = createRequire(new globalThis.URL('../package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')

const URL = 'http://127.0.0.1:54321'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const MAILPIT = 'http://127.0.0.1:54324'
const email = `convite.teste.${process.pid}@example.com`
const sql = q => execSync(`docker exec -i supabase_db_miopia-app psql -U postgres -d postgres -At -c "${q}"`).toString().trim()
const ok = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? ' :: ' + x : ''}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

async function ultimoLink() {
  for (let i = 0; i < 20; i++) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json()
    const m = r.messages?.[0]
    if (m) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()
      const html = (full.HTML || full.Text || '').replace(/&amp;/g, '&')
      const link = html.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]+/)?.[0]
      return { link, subject: m.Subject, id: m.ID }
    }
    await sleep(500)
  }
  return {}
}

const medica = createClient(URL, ANON, opts)
await medica.auth.signInWithPassword({ email: 'medica@example.com', password: 'senha-local-123' })
const familyId = sql("select id from public.families limit 1")

// 1) convite
const r1 = await medica.functions.invoke('invite-family', { body: { family_id: familyId, email, display_name: 'Teste Convite', relationship: 'mae', is_primary: false } })
ok('convite enviado', !r1.error, r1.error ? String(await r1.error.context?.text?.()) : JSON.stringify(r1.data))
const m1 = await ultimoLink()
ok('e-mail de convite chegou em português', /Lumi|convite|Convite/.test(m1.subject || ''), m1.subject)

// 2) clique no link (sem seguir o redirect para miopia://)
const v = await fetch(m1.link, { redirect: 'manual' })
const loc = v.headers.get('location') || ''
ok('verify redireciona com tokens', /access_token=/.test(loc), loc.slice(0, 80))

// 3) convite continua pendente
const pend = sql(`select coalesce(accepted_at::text,'pendente') from public.family_invites where lower(email)=lower('${email}')`)
ok('depois do clique o convite segue pendente', pend === 'pendente', pend)

// 4) reenvio antes de criar senha
await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })
const r2 = await medica.functions.invoke('invite-family', { body: { family_id: familyId, email, display_name: 'Teste Convite', relationship: 'mae', is_primary: false } })
ok('reenvio antes da senha funciona (sem 409)', !r2.error, r2.error ? String(await r2.error.context?.text?.()) : JSON.stringify(r2.data))
const m2 = await ultimoLink()
ok('chegou e-mail no reenvio', !!m2.link, m2.subject)

// 5) família abre o link novo e cria a senha (o que a SetPasswordScreen faz)
const v2 = await fetch(m2.link || m1.link, { redirect: 'manual' })
const frag = new URLSearchParams((v2.headers.get('location') || '').split('#')[1] || '')
const fam = createClient(URL, ANON, opts)
const s = await fam.auth.setSession({ access_token: frag.get('access_token'), refresh_token: frag.get('refresh_token') })
ok('sessão aberta pelo link', !s.error && !!s.data.user, s.error?.message)
const u = await fam.auth.updateUser({ password: 'senha-nova-123' })
ok('senha criada', !u.error, u.error?.message)
const rpc = await fam.rpc('accept_my_invites')
ok('RPC accept_my_invites', !rpc.error, rpc.error?.message)

// 6) convite aceito
const acc = sql(`select coalesce(accepted_at::text,'pendente') from public.family_invites where lower(email)=lower('${email}')`)
ok('convite aceito depois da senha', acc !== 'pendente', acc)

// 7) login com a senha
const fam2 = createClient(URL, ANON, opts)
const li = await fam2.auth.signInWithPassword({ email, password: 'senha-nova-123' })
ok('login com a senha nova', !li.error, li.error?.message)
const filhos = await fam2.from('children').select('first_name')
ok('vê os filhos da família', (filhos.data || []).length > 0, JSON.stringify(filhos.data))
