import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Measurement, MeasurementInsert } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';

function measurementsKey(childId: string) {
  return ['measurements', childId] as const;
}

// Histórico de medições de uma criança (staff: meas_staff_all).
export function useMeasurements(childId: string | undefined) {
  return useQuery({
    queryKey: ['measurements', childId],
    enabled: !!childId,
    queryFn: async (): Promise<Measurement[]> => {
      const { data, error } = await supabase
        .from('measurements')
        .select(
          'id, child_id, measured_on, od_sphere, od_cylinder, oe_sphere, oe_cylinder, od_se, oe_se, od_axial_mm, oe_axial_mm, status, doctor_note, recorded_by, created_at',
        )
        .eq('child_id', childId!)
        .order('measured_on', { ascending: false });
      if (error) throw error;
      return (data as Measurement[]) ?? [];
    },
  });
}

// Criar medição. recorded_by = auth.uid() do staff logado.
// IMPORTANTE: od_se / oe_se são GENERATED no banco — NUNCA são enviados.
// O equivalente esférico é calculado pelo Postgres (esfera + cilindro/2);
// é conversão óptica definicional, não interpretação de risco (ANVISA).
export function useCreateMeasurement(childId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (
      input: Omit<MeasurementInsert, 'child_id' | 'recorded_by'>,
    ): Promise<Measurement> => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sessão expirada. Entre novamente.');

      const payload: MeasurementInsert = {
        child_id: childId,
        measured_on: input.measured_on,
        od_sphere: input.od_sphere,
        od_cylinder: input.od_cylinder,
        oe_sphere: input.oe_sphere,
        oe_cylinder: input.oe_cylinder,
        od_axial_mm: input.od_axial_mm,
        oe_axial_mm: input.oe_axial_mm,
        status: input.status,
        doctor_note: input.doctor_note,
        recorded_by: userId,
      };
      const { data, error } = await supabase
        .from('measurements')
        .insert(payload)
        .select(
          'id, child_id, measured_on, od_sphere, od_cylinder, oe_sphere, oe_cylinder, od_se, oe_se, od_axial_mm, oe_axial_mm, status, doctor_note, recorded_by, created_at',
        )
        .single();
      if (error) throw error;
      return data as Measurement;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: measurementsKey(childId) });
    },
  });
}
