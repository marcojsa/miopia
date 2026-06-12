import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Child, ChildInsert } from '@/types/database';

function childrenKey(familyId: string) {
  return ['children', familyId] as const;
}

// Crianças de uma família (RLS: staff vê todas via child_staff_all).
export function useChildren(familyId: string | undefined) {
  return useQuery({
    queryKey: ['children', familyId],
    enabled: !!familyId,
    queryFn: async (): Promise<Child[]> => {
      const { data, error } = await supabase
        .from('children')
        .select(
          'id, family_id, first_name, birth_date, avatar_key, chart_ref, archived_at, created_at',
        )
        .eq('family_id', familyId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as Child[]) ?? [];
    },
  });
}

export function useChild(childId: string | undefined) {
  return useQuery({
    queryKey: ['child', childId],
    enabled: !!childId,
    queryFn: async (): Promise<Child | null> => {
      const { data, error } = await supabase
        .from('children')
        .select(
          'id, family_id, first_name, birth_date, avatar_key, chart_ref, archived_at, created_at',
        )
        .eq('id', childId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Child | null) ?? null;
    },
  });
}

// Criar criança. first_name + birth_date obrigatórios; avatar_key/chart_ref
// opcionais. Minimização LGPD: sem CPF, sem foto.
export function useCreateChild(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ChildInsert, 'family_id'>): Promise<Child> => {
      const first_name = input.first_name.trim();
      if (!first_name) throw new Error('Informe o primeiro nome da criança.');
      if (!input.birth_date) throw new Error('Informe a data de nascimento.');

      const payload: ChildInsert = {
        family_id: familyId,
        first_name,
        birth_date: input.birth_date,
        avatar_key: input.avatar_key?.trim() || null,
        chart_ref: input.chart_ref?.trim() || null,
      };
      const { data, error } = await supabase
        .from('children')
        .insert(payload)
        .select(
          'id, family_id, first_name, birth_date, avatar_key, chart_ref, archived_at, created_at',
        )
        .single();
      if (error) throw error;
      return data as Child;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: childrenKey(familyId) });
    },
  });
}
