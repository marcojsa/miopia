// Cabeçalhos CORS compartilhados pelas Edge Functions.
// O painel (Vite SPA) e o app chamam as funções de origens distintas;
// como a autorização real é o JWT (verify_jwt + checagens internas),
// liberar a origem aqui não abre dado nenhum.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
