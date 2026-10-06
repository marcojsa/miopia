// Tratamentos ATIVOS (regime muda 2-3x/ano). staleTime curto: encerramento ou troca
// de regime pela clínica precisa chegar à Hoje e aos lembretes no mesmo dia.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Treatment } from '@/types/domain';
import { queryKeys } from './keys';

const MINUTE = 60 * 1000;

/**
 * Tratamentos ativos — de um filho (childId) ou da família inteira (sem arg).
 * É a fonte para o scheduler de lembretes e para os cards de tarefa da Hoje.
 */
export function useTreatments(childId?: string): UseQueryResult<Treatment[]> {
  return useQuery({
    queryKey: queryKeys.treatments(childId),
    staleTime: 15 * MINUTE,
    queryFn: async (): Promise<Treatment[]> => {
      let query = supabase
        .from('treatments')
        .select('id, child_id, type, instructions, suggested_time, days_of_week, starts_on, ends_on, active')
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
