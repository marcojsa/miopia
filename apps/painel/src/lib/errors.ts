// Tradução de erros do Supabase (Auth, PostgREST, rede) para mensagens em pt-BR.
// O PostgrestError nem sempre passa em `instanceof Error`, então a leitura é
// por `code`/`message`, nunca por instanceof.
import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

const OFFLINE = 'Sem conexão com o servidor. Verifique a internet e tente novamente.';

const AUTH_CODES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'E-mail ainda não confirmado.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  user_banned: 'Esta conta está bloqueada.',
};

const PG_CODES: Record<string, string> = {
  '23505': 'Registro duplicado.',
  '42501': 'Sua conta não tem permissão para esta ação.',
  '23503': 'Referência inválida.',
  '23514': 'Valor fora da faixa permitida.',
  '22003': 'Valor numérico fora da faixa permitida.',
  '22P02': 'Dado em formato inválido.',
  '22007': 'Data em formato inválido.',
  '22008': 'Data fora da faixa permitida.',
  PGRST116: 'Registro não encontrado.',
};

function readField(err: unknown, field: 'code' | 'message'): string | undefined {
  if (err && typeof err === 'object' && field in err) {
    const value = (err as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

export function errorCode(err: unknown): string | undefined {
  return readField(err, 'code');
}

export function isNetworkError(err: unknown): boolean {
  if (isAuthRetryableFetchError(err)) return true;
  const message = readField(err, 'message') ?? '';
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}

/** Mensagem em pt-BR para qualquer erro vindo do Supabase ou da rede. */
export function toPtBr(err: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  if (isNetworkError(err)) return OFFLINE;
  if (isAuthError(err)) {
    const mapped = err.code ? AUTH_CODES[err.code] : undefined;
    if (mapped) return mapped;
    if (/invalid login credentials/i.test(err.message)) return AUTH_CODES.invalid_credentials;
    return fallback;
  }
  const code = errorCode(err);
  if (code && PG_CODES[code]) return PG_CODES[code];
  // Erros lançados pelo próprio painel (new Error('Informe ...')) já estão em pt-BR.
  if (err instanceof Error && !code && err.name === 'Error') return err.message;
  return fallback;
}
