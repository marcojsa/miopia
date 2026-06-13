// Adesão: leitura dos logs + mutation de check-in (outbox-first, optimistic).
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { formatLocalYMD, localDateString } from '@/lib/date';
import { enqueueCheckin, flushOutbox, newClientId } from '@/lib/outbox';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import type { AdherenceLog, AdherenceStatus } from '@/types/domain';
import { queryKeys } from './keys';

const MINUTE = 60 * 1000;

const LOG_COLUMNS = 'id, treatment_id, child_id, log_date, status, note, logged_by, created_at';

/**
 * Check-ins de HOJE (data lógica com corte 04h) de TODOS os filhos da família.
 * É a fonte da tela Hoje: tarefa sem log = pendente. staleTime curto: o dado
 * do dia muda com o uso (e o useCheckinMutation atualiza este cache na hora).
 */
export function useTodayAdherence(): UseQueryResult<AdherenceLog[]> {
  return useQuery({
    queryKey: queryKeys.adherenceToday,
    staleTime: MINUTE,
    queryFn: async (): Promise<AdherenceLog[]> => {
      const { data, error } = await supabase
        .from('adherence_logs')
        .select(LOG_COLUMNS)
        .eq('log_date', localDateString());
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Histórico de adesão de UMA criança (padrão: últimos 120 dias — cobre o céu
 * do mês + simulação de escudos desde starts_on na janela do piloto).
 * Ordenado por log_date ASC (a gamificação caminha cronologicamente).
 */
export function useAdherenceLogs(childId: string, sinceDays = 120): UseQueryResult<AdherenceLog[]> {
  return useQuery({
    queryKey: queryKeys.adherenceByChild(childId),
    enabled: childId.length > 0,
    staleTime: 5 * MINUTE,
    queryFn: async (): Promise<AdherenceLog[]> => {
      const since = new Date();
      since.setDate(since.getDate() - sinceDays);
      const { data, error } = await supabase
        .from('adherence_logs')
        .select(LOG_COLUMNS)
        .eq('child_id', childId)
        .gte('log_date', formatLocalYMD(since))
        .order('log_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface CheckinInput {
  treatmentId: string;
  childId: string;
  status: AdherenceStatus; // 'feito' | 'pulado'
  note?: string | null;
}

function upsertLocal(
  logs: AdherenceLog[] | undefined,
  optimistic: AdherenceLog
): AdherenceLog[] {
  const rest = (logs ?? []).filter(
    (l) => !(l.treatment_id === optimistic.treatment_id && l.log_date === optimistic.log_date)
  );
  return [...rest, optimistic];
}

/**
 * Check-in outbox-first: grava no outbox local (nunca depende de rede),
 * tenta flush imediato e aplica OPTIMISTIC UPDATE nos caches de adesão
 * (['adherence','today'] e ['adherence', childId]) — a UI acende a estrela
 * na hora, mesmo offline. onSettled invalida o prefixo ['adherence'].
 */
export function useCheckinMutation(): UseMutationResult<void, Error, CheckinInput, { previousToday?: AdherenceLog[]; previousChild?: AdherenceLog[] }> {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  return useMutation({
    mutationFn: async (input: CheckinInput): Promise<void> => {
      await enqueueCheckin({
        treatment_id: input.treatmentId,
        child_id: input.childId,
        log_date: localDateString(),
        status: input.status,
        note: input.note ?? null,
        logged_by: userId,
      });
      await flushOutbox(); // best-effort; offline fica na fila
    },
    onMutate: async (input) => {
      const todayKey = queryKeys.adherenceToday;
      const childKey = queryKeys.adherenceByChild(input.childId);
      await queryClient.cancelQueries({ queryKey: ['adherence'] });

      const previousToday = queryClient.getQueryData<AdherenceLog[]>(todayKey);
      const previousChild = queryClient.getQueryData<AdherenceLog[]>(childKey);

      const optimistic: AdherenceLog = {
        id: `local-${newClientId()}`,
        treatment_id: input.treatmentId,
        child_id: input.childId,
        log_date: localDateString(),
        status: input.status,
        note: input.note ?? null,
        logged_by: userId,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<AdherenceLog[]>(todayKey, (old) => upsertLocal(old, optimistic));
      if (previousChild !== undefined) {
        queryClient.setQueryData<AdherenceLog[]>(childKey, (old) => upsertLocal(old, optimistic));
      }
      return { previousToday, previousChild };
    },
    onError: (_error, input, context) => {
      // enqueueCheckin só falha se o AsyncStorage falhar — aí sim desfaz.
      if (context?.previousToday !== undefined) {
        queryClient.setQueryData(queryKeys.adherenceToday, context.previousToday);
      }
      if (context?.previousChild !== undefined) {
        queryClient.setQueryData(queryKeys.adherenceByChild(input.childId), context.previousChild);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['adherence'] });
    },
  });
}
