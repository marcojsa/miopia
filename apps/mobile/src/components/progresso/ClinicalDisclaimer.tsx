// Rodapé fixo da aba Progresso: reforço editorial da regra ANVISA RDC 657/2022
// — o app só exibe; a interpretação clínica é sempre da médica. Tinta neutra,
// sem alarme, sem botão.
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

export function ClinicalDisclaimer() {
  return (
    <View style={styles.root}>
      <AppText variant="small" color={colors.ink3} style={styles.text}>
        Este aplicativo apenas exibe os dados registrados pela sua médica. A interpretação clínica é
        sempre dela. Em caso de dúvida, fale com a clínica.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
  },
  text: {
    textAlign: 'center',
    lineHeight: 16,
  },
});
