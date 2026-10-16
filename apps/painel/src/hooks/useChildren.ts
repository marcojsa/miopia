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

/** Criança já cadastrada, com o rótulo da família (para avisar duplicidade). */
export interface ExistingChild {
  id: string;
  family_id: string;
  first_name: string;
  birth_date: string;
  archived_at: string | null;
  family_label: string;
}

type ExistingChildRow = Omit<ExistingChild, 'family_label'> & {
  families: { label: string } | null;
};

function toExistingChild(row: ExistingChildRow): ExistingChild {
  const { families, ...rest } = row;
  return { ...rest, family_label: families?.label ?? 'sem nome' };
}

const EXISTING_COLUMNS = 'id, family_id, first_name, birth_date, archived_at, families(label)';

// Criança com este prontuário em QUALQUER família (staff vê todas pela RLS).
export async function findChildByChartRef(chartRef: string): Promise<ExistingChild | null> {
  const { data, error } = await supabase
    .from('children')
    .select(EXISTING_COLUMNS)
    .eq('chart_ref', chartRef)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toExistingChild(data as ExistingChildRow) : null;
}

// Crianças com o mesmo nascimento e nome começando igual (pega cadastro feito
// à mão antes da busca no Klingo, ou "Maria" x "Maria Eduarda").
export async function findSimilarChildren(
  firstName: string,
  birthDate: string,
): Promise<ExistingChild[]> {
  const name = firstName.trim().split(/\s+/)[0] ?? '';
  if (!name || !birthDate) return [];
  const pattern = `${name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await supabase
    .from('children')
    .select(EXISTING_COLUMNS)
    .eq('birth_date', birthDate)
    .ilike('first_name', pattern)
    .limit(5);
  if (error) throw error;
  return ((data ?? []) as ExistingChildRow[]).map(toExistingChild);
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
