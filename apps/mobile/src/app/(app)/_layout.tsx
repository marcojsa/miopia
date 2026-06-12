// Grupo (app): guard de auth + 3 abas (Hoje, Progresso, Família — design-mobile §navegação).
// TODO: visual pós-aprovação dos mockups (ícones, cores da tab bar).
import { Redirect, Tabs } from 'expo-router';

import { useSession } from '@/providers/auth';

export default function AppLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return null; // aguardando sessão persistida do AsyncStorage
  if (!session) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progresso' }} />
      <Tabs.Screen name="family" options={{ title: 'Família' }} />
    </Tabs>
  );
}
