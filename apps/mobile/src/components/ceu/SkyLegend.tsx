// Legenda do céu (mockup .legend): dourada = noite completa, prateada = salva
// por escudo, nuvem = férias. Três itens centralizados sobre o gradiente do céu.
// Sem dado clínico — só explica os símbolos de ADESÃO.
import { StyleSheet, View } from 'react-native';

import { CloudIcon, StarIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme/tokens';

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.item}>
      <View style={styles.icon}>{icon}</View>
      <AppText style={styles.label} color={colors.purple200}>
        {label}
      </AppText>
    </View>
  );
}

export function SkyLegend() {
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LegendItem icon={<StarIcon size={13} variant="filled" />} label="noite completa" />
      <LegendItem icon={<StarIcon size={13} variant="silver" />} label="salva por escudo" />
      <LegendItem icon={<CloudIcon size={18} />} label="férias" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  icon: {
    width: 18,
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10.5,
  },
});
