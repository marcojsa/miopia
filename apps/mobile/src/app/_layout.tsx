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
import { focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

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

// Web (só para testes automatizados): expo-notifications não existe no navegador e
// LANÇA — tela branca. Nada disso roda no web; no aparelho o comportamento é o
// mesmo de antes.
const NOTIFICACOES_DISPONIVEIS = Platform.OS !== 'web';

// No aparelho o React Query não sabe sozinho de foco nem de rede: sem isto,
// refetchOnWindowFocus/refetchOnReconnect nunca disparam e a Hoje pode seguir com
// os check-ins de ontem. No web os padrões do próprio React Query já funcionam.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false))
  );
}

function useNotificationSetup() {
  // Canais Android (antes de QUALQUER agendamento) + categoria com botões Feito/Pular.
  useEffect(() => {
    if (!NOTIFICACOES_DISPONIVEIS) return;
    void ensureAndroidChannels();
    void registerCheckinCategory();
  }, []);

  // Respostas com o app vivo (foreground/background).
  useEffect(() => {
    if (!NOTIFICACOES_DISPONIVEIS) return;
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      void processNotificationResponseOnce(resp);
    });
    return () => sub.remove();
  }, []);

  // Cold start: a resposta que abriu o app (iOS pode segurá-la até a próxima
  // abertura). Lida uma vez e limpa; processNotificationResponseOnce deduplica
  // contra o listener acima. A navegação do tap no corpo fica pendente na store
  // até o grupo (app) montar, então não depende do Stack já existir aqui.
  useEffect(() => {
    if (!NOTIFICACOES_DISPONIVEIS) return;
    const last = Notifications.getLastNotificationResponse();
    if (last) void processNotificationResponseOnce(last);
    Notifications.clearLastNotificationResponse();
  }, []);
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

// Status bar por rota: telas com topo roxo escuro (Hoje, login/consentimento/
// boas-vindas, Céu, links de convite e senha) pedem ícones claros; o resto tem
// topo claro. Um único StatusBar na raiz evita que as abas (que ficam todas
// montadas) disputem o estilo entre si.
const ROTAS_TOPO_ESCURO = new Set(['(auth)', 'convite', 'recuperar-senha']);

function RouteStatusBar() {
  const segments = useSegments() as string[];
  const [first, second] = segments;
  const hoje = first === '(app)' && (second === undefined || second === 'index');
  const ceu = first === '(app)' && second === 'ceu';
  const escuro = hoje || ceu || (first !== undefined && ROTAS_TOPO_ESCURO.has(first));
  return <StatusBar style={escuro ? 'light' : 'dark'} />;
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
        <RouteStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="checkin/[id]"
            options={{ presentation: 'modal', headerShown: true, title: 'Check-in' }}
          />
          {/* Links de e-mail (convite e recuperação): fora dos guards, abrem a sessão pelo link. */}
          <Stack.Screen name="convite" />
          <Stack.Screen name="recuperar-senha" />
        </Stack>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
