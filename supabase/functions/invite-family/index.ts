// ============================================================
// Edge Function: invite-family
//
// Por que existe: auth.admin.inviteUserByEmail exige a SERVICE_ROLE
// key, que jamais entra no cliente (design-backend.md §6).
//
// Fluxo (design-backend.md §4):
//   1. Valida o JWT do chamador e confirma que é staff ativo
//      (equivalente a private.is_staff(), consultando public.staff
//      com service role — o schema private não é exposto via RPC).
//   2. Cria a família (ou reusa uma existente, p/ segundo responsável).
//   3. Chama auth.admin.inviteUserByEmail com data:{family_id} e
//      redirectTo de deep link (placeholder até o app ter scheme final).
//   4. Cria o guardian "pendente" (vira ativo quando o responsável
//      aceita o convite e define a senha) e registra family_invites.
//
// Respostas: 201 criado · 400 corpo inválido · 401 sem/JWT inválido ·
// 403 não-staff · 404 família inexistente · 405 método · 409 e-mail já
// cadastrado · 500 erro interno (com rollback best-effort).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

interface InviteBody {
  /** Cria família nova com este rótulo interno (ex.: "Família Souza")... */
  family_label?: string;
  /** ...OU convida um segundo responsável para uma família existente. */
  family_id?: string;
  email?: string;
  display_name?: string;
  relationship?: string; // 'mae' | 'pai' | 'avo' | livre
  is_primary?: boolean;
  /** Override opcional do deep link de aceite (precisa estar no allow-list do Auth). */
  redirect_to?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Placeholder de deep link do app Expo (config.toml: additional_redirect_urls).
// Trocar pelo scheme definitivo quando o app for scaffoldado (Fase 4).
const DEFAULT_REDIRECT_TO = "miopia://convite";

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

  // --- 1. Quem chama? (JWT do staff, validado pelo GoTrue) ---
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
  const caller = userData.user;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: staffRow, error: staffError } = await admin
    .from("staff")
    .select("user_id, role")
    .eq("user_id", caller.id)
    .eq("active", true)
    .maybeSingle();
  if (staffError) {
    return jsonResponse(500, { error: "staff_lookup_failed", detail: staffError.message });
  }
  if (!staffRow) {
    return jsonResponse(403, { error: "not_staff" });
  }

  // --- 2. Corpo do pedido ---
  let body: InviteBody;
  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const displayName = body.display_name?.trim() ?? "";
  if (!EMAIL_RE.test(email)) {
    return jsonResponse(400, { error: "invalid_email" });
  }
  if (!displayName) {
    return jsonResponse(400, { error: "missing_display_name" });
  }
  if (!body.family_id && !body.family_label?.trim()) {
    return jsonResponse(400, { error: "missing_family", detail: "Envie family_label (família nova) ou family_id (existente)." });
  }

  // --- 3. Família: nova ou existente ---
  let familyId: string;
  let createdFamily = false;
  if (body.family_id) {
    const { data: fam, error: famError } = await admin
      .from("families")
      .select("id")
      .eq("id", body.family_id)
      .maybeSingle();
    if (famError) {
      return jsonResponse(500, { error: "family_lookup_failed", detail: famError.message });
    }
    if (!fam) {
      return jsonResponse(404, { error: "family_not_found" });
    }
    familyId = fam.id;
  } else {
    const { data: fam, error: famError } = await admin
      .from("families")
      .insert({ label: body.family_label!.trim(), created_by: caller.id })
      .select("id")
      .single();
    if (famError || !fam) {
      return jsonResponse(500, { error: "family_insert_failed", detail: famError?.message });
    }
    familyId = fam.id;
    createdFamily = true;
  }

  // Rollback best-effort: as chamadas não são transacionais entre si.
  const rollback = async (invitedUserId?: string) => {
    if (invitedUserId) {
      await admin.auth.admin.deleteUser(invitedUserId).catch(() => {});
    }
    if (createdFamily) {
      await admin.from("families").delete().eq("id", familyId);
    }
  };

  // --- 4. Convite por e-mail (cria o auth.user em estado "invited") ---
  // family_id vai em user_metadata só como atalho para o onboarding;
  // a fonte de verdade do vínculo é a linha em public.guardians.
  const redirectTo =
    body.redirect_to ?? Deno.env.get("INVITE_REDIRECT_TO") ?? DEFAULT_REDIRECT_TO;

  const { data: invited, error: inviteError } = await admin.auth.admin
    .inviteUserByEmail(email, {
      data: { family_id: familyId, display_name: displayName },
      redirectTo,
    });
  if (inviteError || !invited?.user) {
    await rollback();
    const alreadyExists =
      inviteError?.status === 422 ||
      /already.*(registered|exists)/i.test(inviteError?.message ?? "");
    return jsonResponse(alreadyExists ? 409 : 500, {
      error: alreadyExists ? "email_already_registered" : "invite_failed",
      detail: inviteError?.message,
    });
  }
  const invitedUserId = invited.user.id;

  // --- 5. Guardian pendente + trilha do convite ---
  const { error: guardianError } = await admin.from("guardians").insert({
    user_id: invitedUserId,
    family_id: familyId,
    display_name: displayName,
    relationship: body.relationship ?? null,
    is_primary: body.is_primary ?? false,
  });
  if (guardianError) {
    await rollback(invitedUserId);
    return jsonResponse(500, { error: "guardian_insert_failed", detail: guardianError.message });
  }

  const { data: inviteRow, error: inviteRowError } = await admin
    .from("family_invites")
    .insert({ family_id: familyId, email, invited_by: caller.id })
    .select("id, expires_at")
    .single();
  if (inviteRowError || !inviteRow) {
    await rollback(invitedUserId);
    return jsonResponse(500, { error: "invite_log_failed", detail: inviteRowError?.message });
  }

  return jsonResponse(201, {
    family_id: familyId,
    family_created: createdFamily,
    invited_user_id: invitedUserId,
    invite_id: inviteRow.id,
    expires_at: inviteRow.expires_at,
  });
});
