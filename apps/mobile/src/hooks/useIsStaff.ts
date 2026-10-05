// A conta logada é da equipe da clínica? O app é do responsável; a equipe usa o
// painel. Pela RLS (staff_select) cada usuário lê a própria linha em staff.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { queryKeys } from './keys';

export function useIsStaff(): UseQueryResult<boolean> {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: queryKeys.isStaff(userId),
    enabled: userId !== null,
    queryFn: async (): Promise<boolean> => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from('staff')
        .select('user_id')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  });
}
