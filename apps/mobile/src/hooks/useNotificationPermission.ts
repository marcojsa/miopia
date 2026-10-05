// Estado da permissão de notificação deste aparelho + se o primer já foi visto.
// Relê ao voltar ao app (o responsável pode ter mudado nas configurações).
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  getNotificationPermission,
  wasPrimerSeen,
  type NotificationPermission,
} from '@/lib/notifications/permission';

export interface NotificationPermissionState {
  permission: NotificationPermission | null;
  primerSeen: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useNotificationPermission(): NotificationPermissionState {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [primerSeen, setPrimerSeen] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    const [perm, seen] = await Promise.all([getNotificationPermission(), wasPrimerSeen()]);
    setPermission(perm);
    setPrimerSeen(seen);
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { permission, primerSeen, isLoading: permission === null, refresh };
}
