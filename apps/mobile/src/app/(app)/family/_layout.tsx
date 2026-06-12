// Stack interna da aba Família (lista -> detalhe do filho / lembretes / ajuda / conta).
import { Stack } from 'expo-router';

export default function FamilyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="child/[childId]" />
      <Stack.Screen name="reminders/[childId]" />
      <Stack.Screen name="notifications-help" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
