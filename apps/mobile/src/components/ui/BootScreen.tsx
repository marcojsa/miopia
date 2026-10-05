// Tela de espera enquanto a sessão/consentimento são resolvidos: fundo do app e a
// Lumi, em vez de uma tela branca.
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LumiOwl } from '@/components/lumi/LumiOwl';
import { colors, spacing } from '@/theme/tokens';

export function BootScreen() {
  return (
    <View style={styles.root} accessibilityLabel="Carregando">
      <LumiOwl size={88} />
      <ActivityIndicator color={colors.purple} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  spinner: {
    marginTop: spacing.lg,
  },
});
