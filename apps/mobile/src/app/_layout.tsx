// Layout raiz: providers + inicialização do sistema de notificações + sync do outbox.
// TODO: visual pós-aprovação dos mockups (tema, splash, fontes).
import NetInfo from '@react-native-community/netinfo';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { persistOptions, queryClient } from '@/lib/queryClient';
import { ensureAndroidChannels } from '@/lib/notifications/channels';
import { registerCheckinCategory } from '@/lib/notifications/categories';
import { processNotificationResponseOnce } from '@/lib/notifications/responses';
import { flushOutbox } from '@/lib/outbox';
import { AuthProvider } from '@/providers/auth';

// Lembrete deve aparecer mesmo com o app em foreground (pai pode estar no app às 20h30).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function useNotificationSetup() {
  // Canais Android (antes de QUALQUER agendamento) + categoria com botões Feito/Pular.
  useEffect(() => {
    void ensureAndroidChannels();
    void registerCheckinCategory();
  }, []);

  // Respostas com o app vivo (foreground/background).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      void processNotificationResponseOnce(resp);
    });
    return () => sub.remove();
  }, []);

  // Cold start: iOS pode segurar a resposta até a próxima abertura do app.
  // processNotificationResponseOnce deduplica contra o listener acima.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (lastResponse) void processNotificationResponseOnce(lastResponse);
  }, [lastResponse]);
}

function useOutboxSync() {
  // Reconexão de rede -> tenta enviar check-ins pendentes.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flushOutbox();
    });
    return unsubscribe;
  }, []);

  // App voltou ao foreground -> idem.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOutbox();
    });
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useNotificationSetup();
  useOutboxSync();

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="checkin/[id]"
            options={{ presentation: 'modal', headerShown: true, title: 'Check-in' }}
          />
        </Stack>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
