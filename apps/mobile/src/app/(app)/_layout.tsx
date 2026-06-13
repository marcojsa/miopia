// Grupo (app): guard de auth + gate de consentimento LGPD + 3 abas (Hoje,
// Progresso, Família). Visual dos mockups aprovados: ativo roxo #453A94,
// inativo #94A3B8, fundo branco, sem header default (cada tela cuida do topo).
//
// GATE LGPD: com sessão mas consentimento pendente para alguma criança, manda
// para (auth)/consent ANTES de liberar as abas. A tela de consentimento, ao não
// achar pendência, faz router.replace('/') — logo o gate não cria loop.
import { Redirect, Tabs } from 'expo-router';

import { DocumentIcon, MoonIcon, PeopleIcon } from '@/components/icons';
import { useConsentPending } from '@/hooks';
import { useSession } from '@/providers/auth';
import { colors, fonts } from '@/theme/tokens';

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const consent = useConsentPending(session?.user.id ?? null);

  if (isLoading) return null; // aguardando sessão persistida do AsyncStorage
  if (!session) return <Redirect href="/(auth)/welcome" />;

  // Segura a renderização enquanto a 1ª checagem de consentimento corre, para
  // não piscar as abas antes de redirecionar (retornantes têm cache persistido,
  // então não há espera). Em erro/offline a query resolve sem dado -> fail-open:
  // o app abre normalmente (não trancamos um usuário pago por falta de rede).
  if (consent.isLoading) return null;

  // Só redireciona quando a checagem RESOLVEU com pendência (evita flash em loading).
  if (consent.data?.pending) return <Redirect href="/(auth)/consent" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.nunitoExtraBold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarIcon: ({ color, size }) => <MoonIcon color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progresso',
          tabBarIcon: ({ color, size }) => <DocumentIcon color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Família',
          tabBarIcon: ({ color, size }) => <PeopleIcon color={color} size={size ?? 24} />,
        }}
      />
    </Tabs>
  );
}
