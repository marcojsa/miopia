import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface InviteInput {
  family_id: string;
  email: string;
  display_name: string;
  relationship?: string;
  is_primary?: boolean;
}

export interface InviteResult {
  family_id: string;
  family_created: boolean;
  invited_user_id: string | null;
  invite_id: string;
  expires_at: string;
  /** true quando era um convite pendente e o e-mail foi apenas reenviado. */
  resent?: boolean;
}

const INVITE_ERRORS: Record<string, string> = {
  email_already_registered:
    'Este e-mail já tem conta no app. Se a pessoa não consegue entrar, peça que use Entrar › Esqueci minha senha no app.',
  primary_already_set:
    'Esta família já tem um responsável principal. Desmarque "Responsável principal" e envie de novo.',
  family_not_found: 'Família não encontrada.',
  not_staff: 'Sua conta não tem perfil de equipe para enviar convites.',
  invalid_email: 'E-mail inválido.',
  missing_display_name: 'Informe o nome do responsável.',
  invalid_jwt: 'Sua sessão expirou. Entre novamente.',
  missing_authorization: 'Sua sessão expirou. Entre novamente.',
};

async function inviteErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const body = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    const code = body?.error;
    if (code && INVITE_ERRORS[code]) return INVITE_ERRORS[code];
    if (!code && response.status === 404) {
      return 'A função de convite não está publicada no projeto Supabase.';
    }
    return `Não foi possível enviar o convite (${code ?? `HTTP ${response.status}`}). Tente novamente.`;
  }
  if (error instanceof FunctionsFetchError) {
    return 'Não foi possível falar com o servidor de convites. Verifique a conexão.';
  }
  return 'Não foi possível enviar o convite. Tente novamente.';
}

// A família já tem responsável principal? Define o padrão do checkbox do convite.
export function useFamilyHasPrimary(familyId: string | undefined) {
  return useQuery({
    queryKey: ['family-has-primary', familyId],
    enabled: !!familyId,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('guardians')
        .select('user_id', { count: 'exact', head: true })
        .eq('family_id', familyId!)
        .eq('is_primary', true);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

// Convida um responsável para uma família existente, via Edge Function
// 'invite-family' (precisa da service_role key, que JAMAIS entra no cliente).
//
// O contrato real da função (supabase/functions/invite-family/index.ts) exige
// email + display_name e aceita family_id (existente) OU family_label (nova).
// Aqui sempre passamos family_id, pois a família já foi criada no painel.
export function useInviteFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteInput): Promise<InviteResult> => {
      const email = input.email.trim().toLowerCase();
      const displayName = input.display_name.trim();
      if (!email) throw new Error('Informe o e-mail do responsável.');
      if (!displayName) throw new Error('Informe o nome do responsável.');

      const { data, error } = await supabase.functions.invoke<InviteResult>(
        'invite-family',
        {
          body: {
            family_id: input.family_id,
            email,
            display_name: displayName,
            relationship: input.relationship?.trim() || undefined,
            is_primary: input.is_primary ?? false,
          },
        },
      );
      if (error) throw new Error(await inviteErrorMessage(error));
      if (!data) throw new Error('Resposta vazia da função de convite.');
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['family-has-primary', result.family_id] });
    },
  });
}
