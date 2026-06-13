// Tratamentos ATIVOS (regime muda 2-3x/ano; staleTime 1h — design-mobile §offline).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Treatment } from '@/types/domain';
import { queryKeys } from './keys';

const HOUR = 60 * 60 * 1000;

/**
 * Tratamentos ativos — de um filho (childId) ou da família inteira (sem arg).
 * É a fonte para o scheduler de lembretes e para os cards de tarefa da Hoje.
 */
export function useTreatments(childId?: string): UseQueryResult<Treatment[]> {
  return useQuery({
    queryKey: queryKeys.treatments(childId),
    staleTime: HOUR,
    queryFn: async (): Promise<Treatment[]> => {
      let query = supabase
        .from('treatments')
        .select('id, child_id, type, instructions, suggested_time, days_of_week, starts_on, ends_on, active')
        .eq('active', true)
        .order('starts_on', { ascending: true });
      if (childId) query = query.eq('child_id', childId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
