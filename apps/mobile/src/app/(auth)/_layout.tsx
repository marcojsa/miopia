// Grupo (auth): welcome -> sign-in -> consent. Se já há sessão, vai direto ao app.
import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/providers/auth';

export default function AuthLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return null; // aguardando sessão persistida do AsyncStorage
  if (session) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="consent" />
    </Stack>
  );
}
