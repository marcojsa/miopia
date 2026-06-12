import { useMutation } from '@tanstack/react-query';

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
  invited_user_id: string;
  invite_id: string;
  expires_at: string;
}

// Convida um responsável para uma família existente, via Edge Function
// 'invite-family' (precisa da service_role key, que JAMAIS entra no cliente).
//
// O contrato real da função (supabase/functions/invite-family/index.ts) exige
// email + display_name e aceita family_id (existente) OU family_label (nova).
// Aqui sempre passamos family_id, pois a família já foi criada no painel.
export function useInviteFamily() {
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
      if (error) throw error;
      if (!data) throw new Error('Resposta vazia da função de convite.');
      return data;
    },
  });
}
