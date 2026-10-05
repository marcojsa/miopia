// Leitura dos links de e-mail do Supabase Auth (convite e recuperação de senha).
// O GoTrue devolve os tokens no FRAGMENTO (#access_token=...&type=invite) e os
// erros (link expirado/usado) no fragmento ou na query. Função pura: sem RN.

export type AuthLinkResult =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

function readParams(text: string, into: Map<string, string>): void {
  for (const part of text.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    try {
      into.set(
        decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        decodeURIComponent(rawValue.replace(/\+/g, ' '))
      );
    } catch {
      // Parâmetro malformado: ignora.
    }
  }
}

export function parseAuthLink(url: string): AuthLinkResult {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1);

  const params = new Map<string, string>();
  readParams(query, params);
  readParams(hash, params); // o fragmento prevalece

  const error = params.get('error_description') ?? params.get('error');
  if (error) return { kind: 'error', message: error };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'tokens', accessToken, refreshToken, type: params.get('type') ?? null };
  }
  return { kind: 'none' };
}
