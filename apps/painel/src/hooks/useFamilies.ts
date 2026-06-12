import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Family } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';

const FAMILIES_KEY = ['families'] as const;

// Lista de famílias (RLS: staff vê todas via policy fam_staff_all).
export function useFamilies() {
  return useQuery({
    queryKey: FAMILIES_KEY,
    queryFn: async (): Promise<Family[]> => {
      const { data, error } = await supabase
        .from('families')
        .select('id, label, created_by, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Family[]) ?? [];
    },
  });
}

export function useFamily(familyId: string | undefined) {
  return useQuery({
    queryKey: ['family', familyId],
    enabled: !!familyId,
    queryFn: async (): Promise<Family | null> => {
      const { data, error } = await supabase
        .from('families')
        .select('id, label, created_by, created_at')
        .eq('id', familyId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Family | null) ?? null;
    },
  });
}

// Criar família: insere apenas o label. created_by = staff logado.
export function useCreateFamily() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (label: string): Promise<Family> => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error('Informe um rótulo para a família.');
      const { data, error } = await supabase
        .from('families')
        .insert({ label: trimmed, created_by: session?.user.id ?? null })
        .select('id, label, created_by, created_at')
        .single();
      if (error) throw error;
      return data as Family;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FAMILIES_KEY });
    },
  });
}
