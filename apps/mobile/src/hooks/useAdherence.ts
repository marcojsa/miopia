// Adesão: leitura dos logs + mutation de check-in (outbox-first, optimistic).
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { upsertLocal } from '@/lib/adherenceCache';
import { localDateString } from '@/lib/date';
import { enqueueCheckin, flushOutbox, newClientId } from '@/lib/outbox';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import type { AdherenceLog, AdherenceStatus } from '@/types/domain';
import { queryKeys } from './keys';

const MINUTE = 60 * 1000;

const LOG_COLUMNS = 'id, treatment_id, child_id, log_date, dose, status, note, logged_by, created_at';

/**
 * Check-ins de HOJE (data lógica com corte 04h) de TODOS os filhos da família.
 * É a fonte da tela Hoje: tarefa sem log = pendente. A data entra na key: ao virar
 * a noite (ou com o cache persistido de ontem) a query é outra, nunca a de ontem.
 */
export function useTodayAdherence(date: string = localDateString()): UseQueryResult<AdherenceLog[]> {
  return useQuery({
    queryKey: queryKeys.adherenceToday(date),
    staleTime: MINUTE,
    queryFn: async (): Promise<AdherenceLog[]> => {
      const { data, error } = await supabase
        .from('adherence_logs')
        .select(LOG_COLUMNS)
        .eq('log_date', date);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const PAGE_SIZE = 1000; // teto padrão de linhas por resposta do PostgREST

/** `since` que traz o histórico inteiro da criança (céu, escudos e marcos). */
export const ALL_HISTORY = '0001-01-01';

/**
 * Histórico de adesão de UMA criança desde `since`. A gamificação usa
 * ALL_HISTORY: trocar ou encerrar um tratamento cria outro starts_on, e cortar
 * antes do primeiro log faria o total de noites e os marcos regredirem.
 * `since` null = ainda não se sabe: espera.
 * Ordenado por log_date ASC (a gamificação caminha cronologicamente).
 */
export function useAdherenceLogs(childId: string, since: string | null): UseQueryResult<AdherenceLog[]> {
  return useQuery({
    queryKey: [...queryKeys.adherenceByChild(childId), since],
    enabled: childId.length > 0 && since !== null,
    staleTime: 5 * MINUTE,
    queryFn: async (): Promise<AdherenceLog[]> => {
      if (since === null) return [];
      const all: AdherenceLog[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('adherence_logs')
          .select(LOG_COLUMNS)
          .eq('child_id', childId)
          .gte('log_date', since)
          .order('log_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = data ?? [];
        all.push(...page);
        if (page.length < PAGE_SIZE) return all;
      }
    },
  });
}

export interface CheckinInput {
  treatmentId: string;
  childId: string;
  status: AdherenceStatus; // 'feito' | 'pulado'
  /** Dose do dia (1..times_per_day); padrão 1. */
  dose?: number;
  note?: string | null;
  /** Correção de uma resposta já registrada hoje (sobrescreve no servidor). */
  replace?: boolean;
}

interface CheckinContext {
  todayKey: QueryKey;
  previousToday?: AdherenceLog[];
  previousChild: Array<[QueryKey, AdherenceLog[] | undefined]>;
}

/**
 * Check-in outbox-first: grava no outbox local (nunca depende de rede),
 * tenta flush imediato e aplica OPTIMISTIC UPDATE nos caches de adesão
 * (['adherence','today',data] e ['adherence', childId, desde]) — a UI acende a
 * estrela na hora, mesmo offline. onSettled invalida o prefixo ['adherence'].
 */
export function useCheckinMutation(): UseMutationResult<void, Error, CheckinInput, CheckinContext> {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  return useMutation({
    // Outbox-first: roda mesmo offline (o onlineManager pausaria a mutation).
    networkMode: 'always',
    mutationFn: async (input: CheckinInput): Promise<void> => {
      await enqueueCheckin({
        treatment_id: input.treatmentId,
        child_id: input.childId,
        log_date: localDateString(),
        dose: input.dose ?? 1,
        status: input.status,
        note: input.note ?? null,
        logged_by: userId,
        replace: input.replace,
      });
      await flushOutbox(); // best-effort; offline fica na fila
    },
    onMutate: async (input) => {
      const todayKey = queryKeys.adherenceToday(localDateString());
      const childPrefix = queryKeys.adherenceByChild(input.childId);
      await queryClient.cancelQueries({ queryKey: ['adherence'] });

      const previousToday = queryClient.getQueryData<AdherenceLog[]>(todayKey);
      const previousChild = queryClient.getQueriesData<AdherenceLog[]>({ queryKey: childPrefix });

      const optimistic: AdherenceLog = {
        id: `local-${newClientId()}`,
        treatment_id: input.treatmentId,
        child_id: input.childId,
        log_date: localDateString(),
        dose: input.dose ?? 1,
        status: input.status,
        note: input.note ?? null,
        logged_by: userId,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<AdherenceLog[]>(todayKey, (old) => upsertLocal(old, optimistic));
      queryClient.setQueriesData<AdherenceLog[]>({ queryKey: childPrefix }, (old) =>
        old === undefined ? old : upsertLocal(old, optimistic)
      );
      return { todayKey, previousToday, previousChild };
    },
    onError: (_error, _input, context) => {
      // enqueueCheckin só falha se o AsyncStorage falhar — aí sim desfaz.
      if (!context) return;
      if (context.previousToday !== undefined) {
        queryClient.setQueryData(context.todayKey, context.previousToday);
      }
      for (const [key, data] of context.previousChild) {
        if (data !== undefined) queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['adherence'] });
    },
  });
}
