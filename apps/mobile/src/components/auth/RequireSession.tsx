// Guard para as rotas fora do grupo (app) (céu e check-in vindo de notificação):
// sem sessão manda à Welcome; com consentimento LGPD pendente, ao consentimento.
// O conteúdo só monta depois disso, então nenhuma query roda sem sessão.
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { BootScreen } from '@/components/ui';
import { useChildren, useConsentPending, useIsStaff } from '@/hooks';
import { useSession } from '@/providers/auth';
import { StaffAccountScreen } from './StaffAccountScreen';

export function RequireSession({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession();
  const staff = useIsStaff();
  const childrenQuery = useChildren();
  const consent = useConsentPending(session?.user.id ?? null);

  if (isLoading) return <BootScreen />;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (staff.isLoading || childrenQuery.isLoading || consent.isLoading) return <BootScreen />;
  if (staff.data === true) return <StaffAccountScreen />;
  if (consent.data?.pending) return <Redirect href="/(auth)/consent" />;

  return <>{children}</>;
}
