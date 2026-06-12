// Stack interna da aba Progresso (seletor de filho -> dashboard por filho).
import { Stack } from 'expo-router';

export default function ProgressLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[childId]" />
    </Stack>
  );
}
