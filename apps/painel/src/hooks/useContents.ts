import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Content, ContentInput } from '@/types/database';
import { useAuth } from '@/auth/AuthContext';

const CONTENTS_KEY = ['contents'] as const;
const COLUMNS =
  'id, title, body, youtube_url, category, sort_order, published, created_by, created_at, updated_at';

// Mural: todos os conteúdos (staff vê rascunhos; cont_staff_all), na ordem de exibição.
export function useContents() {
  return useQuery({
    queryKey: CONTENTS_KEY,
    queryFn: async (): Promise<Content[]> => {
      const { data, error } = await supabase
        .from('contents')
        .select(COLUMNS)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvalidateContents() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: CONTENTS_KEY });
}

// Conteúdo novo entra no topo do mural (sort_order abaixo do menor existente).
export function useCreateContent() {
  const invalidate = useInvalidateContents();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: ContentInput): Promise<void> => {
      const { data: first, error: firstError } = await supabase
        .from('contents')
        .select('sort_order')
        .order('sort_order', { ascending: true })
        .limit(1);
      if (firstError) throw firstError;
      const { error } = await supabase.from('contents').insert({
        ...input,
        sort_order: first && first.length > 0 ? first[0].sort_order - 1 : 0,
        created_by: session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

async function updateContent(id: string, values: Partial<ContentInput> & { sort_order?: number }) {
  const { data, error } = await supabase.from('contents').update(values).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Conteúdo não encontrado ou sem permissão.');
}

export function useUpdateContent() {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ContentInput }) => updateContent(id, values),
    onSuccess: invalidate,
  });
}

export function useSetContentPublished() {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      updateContent(id, { published }),
    onSuccess: invalidate,
  });
}

export function useDeleteContent() {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data, error } = await supabase.from('contents').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Conteúdo não encontrado ou sem permissão.');
    },
    onSuccess: invalidate,
  });
}

// Reordenar: recebe a lista já na ordem nova e regrava sort_order = 1..n
// (só nas linhas que mudaram).
export function useReorderContents() {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: async (ordered: Pick<Content, 'id' | 'sort_order'>[]): Promise<void> => {
      await Promise.all(
        ordered
          .map((item, index) => ({ id: item.id, from: item.sort_order, to: index + 1 }))
          .filter((item) => item.from !== item.to)
          .map((item) => updateContent(item.id, { sort_order: item.to })),
      );
    },
    onSettled: invalidate,
  });
}
