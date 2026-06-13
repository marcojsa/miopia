// Card de progresso até o próximo marco (mockup .card + .prog-row):
// título "Constelação da Coruja · 30 noites", barra com gradiente amarelo e
// contador "27 de 30". Microcopy "Faltam N noites para...".
// Celebra ADESÃO (noites de cuidado), nunca resultado clínico. A barra/contagem
// são noites de cuidado — nenhum número clínico aqui (ANVISA).
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, fonts, radii, spacing } from '@/theme/tokens';

const MILESTONE_TITLE: Record<7 | 30 | 90, string> = {
  7: 'Primeira constelação · 7 noites',
  30: 'Constelação da Coruja · 30 noites',
  90: 'Diploma do Cuidado · 90 noites',
};

// Marco anterior (base da barra) para o preenchimento ser proporcional ao trecho.
const PREVIOUS: Record<7 | 30 | 90, number> = { 7: 0, 30: 7, 90: 30 };

export interface MilestoneProgressProps {
  totalNights: number;
  nextMilestone: 7 | 30 | 90 | null;
  nightsToNextMilestone: number;
}

function nightWord(n: number): string {
  return n === 1 ? 'noite' : 'noites';
}

export function MilestoneProgress({
  totalNights,
  nextMilestone,
  nightsToNextMilestone,
}: MilestoneProgressProps) {
  // 90 conquistado: card de celebração, sem barra "faltando".
  if (nextMilestone === null) {
    return (
      <View style={styles.card}>
        <AppText variant="cardTitle" color={colors.white} style={styles.title}>
          Céu completo · Diploma do Cuidado
        </AppText>
        <AppText style={styles.done} color={colors.purple200}>
          90 noites de cuidado. Que constelação linda vocês construíram.
        </AppText>
      </View>
    );
  }

  const base = PREVIOUS[nextMilestone];
  const span = nextMilestone - base;
  const progress = Math.max(0, Math.min(1, (totalNights - base) / span));

  return (
    <View style={styles.card}>
      <AppText variant="cardTitle" color={colors.white} style={styles.title}>
        {MILESTONE_TITLE[nextMilestone]}
      </AppText>
      <View
        style={styles.progRow}
        accessibilityLabel={`${totalNights} de ${nextMilestone} noites de cuidado. Faltam ${nightsToNextMilestone} ${nightWord(
          nightsToNextMilestone
        )}.`}
      >
        <View style={styles.track}>
          <LinearGradient
            colors={['#E8B14A', colors.star]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${progress * 100}%` }]}
          />
        </View>
        <AppText style={styles.count} color={colors.star}>
          {totalNights} de {nextMilestone}
        </AppText>
      </View>
      <AppText style={styles.caption} color={colors.purple200}>
        Faltam {nightsToNextMilestone} {nightWord(nightsToNextMilestone)} para a{' '}
        {MILESTONE_TITLE[nextMilestone].split(' · ')[0]}.
      </AppText>
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
  progRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  track: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  count: {
    fontFamily: fonts.interBold,
    fontSize: 13,
  },
  caption: {
    fontFamily: fonts.interMedium,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  done: {
    fontFamily: fonts.interMedium,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 6,
  },
});
