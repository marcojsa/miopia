// Dados locais POR USUÁRIO (cache persistido, outbox, lembretes) e saída
// do aparelho. A pausa de férias fica: as chaves levam o id do usuário
// (usePausedDates). As query keys não levam o id do usuário: ao trocar de conta,
// tudo isso precisa sumir, senão a próxima família vê os dados da anterior (LGPD).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { useUiStore } from '../stores/ui';
import { cancelAllSchedules } from './notifications/scheduler';
import { asyncStoragePersister, queryClient } from './queryClient';
import { supabase } from './supabase';

/** Último usuário que usou o app neste aparelho (detecta troca de conta). */
export const LAST_USER_KEY = 'auth:last-user-id';

function isUserScopedKey(key: string): boolean {
  return key === 'outbox:checkins' || key.startsWith('reminders:');
}

/** Apaga do aparelho tudo o que pertence ao usuário que estava logado. */
export async function clearLocalUserData(): Promise<void> {
  try {
    await cancelAllSchedules();
    if (Platform.OS !== 'web') await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Sem permissão de notificação: nada agendado para limpar.
  }
  await queryClient.cancelQueries();
  queryClient.clear();
  useUiStore.setState({ activeChildId: null, pendingCheckin: null });
  try {
    await asyncStoragePersister.removeClient();
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(isUserScopedKey));
  } catch {
    // Storage indisponível: o cache em memória já foi limpo acima.
  }
}

/** Chave em que o supabase-js grava a sessão (protegida no tipo, pública em runtime). */
export function authStorageKey(): string {
  return (supabase.auth as unknown as { storageKey: string }).storageKey;
}

/**
 * Id do usuário da sessão gravada, sem rede: getSession() pode esperar ~25 s
 * tentando renovar um token vencido e devolver null offline.
 */
export async function storedUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(authStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: { id?: unknown } } | null;
    return typeof parsed?.user?.id === 'string' ? parsed.user.id : null;
  } catch {
    return null;
  }
}

/**
 * Sai deste aparelho. Se o servidor não responder (sem rede, backend fora do ar,
 * token vencido sem conseguir renovar), apaga a sessão local mesmo assim: sair
 * nunca pode depender de rede. Devolve false quando o servidor não foi avisado.
 */
export async function signOutDoAparelho(): Promise<{ servidorAvisado: boolean }> {
  let servidorAvisado = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) servidorAvisado = false;
  } catch {
    servidorAvisado = false;
  }

  if (!servidorAvisado) {
    const key = authStorageKey();
    await AsyncStorage.multiRemove([key, `${key}-code-verifier`]);
    // Sem sessão no storage o signOut não chama o servidor: só limpa a memória
    // e emite SIGNED_OUT, que o AuthProvider usa para mandar à Welcome.
    await supabase.auth.signOut({ scope: 'local' });
  }

  await clearLocalUserData();
  return { servidorAvisado };
}
