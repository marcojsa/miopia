// Filhos da família (RLS resolve o escopo: o responsável só enxerga os seus).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import type { Child } from '@/types/domain';
import { queryKeys } from './keys';
import { useIsStaff } from './useIsStaff';

/** Crianças NÃO arquivadas da família, ordenadas por first_name. */
export function useChildren(): UseQueryResult<Child[]> {
  const { session } = useSession();
  const staff = useIsStaff();
  return useQuery({
    queryKey: queryKeys.children,
    // Sem sessão o PostgREST responde 401 (anon não lê children). Conta da equipe
    // enxergaria todas as crianças da clínica: não carrega. Se a checagem de staff
    // falhar (offline), segue para não trancar o responsável.
    enabled: Boolean(session) && !staff.isLoading && staff.data !== true,
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
