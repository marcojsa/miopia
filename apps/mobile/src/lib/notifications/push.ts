// Push remoto (Expo Push) — MVP é SÓ o encanamento (design-mobile §push):
// registra o ExpoPushToken em push_tokens; o único caso de uso
// ("resultados da consulta disponíveis") é disparado por Edge Function na fase 2.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '../supabase';

/**
 * Registra o token de push do aparelho para o usuário logado.
 * Chamar após login/consentimento, NUNCA bloquear o fluxo se falhar.
 * Retorna o token ou null (simulador, sem permissão, sem projectId EAS).
 */
export async function registerPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // push não funciona em simulador

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null; // permissão é pedida no primer do onboarding

    // projectId vem da config EAS (eas init); sem ele não há token — stub até a Fase 5.
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    if (!projectId) {
      console.warn('[push] projectId EAS ausente — registro de push adiado (stub).');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_token' }
    );
    if (error) {
      console.warn('[push] falha ao salvar token:', error.message);
      return null;
    }
    return token;
  } catch (e) {
    console.warn('[push] registro falhou (não bloqueante):', e);
    return null;
  }
}
