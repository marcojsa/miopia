// Conteúdos publicados do mural da clínica (RLS: a família só lê os publicados).
// Conteúdo educativo — nenhum dado clínico da criança passa por aqui (ANVISA).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import type { Content, ContentCategory } from '@/types/domain';
import { queryKeys } from './keys';

const CATEGORIES: readonly ContentCategory[] = ['lente', 'colirio', 'oculos', 'geral'];

function toCategory(value: string): ContentCategory {
  return (CATEGORIES as readonly string[]).includes(value) ? (value as ContentCategory) : 'geral';
}

/**
 * Ordem do mural: sort_order crescente, depois o mais novo primeiro. Busca de
 * novo ao montar e ao o app voltar ao primeiro plano: o que a clínica publica
 * (ou tira do ar) precisa chegar logo; o cache persistido abre na hora e offline.
 */
export function useContents(): UseQueryResult<Content[]> {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: queryKeys.contents(userId),
    enabled: userId !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async (): Promise<Content[]> => {
      const { data, error } = await supabase
        .from('contents')
        .select('id, title, body, youtube_url, category, sort_order, created_at')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, category: toCategory(row.category) }));
    },
  });
}
