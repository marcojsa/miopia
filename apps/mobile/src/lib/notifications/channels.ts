// Canais Android — criar no startup, ANTES de qualquer agendamento.
// Sem channelId explícito o expo-notifications usa o canal 'Miscellaneous' silencioso:
// lembrete que não toca é lembrete que não existe (design-mobile §canais).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_CHANNEL_ID = 'lembretes-tratamento';
export const CLINIC_CHANNEL_ID = 'clinica';

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Lembretes do tratamento',
    importance: Notifications.AndroidImportance.MAX, // heads-up + som
    sound: 'default', // som custom = asset nativo; decidir ANTES do 1º dev build
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Canal separado: o responsável pode silenciar avisos da clínica sem matar os lembretes.
  await Notifications.setNotificationChannelAsync(CLINIC_CHANNEL_ID, {
    name: 'Avisos da clínica',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
