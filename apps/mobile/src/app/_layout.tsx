// Layout raiz: providers + inicialização do sistema de notificações + sync do
// outbox + carregamento das fontes do design system (Nunito títulos / Inter corpo).
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import NetInfo from '@react-native-community/netinfo';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { persistOptions, queryClient } from '@/lib/queryClient';
import { ensureAndroidChannels } from '@/lib/notifications/channels';
import { registerCheckinCategory } from '@/lib/notifications/categories';
import { processNotificationResponseOnce } from '@/lib/notifications/responses';
import { flushOutbox } from '@/lib/outbox';
import { AuthProvider } from '@/providers/auth';

// Segura o splash até as fontes carregarem (evita flash de fonte do sistema).
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* já escondido — ok */
});

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

  // Fontes do design system (theme/tokens referencia estes nomes exatos).
  const [fontsLoaded, fontError] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const fontsReady = fontsLoaded || fontError !== null; // erro: segue com fallback do sistema

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  if (!fontsReady) return null; // splash nativo permanece visível

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
          {/* Céu da criança: tela cheia sobre tudo, sem tab bar (mockup ceu.html).
              A rota app/ceu.tsx é criada pelo agente da tela Céu. */}
          <Stack.Screen name="ceu" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
