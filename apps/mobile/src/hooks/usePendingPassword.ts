// A conta da sessão abriu o convite e ainda não criou a senha? Os guards mandam
// de volta para /convite em vez de liberar o app.
import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { readPendingPassword } from '@/lib/pendingPassword';

export function usePendingPassword(userId: string | null): { isLoading: boolean; pending: boolean } {
  const [state, setState] = useState<{ userId: string | null; pending: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    void readPendingPassword().then((stored) => {
      if (active) setState({ userId, pending: stored === userId });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId) return { isLoading: false, pending: false };
  if (state?.userId !== userId) return { isLoading: true, pending: false };
  return { isLoading: false, pending: state.pending };
}

// A rota existe (src/app/convite.tsx); o cast cobre o .expo/types gerado antes dela.
export const CONVITE_HREF = '/convite' as string as Href;
