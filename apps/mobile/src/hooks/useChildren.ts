// Filhos da família (RLS resolve o escopo: o responsável só enxerga os seus).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Child } from '@/types/domain';
import { queryKeys } from './keys';

/** Crianças NÃO arquivadas da família, ordenadas por first_name. */
export function useChildren(): UseQueryResult<Child[]> {
  return useQuery({
    queryKey: queryKeys.children,
    queryFn: async (): Promise<Child[]> => {
      const { data, error } = await supabase
        .from('children')
        .select('id, family_id, first_name, birth_date, avatar_key, archived_at, created_at')
        .is('archived_at', null)
        .order('first_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
