// Medições da criança — SOMENTE EXIBIÇÃO (ANVISA RDC 657/2022).
// O app NUNCA calcula variação/tendência/média sobre estes dados; a única
// interpretação exibida é o doctor_note + status digitados pela médica.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Measurement } from '@/types/domain';
import { queryKeys } from './keys';

const MINUTE = 60 * 1000;

/**
 * Medições de UMA criança, mais recente primeiro (measured_on DESC).
 * staleTime curto: consulta lançada (ou excluída) pela clínica precisa aparecer ao
 * reabrir a tela/app. O cache persistido continua abrindo na hora e offline; a
 * revalidação roda em segundo plano.
 */
export function useMeasurements(childId: string): UseQueryResult<Measurement[]> {
  return useQuery({
    queryKey: queryKeys.measurements(childId),
    enabled: childId.length > 0,
    staleTime: 5 * MINUTE,
    queryFn: async (): Promise<Measurement[]> => {
      const { data, error } = await supabase
        .from('measurements')
        .select(
          'id, child_id, measured_on, od_sphere, od_cylinder, oe_sphere, oe_cylinder, od_se, oe_se, od_axial_mm, oe_axial_mm, status, doctor_note, created_at'
        )
        .eq('child_id', childId)
        .order('measured_on', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
