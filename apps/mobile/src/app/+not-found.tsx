// Rota não encontrada (deep link inválido, etc.).
// TODO: visual pós-aprovação dos mockups.
import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <View>
        <Text>Página não encontrada</Text>
        <Link href="/">
          <Text>Voltar para o início</Text>
        </Link>
      </View>
    </>
  );
}
