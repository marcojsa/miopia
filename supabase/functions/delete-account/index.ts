// ============================================================
// Edge Function: delete-account
//
// Por que existe: auth.admin.deleteUser exige SERVICE_ROLE, e a
// deleção precisa executar a matriz LGPD inteira (design-backend.md §5),
// não um simples delete. Exigência da Apple (account deletion in-app).
//
// Matriz aplicada (na ordem):
//   REGISTRA  deletion_requests (trilha p/ Apple/LGPD; processed_at no fim)
//   ANONIMIZA consents.user_id → null (snapshot+termo+timestamp ficam como prova)
//   APAGA     reminder_prefs, push_tokens, convites pendentes do e-mail,
//             guardians e, por fim, auth.users
//   DESVINCULA adherence_logs.logged_by → null (automático, FK ON DELETE SET NULL)
//   RETÉM     children/treatments/measurements (prontuário da clínica, CFM ~20 anos);
//             se a família ficar sem nenhum responsável → children.archived_at = now()
//
// Respostas: 200 ok · 401 sem/JWT inválido · 403 conta de staff ·
// 405 método · 500 falha em algum passo (deletion_request fica com
// processed_at = null como pendência para reprocessamento manual).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: "missing_env" });
  }

  // --- 1. Quem chama? (JWT do próprio responsável) ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "missing_authorization" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "invalid_jwt" });
  }
  const user = userData.user;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Conta de staff não se apaga pelo app (gestão é via SQL/dashboard).
  const { data: staffRow, error: staffError } = await admin
    .from("staff")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (staffError) {
    return jsonResponse(500, { error: "staff_lookup_failed", detail: staffError.message });
  }
  if (staffRow) {
    return jsonResponse(403, { error: "staff_account_not_deletable" });
  }

  // --- 2. Trilha: registra o pedido ANTES de tocar em qualquer dado ---
  const { data: request, error: requestError } = await admin
    .from("deletion_requests")
    .insert({ user_id: user.id, notes: `solicitado in-app por ${user.email ?? user.id}` })
    .select("id")
    .single();
  if (requestError || !request) {
    return jsonResponse(500, { error: "deletion_request_failed", detail: requestError?.message });
  }

  // Famílias do usuário — necessário ANTES de apagar guardians para
  // decidir o arquivamento das crianças órfãs de responsável.
  const { data: memberships, error: memberError } = await admin
    .from("guardians")
    .select("family_id")
    .eq("user_id", user.id);
  if (memberError) {
    return jsonResponse(500, { error: "guardian_lookup_failed", detail: memberError.message });
  }
  const familyIds = [...new Set((memberships ?? []).map((m) => m.family_id))];

  // As chamadas abaixo não são transacionais entre si: em caso de falha
  // parcial, o deletion_request fica com processed_at = null e a clínica
  // reprocessa manualmente (a trilha é exatamente para isso).
  const fail = (step: string, detail?: string) =>
    jsonResponse(500, { error: "deletion_step_failed", step, detail, deletion_request_id: request.id });

  // --- 3. ANONIMIZA: prova de consentimento perde o vínculo com a conta ---
  {
    const { error } = await admin
      .from("consents")
      .update({ user_id: null })
      .eq("user_id", user.id);
    if (error) return fail("anonymize_consents", error.message);
  }

  // --- 4. APAGA: identidade do responsável no app ---
  // (guardians/reminder_prefs/push_tokens também cascateiam do auth.user,
  //  mas o delete explícito documenta a matriz e independe das FKs.)
  {
    const { error } = await admin
      .from("reminder_prefs")
      .delete()
      .eq("guardian_user_id", user.id);
    if (error) return fail("delete_reminder_prefs", error.message);
  }
  {
    const { error } = await admin
      .from("push_tokens")
      .delete()
      .eq("user_id", user.id);
    if (error) return fail("delete_push_tokens", error.message);
  }
  if (user.email) {
    const { error } = await admin
      .from("family_invites")
      .delete()
      .eq("email", user.email)
      .is("accepted_at", null);
    if (error) return fail("delete_pending_invites", error.message);
  }
  {
    const { error } = await admin
      .from("guardians")
      .delete()
      .eq("user_id", user.id);
    if (error) return fail("delete_guardians", error.message);
  }

  // --- 5. RETÉM + arquiva: família sem responsáveis some do app,
  //        mas o registro clínico permanece intacto ---
  for (const familyId of familyIds) {
    const { count, error: countError } = await admin
      .from("guardians")
      .select("user_id", { count: "exact", head: true })
      .eq("family_id", familyId);
    if (countError) return fail("count_remaining_guardians", countError.message);
    if ((count ?? 0) === 0) {
      const { error } = await admin
        .from("children")
        .update({ archived_at: new Date().toISOString() })
        .eq("family_id", familyId)
        .is("archived_at", null);
      if (error) return fail("archive_children", error.message);
    }
  }

  // --- 6. APAGA o auth.user (adherence_logs.logged_by → null via FK) ---
  {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return fail("delete_auth_user", error.message);
  }

  // --- 7. Fecha a trilha ---
  {
    const { error } = await admin
      .from("deletion_requests")
      .update({
        processed_at: new Date().toISOString(),
        notes: "matriz LGPD executada pela edge function delete-account",
      })
      .eq("id", request.id);
    if (error) return fail("close_deletion_request", error.message);
  }

  return jsonResponse(200, { deleted: true, deletion_request_id: request.id });
});
