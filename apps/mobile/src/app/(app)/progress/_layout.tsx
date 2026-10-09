// Stack interna da aba Progresso (seletor de filho -> dashboard por filho).
// Sem medição na família a aba fica escondida; quem chega pela URL volta à Hoje.
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui';
import { useHasMeasurements } from '@/hooks';
import { colors } from '@/theme/tokens';

export default function ProgressLayout() {
  const hasMeasurements = useHasMeasurements();

  // Sem resposta ainda (ou "sem medição" sendo conferido de novo): espera em vez
  // de abrir a tela e piscar o estado de erro.
  const waiting =
    hasMeasurements.isLoading || (hasMeasurements.data === false && hasMeasurements.isFetching);
  if (waiting) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }
  if (hasMeasurements.data === false) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[childId]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
});
