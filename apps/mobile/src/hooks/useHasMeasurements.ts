// A família tem ALGUMA medição de consulta lançada? Decide se a aba Progresso
// aparece. Só existência (1 linha, só o id) — nenhum valor clínico sai daqui.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { queryKeys } from './keys';

/**
 * Busca de novo ao montar e ao o app voltar ao primeiro plano (focusManager do
 * _layout raiz): a 1ª medição lançada pela clínica precisa mostrar a aba logo.
 * O cache persistido segue valendo para abrir na hora e offline.
 */
export function useHasMeasurements(): UseQueryResult<boolean> {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: queryKeys.anyMeasurement(userId),
    enabled: userId !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from('measurements').select('id').limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
}
