import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Treatment, TreatmentInsert } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';

function treatmentsKey(childId: string) {
  return ['treatments', childId] as const;
}

// Tratamentos (prescrição) de uma criança. Só staff escreve (treat_staff_all).
export function useTreatments(childId: string | undefined) {
  return useQuery({
    queryKey: ['treatments', childId],
    enabled: !!childId,
    queryFn: async (): Promise<Treatment[]> => {
      const { data, error } = await supabase
        .from('treatments')
        .select(
          'id, child_id, type, instructions, suggested_time, days_of_week, starts_on, ends_on, active, created_by, created_at',
        )
        .eq('child_id', childId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Treatment[]) ?? [];
    },
  });
}

// Criar tratamento. Constraint do banco: no máx. 1 ativo por tipo/criança
// (uq_treatment_active) — um insert de tipo já ativo retorna erro 23505.
export function useCreateTreatment(childId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (
      input: Omit<TreatmentInsert, 'child_id' | 'created_by'>,
    ): Promise<Treatment> => {
      const payload: TreatmentInsert = {
        child_id: childId,
        type: input.type,
        instructions: input.instructions?.trim() || null,
        suggested_time: input.suggested_time || null,
        days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
        starts_on: input.starts_on || new Date().toISOString().slice(0, 10),
        ends_on: input.ends_on || null,
        active: input.active ?? true,
        created_by: session?.user.id ?? null,
      };
      const { data, error } = await supabase
        .from('treatments')
        .insert(payload)
        .select(
          'id, child_id, type, instructions, suggested_time, days_of_week, starts_on, ends_on, active, created_by, created_at',
        )
        .single();
      if (error) throw error;
      return data as Treatment;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentsKey(childId) });
    },
  });
}

// Encerrar tratamento: active=false + ends_on (libera o slot do tipo).
export function useEndTreatment(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (treatmentId: string): Promise<void> => {
      const { error } = await supabase
        .from('treatments')
        .update({ active: false, ends_on: new Date().toISOString().slice(0, 10) })
        .eq('id', treatmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentsKey(childId) });
    },
  });
}
