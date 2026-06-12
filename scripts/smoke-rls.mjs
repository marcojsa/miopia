#!/usr/bin/env node
// ============================================================
// Smoke test de RLS — camada 3 da verificação (design-backend.md §3).
// Valida o caminho REAL (PostgREST + JWT do GoTrue) com 4 personas:
//   anon · responsável A · responsável B · staff
// contra a instância local (`supabase start` precisa estar rodando).
//
// Uso:
//   node scripts/smoke-rls.mjs          (ou: npm run db:smoke)
//
// Env vars (defaults = instância local padrão do `supabase start`;
// se você trocou o jwt_secret no config.toml, exporte as suas):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Saída: PASS/FAIL por checagem + resumo. Exit code 0 = tudo passou,
// 1 = alguma checagem falhou, 2 = erro de ambiente (Supabase fora do ar).
// ============================================================

import { createClient } from "@supabase/supabase-js";
import process from "node:process";

// Chaves demo publicadas pelo próprio CLI para o ambiente local — não
// são segredo. Em qualquer ambiente remoto, use as env vars.
const DEFAULT_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEFAULT_LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? DEFAULT_LOCAL_ANON_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? DEFAULT_LOCAL_SERVICE_ROLE_KEY;

const PASSWORD = "Smoke-rls-123!";
const EMAILS = {
  staff: "smoke.staff@example.com",
  maeA: "smoke.mae.a@example.com",
  maeB: "smoke.mae.b@example.com",
};
const SMOKE_LABEL_PREFIX = "SMOKE ";

const ALL_TABLES = [
  "staff",
  "families",
  "guardians",
  "children",
  "treatments",
  "reminder_prefs",
  "measurements",
  "adherence_logs",
  "consent_terms",
  "consents",
  "family_invites",
  "push_tokens",
  "deletion_requests",
];

// ---------- relatório ----------
let passed = 0;
let failed = 0;
const failures = [];

function report(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Lança se a chamada admin/seed falhar (problema de ambiente, não de RLS). */
function must(res, step) {
  if (res.error) {
    throw new Error(`Falha no setup (${step}): ${res.error.message}`);
  }
  return res.data;
}

function newAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email) {
  const client = newAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error || !data?.user) {
    throw new Error(`Falha no login de ${email}: ${error?.message}`);
  }
  return { client, userId: data.user.id };
}

async function cleanup(admin) {
  // famílias SMOKE: cascade apaga children/treatments/logs/guardians
  await admin.from("families").delete().like("label", `${SMOKE_LABEL_PREFIX}%`);
  // usuários smoke (staff row cascateia do auth.user)
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targets = (data?.users ?? []).filter((u) =>
    Object.values(EMAILS).includes(u.email ?? ""),
  );
  for (const u of targets) {
    await admin.auth.admin.deleteUser(u.id);
  }
}

async function main() {
  console.log(`Smoke RLS — ${SUPABASE_URL}`);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 0. conectividade ---
  try {
    const { error } = await admin
      .from("staff")
      .select("user_id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error(`\nNão consegui falar com o Supabase em ${SUPABASE_URL}.`);
    console.error("O `supabase start` está rodando? Detalhe:", e.message);
    process.exit(2);
  }

  await cleanup(admin);

  // --- 1. seed das personas (via admin API + service role) ---
  console.log("\nSetup: criando personas e dados de teste...");
  const users = {};
  for (const [key, email] of Object.entries(EMAILS)) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);
    }
    users[key] = data.user;
  }

  must(
    await admin.from("staff").insert({
      user_id: users.staff.id,
      role: "secretaria",
      display_name: "SMOKE Staff",
    }),
    "staff",
  );

  const [familyA, familyB] = must(
    await admin
      .from("families")
      .insert([
        { label: `${SMOKE_LABEL_PREFIX}Família A`, created_by: users.staff.id },
        { label: `${SMOKE_LABEL_PREFIX}Família B`, created_by: users.staff.id },
      ])
      .select("id, label"),
    "families",
  );

  must(
    await admin.from("guardians").insert([
      { user_id: users.maeA.id, family_id: familyA.id, display_name: "SMOKE Mãe A", relationship: "mae", is_primary: true },
      { user_id: users.maeB.id, family_id: familyB.id, display_name: "SMOKE Mãe B", relationship: "mae", is_primary: true },
    ]),
    "guardians",
  );

  const [childA, childB] = must(
    await admin
      .from("children")
      .insert([
        { family_id: familyA.id, first_name: "SmokeAlice", birth_date: "2018-03-10" },
        { family_id: familyB.id, first_name: "SmokeBruno", birth_date: "2016-07-22" },
      ])
      .select("id, family_id"),
    "children",
  );

  const [treatA, treatB] = must(
    await admin
      .from("treatments")
      .insert([
        { child_id: childA.id, type: "atropina", instructions: "1 gota ao deitar", suggested_time: "20:30" },
        { child_id: childB.id, type: "ortho_k", instructions: "lentes ao deitar", suggested_time: "21:00" },
      ])
      .select("id, child_id"),
    "treatments",
  );

  must(
    await admin.from("measurements").insert([
      { child_id: childA.id, measured_on: isoDaysAgo(30), od_sphere: -2.0, oe_sphere: -2.25, od_axial_mm: 24.1, oe_axial_mm: 24.05, recorded_by: users.staff.id },
      { child_id: childB.id, measured_on: isoDaysAgo(30), od_sphere: -3.5, oe_sphere: -3.25, od_axial_mm: 24.8, oe_axial_mm: 24.75, recorded_by: users.staff.id },
    ]),
    "measurements",
  );

  // --- 2. persona ANON: zero acesso em TODAS as tabelas ---
  console.log("\nPersona: anon (sem login)");
  const anon = newAnonClient();
  for (const table of ALL_TABLES) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    // a migration revoga privilégios do anon → erro 42501; sem o revoke,
    // a ausência de policy devolveria 0 linhas. Os dois = acesso zero.
    const ok = Boolean(error) || (data ?? []).length === 0;
    report(
      `anon: ${table} inacessível`,
      ok,
      error ? "" : `retornou ${data?.length} linha(s)`,
    );
  }

  // --- 3. persona RESPONSÁVEL A ---
  console.log("\nPersona: responsável A");
  const { client: maeA, userId: maeAId } = await signIn(EMAILS.maeA);

  {
    const { data, error } = await maeA.from("children").select("id");
    const ok = !error && data.length === 1 && data[0].id === childA.id;
    report("A vê exatamente a própria criança", ok, error?.message ?? `linhas: ${data?.length}`);
  }
  {
    const { data, error } = await maeA.from("children").select("id").eq("id", childB.id);
    const ok = !error && data.length === 0;
    report("A NÃO vê a criança da família B", ok, error?.message ?? `linhas: ${data?.length}`);
  }
  {
    const { data, error } = await maeA.from("measurements").select("child_id");
    const ok = !error && data.length === 1 && data.every((r) => r.child_id === childA.id);
    report("A vê só as medições da própria criança", ok, error?.message ?? `linhas: ${data?.length}`);
  }
  {
    const { error } = await maeA.from("measurements").insert({
      child_id: childA.id,
      measured_on: isoDaysAgo(0),
      od_sphere: -2.5,
      recorded_by: users.staff.id,
    });
    report("A NÃO insere medição", Boolean(error), error ? "" : "insert passou!");
  }
  {
    const { data, error } = await maeA
      .from("measurements")
      .update({ doctor_note: "tentativa" })
      .eq("child_id", childA.id)
      .select();
    const ok = Boolean(error) || (data ?? []).length === 0;
    report("A NÃO atualiza medição (0 linhas)", ok, error ? "" : `afetou ${data?.length}`);
  }
  {
    const { error } = await maeA.from("treatments").insert({
      child_id: childA.id,
      type: "oculos_lentes",
    });
    report("A NÃO insere tratamento", Boolean(error), error ? "" : "insert passou!");
  }
  {
    const { error } = await maeA.from("adherence_logs").insert({
      treatment_id: treatA.id,
      child_id: childA.id,
      log_date: isoDaysAgo(0),
      status: "feito",
      logged_by: maeAId,
    });
    report("A insere check-in da própria criança (hoje)", !error, error?.message ?? "");
  }
  {
    const { error } = await maeA.from("adherence_logs").insert({
      treatment_id: treatB.id,
      child_id: childB.id,
      log_date: isoDaysAgo(0),
      status: "feito",
      logged_by: maeAId,
    });
    report("A NÃO insere check-in da criança da família B", Boolean(error), error ? "" : "insert passou!");
  }
  {
    const { error } = await maeA.from("adherence_logs").insert({
      treatment_id: treatA.id,
      child_id: childA.id,
      log_date: isoDaysAgo(8),
      status: "feito",
      logged_by: maeAId,
    });
    report("janela de 7 dias: check-in de 8 dias atrás é recusado", Boolean(error), error ? "" : "insert passou!");
  }
  {
    const { error } = await maeA.from("reminder_prefs").insert({
      guardian_user_id: maeAId,
      treatment_id: treatA.id,
      reminder_time: "20:45",
    });
    report("A cria a própria preferência de lembrete", !error, error?.message ?? "");
  }
  {
    const { error } = await maeA.from("reminder_prefs").insert({
      guardian_user_id: maeAId,
      treatment_id: treatB.id,
      reminder_time: "21:30",
    });
    report("A NÃO cria preferência p/ tratamento de outra família", Boolean(error), error ? "" : "insert passou!");
  }

  // --- 4. persona RESPONSÁVEL B (simetria: nada da família A vaza) ---
  console.log("\nPersona: responsável B");
  const { client: maeB, userId: maeBId } = await signIn(EMAILS.maeB);

  {
    const { data, error } = await maeB.from("children").select("id");
    const ok = !error && data.length === 1 && data[0].id === childB.id;
    report("B vê exatamente a própria criança", ok, error?.message ?? `linhas: ${data?.length}`);
  }
  {
    const { data, error } = await maeB.from("adherence_logs").select("child_id");
    const ok = !error && (data ?? []).every((r) => r.child_id === childB.id);
    report("B não vê check-ins da família A", ok, error?.message ?? "");
  }
  {
    const { data, error } = await maeB
      .from("reminder_prefs")
      .select("guardian_user_id");
    const ok = !error && (data ?? []).every((r) => r.guardian_user_id === maeBId);
    report("B não vê preferências de lembrete da mãe A", ok, error?.message ?? "");
  }

  // --- 5. persona STAFF ---
  console.log("\nPersona: staff");
  const { client: staff, userId: staffId } = await signIn(EMAILS.staff);

  {
    const { data, error } = await staff
      .from("children")
      .select("id")
      .in("id", [childA.id, childB.id]);
    const ok = !error && data.length === 2;
    report("staff vê as crianças das duas famílias", ok, error?.message ?? `linhas: ${data?.length}`);
  }
  {
    const { data, error } = await staff
      .from("measurements")
      .select("id")
      .in("child_id", [childA.id, childB.id]);
    const ok = !error && data.length >= 2;
    report("staff lê medições de todas as famílias", ok, error?.message ?? `linhas: ${data?.length}`);
  }
  {
    const { error } = await staff.from("measurements").insert({
      child_id: childA.id,
      measured_on: isoDaysAgo(0),
      od_sphere: -2.25,
      oe_sphere: -2.5,
      od_axial_mm: 24.2,
      oe_axial_mm: 24.15,
      status: "controle_adequado",
      recorded_by: staffId,
    });
    report("staff insere medição", !error, error?.message ?? "");
  }
  {
    const { error } = await staff.from("adherence_logs").insert({
      treatment_id: treatA.id,
      child_id: childA.id,
      log_date: isoDaysAgo(1),
      status: "feito",
      logged_by: staffId,
    });
    report("staff NÃO fabrica check-in de adesão", Boolean(error), error ? "" : "insert passou!");
  }
  {
    const { data, error } = await staff
      .from("reminder_prefs")
      .select("treatment_id")
      .in("treatment_id", [treatA.id, treatB.id]);
    const ok = !error && data.length === 0;
    report("staff NÃO enxerga preferências pessoais de lembrete", ok, error?.message ?? `linhas: ${data?.length}`);
  }

  // --- 6. limpeza final ---
  console.log("\nLimpando dados de teste...");
  await Promise.all([
    maeA.auth.signOut(),
    maeB.auth.signOut(),
    staff.auth.signOut(),
  ]).catch(() => {});
  await cleanup(admin);

  // --- resumo ---
  console.log("\n========================================");
  console.log(`Resultado: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) {
    console.log("\nFalhas:");
    for (const f of failures) {
      console.log(`  - ${f.name}${f.detail ? `  (${f.detail})` : ""}`);
    }
    process.exit(1);
  }
  console.log("RLS ok para as 4 personas.");
  process.exit(0);
}

main().catch((e) => {
  console.error("\nErro inesperado no smoke test:", e.message);
  process.exit(2);
});
