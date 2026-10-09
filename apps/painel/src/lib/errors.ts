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

// Restrições com mensagem própria: o nome vem na mensagem do Postgres
// ('... violates check constraint "nome"').
const CONSTRAINTS: Record<string, string> = {
  uq_treatment_active:
    'Já existe um tratamento ativo desse tipo para esta criança. Encerre o atual antes de criar outro.',
  uq_treatment_active_colirio:
    'Já existe um colírio ativo com esse nome para esta criança. Encerre o atual antes de cadastrar outro com o mesmo nome.',
  treatments_times_per_day_faixa: 'Vezes por dia precisa ficar entre 1 e 6.',
  treatments_times_per_day_so_colirio_e_lente:
    'Atropina, ortho-k e óculos são registrados com 1 vez por dia. Só colírio aceita mais vezes.',
  treatments_max_wear_hours_faixa: 'O máximo de horas de uso por dia precisa ficar entre 1 e 24.',
  treatments_max_wear_hours_so_lente:
    'Só a lente de contato aceita máximo de horas de uso por dia.',
  contents_title_check: 'Informe um título de até 120 caracteres.',
  contents_body_check: 'O texto pode ter no máximo 4.000 caracteres.',
  contents_youtube_url_check:
    'Link do YouTube não reconhecido. Use um link youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ ou youtube.com/embed/.',
  contents_category_check: 'Categoria inválida.',
  contents_tem_texto_ou_video: 'O conteúdo precisa ter um texto ou um link do YouTube.',
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

export function errorConstraint(err: unknown): string | undefined {
  const message = readField(err, 'message') ?? '';
  return /constraint "([^"]+)"/.exec(message)?.[1];
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
  const constraint = errorConstraint(err);
  if (constraint && CONSTRAINTS[constraint]) return CONSTRAINTS[constraint];
  const code = errorCode(err);
  if (code && PG_CODES[code]) return PG_CODES[code];
  // Erros lançados pelo próprio painel (new Error('Informe ...')) já estão em pt-BR.
  if (err instanceof Error && !code && err.name === 'Error') return err.message;
  return fallback;
}
