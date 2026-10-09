// Tratamentos ATIVOS (regime muda 2-3x/ano). staleTime curto: encerramento ou troca
// de regime pela clínica precisa chegar à Hoje e aos lembretes no mesmo dia.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Treatment } from '@/types/domain';
import { queryKeys } from './keys';

const MINUTE = 60 * 1000;

const TREATMENT_COLUMNS =
  'id, child_id, type, name, times_per_day, max_wear_hours, instructions, suggested_time, days_of_week, starts_on, ends_on, active';

export interface UseTreatmentsOptions {
  /**
   * Busca de novo ao montar e ao voltar ao app, mesmo com cache novo. Para telas
   * que GRAVAM pelo id do tratamento (horários dos lembretes): depois de uma troca
   * de regime, o cache ainda teria o tratamento encerrado.
   */
  alwaysFresh?: boolean;
}

/**
 * Tratamentos ativos — de um filho (childId) ou da família inteira (sem arg).
 * É a fonte para o scheduler de lembretes e para os cards de tarefa da Hoje.
 */
export function useTreatments(
  childId?: string,
  options: UseTreatmentsOptions = {}
): UseQueryResult<Treatment[]> {
  return useQuery({
    queryKey: queryKeys.treatments(childId),
    staleTime: 15 * MINUTE,
    ...(options.alwaysFresh
      ? { refetchOnMount: 'always' as const, refetchOnWindowFocus: 'always' as const }
      : {}),
    queryFn: async (): Promise<Treatment[]> => {
      let query = supabase
        .from('treatments')
        .select(TREATMENT_COLUMNS)
        .eq('active', true)
        .order('starts_on', { ascending: true });
      if (childId) query = query.eq('child_id', childId);
      const { data, error } = await query;
      if (error) throw error;
      const fresh = data ?? [];
      // Troca de regime pela clínica cria tratamento com id novo, e o banco herda a
      // preferência de horário para ele. O cache de reminder-prefs (staleTime longo)
      // não tem essa linha: sem revalidar, o app cairia na sugestão da médica.
      const cached = queryClient.getQueryData<Treatment[]>(queryKeys.treatments(childId));
      if (cached && fresh.some((t) => !cached.some((c) => c.id === t.id))) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs });
      }
      return fresh;
    },
  });
}

/**
 * Todos os tratamentos de um filho, inclusive os encerrados. Só para o histórico
 * da gamificação: as noites de um regime trocado continuam devidas até o fim dele.
 */
export function useTreatmentHistory(childId: string): UseQueryResult<Treatment[]> {
  return useQuery({
    queryKey: queryKeys.treatmentHistory(childId),
    enabled: childId !== '',
    staleTime: 15 * MINUTE,
    queryFn: async (): Promise<Treatment[]> => {
      const { data, error } = await supabase
        .from('treatments')
        .select(TREATMENT_COLUMNS)
        .eq('child_id', childId)
        .order('starts_on', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
