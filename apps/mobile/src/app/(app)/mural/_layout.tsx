// Stack interna da aba Mural (lista de conteúdos -> detalhe com o vídeo).
import { Stack } from 'expo-router';

export default function MuralLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
