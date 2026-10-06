// Grupo (auth): welcome -> sign-in -> consent.
// Com sessão, welcome/sign-in não fazem sentido: redireciona ao app ('/').
// EXCEÇÃO: 'consent' é alcançado APÓS o login (precisa da sessão) — não pode ser
// redirecionado, senão o gate de (app)/_layout cria loop (/ -> consent -> /).
// Quem decide se o consent é necessário é o guard de (app); aqui só o liberamos.
import { Redirect, Stack, useSegments } from 'expo-router';

import { BootScreen } from '@/components/ui';
import { useIsStaff } from '@/hooks';
import { useSession } from '@/providers/auth';

export default function AuthLayout() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const onConsent = segments[segments.length - 1] === 'consent';
  const staff = useIsStaff();

  if (isLoading) return <BootScreen />; // aguardando sessão persistida do AsyncStorage
  // Conta da equipe não consente como responsável: o guard de (app) mostra o aviso.
  if (session && (!onConsent || staff.data === true)) return <Redirect href="/" />;
  // Sem sessão o consentimento não tem o que carregar: volta à Welcome.
  if (!session && onConsent) return <Redirect href="/(auth)/welcome" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="consent" />
    </Stack>
  );
}
