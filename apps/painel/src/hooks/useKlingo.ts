// Busca de pacientes no Klingo (agenda e ficha), via Edge Function
// 'klingo-paciente': o token do Klingo só existe no servidor.
//
// LGPD: a função nunca devolve CPF, celular nem endereço. O CPF só sai do
// painel quando a pessoa digita na busca por CPF; ele não entra em cache,
// estado global nem armazenamento (por isso a ficha é uma função simples,
// não uma mutation do React Query, que guardaria as variáveis no cache).
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const FUNCAO = 'klingo-paciente';

/** Uma marcação da agenda do Klingo, já sem CPF/celular. */
export interface KlingoMarcacao {
  ref: string;
  /** Identificador estável do paciente no Klingo ("123" ou "TMP:45"). */
  paciente_ref: string | null;
  /** Pré-cadastro no Klingo: o identificador pode mudar depois. */
  provisorio: boolean;
  nome: string;
  primeiro_nome: string;
  nascimento: string | null;
  idade: number | null;
  crianca: boolean;
  hora: string;
  medico: string;
  tem_cpf: boolean;
}

/** Ficha do paciente: só o que o Lumi usa para cadastrar e convidar. */
export interface KlingoFicha {
  paciente_ref: string;
  provisorio: boolean;
  nome: string;
  primeiro_nome: string;
  nascimento: string | null;
  idade: number | null;
  crianca: boolean;
  responsavel_nome: string | null;
  responsavel_email: string | null;
}

export type PedidoFicha =
  | { acao: 'ficha'; data: string; ref: string }
  | { acao: 'cpf'; cpf: string };

/** Erro da busca no Klingo, já com mensagem em pt-BR e o código da função. */
export class KlingoErro extends Error {
  readonly codigo: string;

  constructor(message: string, codigo: string) {
    super(message);
    this.name = 'KlingoErro';
    this.codigo = codigo;
  }
}

async function paraKlingoErro(error: unknown): Promise<KlingoErro> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const body = (await response.json().catch(() => null)) as
      | { erro?: string; mensagem?: string; error?: string }
      | null;
    const codigo = body?.erro ?? body?.error ?? `http_${response.status}`;
    if (body?.mensagem) return new KlingoErro(body.mensagem, codigo);
    if (response.status === 401) {
      return new KlingoErro('Sua sessão expirou. Entre novamente.', codigo);
    }
    if (response.status === 404) {
      return new KlingoErro('A busca no Klingo não está publicada no projeto Supabase.', codigo);
    }
    return new KlingoErro(`Não foi possível consultar o Klingo (HTTP ${response.status}). Tente de novo.`, codigo);
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new KlingoErro('Não foi possível falar com o servidor. Verifique a conexão e tente de novo.', 'rede');
  }
  return new KlingoErro('Não foi possível consultar o Klingo. Tente de novo.', 'desconhecido');
}

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FUNCAO, { body });
  if (error) throw await paraKlingoErro(error);
  if (!data) throw new KlingoErro('Resposta vazia do Klingo. Tente de novo.', 'vazio');
  return data;
}

// Agenda de um dia. Sem nova tentativa automática: o Klingo limita consultas
// (429) e a função já guarda a agenda por 10 minutos.
export function useKlingoAgenda(data: string, enabled: boolean) {
  return useQuery({
    queryKey: ['klingo-agenda', data],
    enabled: enabled && !!data,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<KlingoMarcacao[]> => {
      const resposta = await chamar<{ data: string; marcacoes: KlingoMarcacao[] }>({
        acao: 'agenda',
        data,
      });
      return resposta.marcacoes ?? [];
    },
  });
}

/** Ficha de uma marcação (CPF lido no servidor) ou de um CPF digitado. */
export function buscarFichaKlingo(pedido: PedidoFicha): Promise<KlingoFicha> {
  return chamar<KlingoFicha>({ ...pedido });
}
