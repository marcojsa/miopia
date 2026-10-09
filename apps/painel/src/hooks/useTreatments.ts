import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Treatment, TreatmentInsert } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';
import { todayISO } from '@/lib/labels';

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
          'id, child_id, type, name, times_per_day, max_wear_hours, instructions, suggested_time, days_of_week, starts_on, ends_on, active, created_by, created_at',
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
// Colírio é a exceção: vários ativos, mas não dois com o mesmo nome
// (uq_treatment_active_colirio, também 23505).
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
        name: input.name?.trim() || null,
        times_per_day: input.times_per_day ?? 1,
        max_wear_hours: input.max_wear_hours ?? null,
        instructions: input.instructions?.trim() || null,
        suggested_time: input.suggested_time || null,
        days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
        starts_on: input.starts_on || todayISO(),
        ends_on: input.ends_on || null,
        active: input.active ?? true,
        created_by: session?.user.id ?? null,
      };
      const { data, error } = await supabase
        .from('treatments')
        .insert(payload)
        .select(
          'id, child_id, type, name, times_per_day, max_wear_hours, instructions, suggested_time, days_of_week, starts_on, ends_on, active, created_by, created_at',
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

// Encerrar tratamento: active=false + ends_on (libera o slot do tipo). Se o
// tratamento ainda não começou, o Fim é o próprio Início (nenhuma noite vale).
export function useEndTreatment(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (treatment: Pick<Treatment, 'id' | 'starts_on'>): Promise<void> => {
      const today = todayISO();
      const { error } = await supabase
        .from('treatments')
        .update({
          active: false,
          ends_on: treatment.starts_on > today ? treatment.starts_on : today,
        })
        .eq('id', treatment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentsKey(childId) });
    },
  });
}
