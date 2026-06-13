// Consentimento LGPD pendente? (gate de entrada do app — art. 14 §1º).
// Uma criança precisa de consentimento se NÃO há aceite vigente (não revogado)
// PARA O TERMO ATIVO. Mesma regra da tela (auth)/consent.tsx — mantenha em sincronia.
// Usado pelo guard de (app)/_layout para empurrar o responsável ao consentimento
// antes de liberar as abas. A tela de consentimento, ao não achar pendência,
// faz router.replace('/') — então o gate não cria loop.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Child } from '@/types/domain';
import { useChildren } from './useChildren';
import { queryKeys } from './keys';

export interface ConsentPendingResult {
  /** true se há ≥1 criança sem consentimento vigente para o termo ativo. */
  pending: boolean;
  /** Crianças que ainda precisam de autorização (vazio quando tudo consentido). */
  pendingChildren: Child[];
}

/**
 * Verifica se o responsável logado tem consentimento pendente para alguma criança.
 * Depende de useChildren (mesmo cache de ['children']). Enquanto carrega, `pending`
 * vem false — o guard NÃO deve redirecionar em estado de loading (evita flash).
 */
export function useConsentPending(userId: string | null): UseQueryResult<ConsentPendingResult> {
  const childrenQuery = useChildren();
  const children = childrenQuery.data;

  return useQuery({
    // Inclui as crianças na key: novo filho cadastrado reavalia a pendência.
    queryKey: queryKeys.consentPending(userId, (children ?? []).map((c) => c.id)),
    // Só roda quando já sabemos quem são as crianças e há sessão.
    enabled: Boolean(userId) && children !== undefined,
    queryFn: async (): Promise<ConsentPendingResult> => {
      const kids = children ?? [];
      // Sem crianças não há nada a consentir.
      if (!userId || kids.length === 0) {
        return { pending: false, pendingChildren: [] };
      }

      // Termo ATIVO mais recente publicado.
      const { data: termRow, error: termErr } = await supabase
        .from('consent_terms')
        .select('id')
        .eq('active', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (termErr) throw termErr;

      // Sem termo ativo não há o que consentir — não trava o app.
      if (!termRow) return { pending: false, pendingChildren: [] };

      // Consentimentos vigentes (não revogados) deste responsável para o termo ativo.
      const { data: consentRows, error: consentErr } = await supabase
        .from('consents')
        .select('child_id')
        .eq('user_id', userId)
        .eq('term_id', termRow.id)
        .is('revoked_at', null);
      if (consentErr) throw consentErr;

      const consented = new Set((consentRows ?? []).map((c) => c.child_id));
      const pendingChildren = kids.filter((c) => !consented.has(c.id));

      return { pending: pendingChildren.length > 0, pendingChildren };
    },
  });
}
