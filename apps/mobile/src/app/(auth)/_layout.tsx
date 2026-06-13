// Grupo (auth): welcome -> sign-in -> consent.
// Com sessão, welcome/sign-in não fazem sentido: redireciona ao app ('/').
// EXCEÇÃO: 'consent' é alcançado APÓS o login (precisa da sessão) — não pode ser
// redirecionado, senão o gate de (app)/_layout cria loop (/ -> consent -> /).
// Quem decide se o consent é necessário é o guard de (app); aqui só o liberamos.
import { Redirect, Stack, useSegments } from 'expo-router';

import { useSession } from '@/providers/auth';

export default function AuthLayout() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const onConsent = segments[segments.length - 1] === 'consent';

  if (isLoading) return null; // aguardando sessão persistida do AsyncStorage
  if (session && !onConsent) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="consent" />
    </Stack>
  );
}
