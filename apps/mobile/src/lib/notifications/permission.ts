// Permissão de notificação (Android 13+ POST_NOTIFICATIONS é de runtime: sem ela o
// lembrete é agendado e o sistema o descarta em silêncio) + marca do primer.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PRIMER_SEEN_KEY = 'notifications:primer-seen';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface NotificationPermission {
  status: NotificationPermissionStatus;
  canAskAgain: boolean;
}

function fromResponse(res: Notifications.NotificationPermissionsStatus): NotificationPermission {
  const provisional = res.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (res.granted || provisional) return { status: 'granted', canAskAgain: true };
  return {
    status: String(res.status) === 'denied' ? 'denied' : 'undetermined',
    canAskAgain: res.canAskAgain,
  };
}

/** Estado atual, sem perguntar. No web (só testes) não há notificação: 'unavailable'. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') return { status: 'unavailable', canAskAgain: false };
  try {
    return fromResponse(await Notifications.getPermissionsAsync());
  } catch {
    return { status: 'undetermined', canAskAgain: false };
  }
}

/** Mostra o pedido do sistema quando ainda é possível; devolve o estado final. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const current = await getNotificationPermission();
  if (current.status === 'granted' || current.status === 'unavailable' || !current.canAskAgain) {
    return current;
  }
  try {
    return fromResponse(await Notifications.requestPermissionsAsync());
  } catch {
    return current;
  }
}

export async function wasPrimerSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRIMER_SEEN_KEY)) === 'true';
  } catch {
    return true; // storage indisponível: não prende o responsável no primer
  }
}

export async function markPrimerSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PRIMER_SEEN_KEY, 'true');
  } catch {
    // Sem storage o primer pode reaparecer na próxima abertura; não bloqueia.
  }
}
