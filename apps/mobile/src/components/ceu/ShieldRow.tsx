// Card dos escudos da criança (mockup .card + .shield-row): 3 slots — escudos
// guardados (dourado preenchido) vs vazios (tracejado) — e o microcopy do
// perdão: "A cada 7 noites, 1 escudo novo. Uma noite perdida usa 1 escudo e a
// sequência continua." Sem tom de fracasso, sem número clínico (ANVISA).
import { StyleSheet, View } from 'react-native';

import { ShieldIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme/tokens';

const MAX_SHIELDS = 3;

export interface ShieldRowProps {
  childName: string;
  /** Escudos guardados hoje (0..3). */
  shieldsAvailable: number;
}

export function ShieldRow({ childName, shieldsAvailable }: ShieldRowProps) {
  const slots = Array.from({ length: MAX_SHIELDS }, (_, i) => i < shieldsAvailable);
  const a11y =
    shieldsAvailable === 0
      ? `${childName} ainda não tem escudos guardados. A cada 7 noites completas, ganha 1.`
      : `${childName} tem ${shieldsAvailable} ${
          shieldsAvailable === 1 ? 'escudo guardado' : 'escudos guardados'
        } de 3.`;

  return (
    <View style={styles.card}>
      <AppText variant="cardTitle" color={colors.white} style={styles.title}>
        Escudos de {childName}
      </AppText>
      <View style={styles.row}>
        <View style={styles.slots} accessibilityLabel={a11y}>
          {slots.map((filled, i) => (
            <View key={i} style={[styles.slot, filled ? null : styles.slotEmpty]}>
              <ShieldIcon
                size={filled ? 32 : 28}
                variant={filled ? 'filled' : 'empty'}
                color={filled ? colors.star : colors.purple200}
              />
            </View>
          ))}
        </View>
        <AppText style={styles.caption} color={colors.purple200}>
          A cada 7 noites, 1 escudo novo. Uma noite perdida usa 1 escudo e a sequência continua.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  slots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  slot: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmpty: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    borderRadius: 13,
  },
  caption: {
    flex: 1,
    fontFamily: fonts.interMedium,
    fontSize: 11.5,
    lineHeight: 17,
  },
});
