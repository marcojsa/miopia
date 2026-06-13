// Card "Meta da semana" (mockup .meta): 7 estrelas seg->dom (computeWeek),
// contador "X de 7 noites", microcopy 5/7 perdoadora, e duas linhas de meta
// de ADESÃO — escudos guardados (computeShields) e próximo marco
// (computeStreakAndMilestones). Nenhum número clínico (ANVISA): só noites de
// cuidado. Estrelas em amarelo-estrela (uso exclusivo); prata = salva por escudo.
import { StyleSheet, View } from 'react-native';

import { CloudIcon, ShieldIcon, StarIcon, type StarIconVariant } from '@/components/icons';
import { AppText, Card } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme/tokens';
import type { WeekDay, WeekDayState } from '@/lib/gamification';

const WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;

export interface WeekGoalCardProps {
  /** 7 dias seg->dom (computeWeek().days). */
  week: WeekDay[];
  completedNights: number;
  metFiveOfSeven: boolean;
  totalNights: number;
  shieldsAvailable: number;
  nextMilestone: 7 | 30 | 90 | null;
  nightsToNextMilestone: number;
}

const STAR_FOR_STATE: Record<Exclude<WeekDayState, 'cloud'>, StarIconVariant> = {
  gold: 'filled',
  silver: 'silver',
  empty: 'empty',
  today_pending: 'today',
  future: 'empty',
};

function DayMark({ state }: { state: WeekDayState }) {
  if (state === 'cloud') return <CloudIcon size={20} />;
  return <StarIcon size={20} variant={STAR_FOR_STATE[state]} />;
}

const MILESTONE_LABEL: Record<7 | 30 | 90, string> = {
  7: 'primeira constelação',
  30: 'Constelação da Coruja',
  90: 'Diploma do Cuidado',
};

function nightWord(n: number): string {
  return n === 1 ? 'noite' : 'noites';
}

export function WeekGoalCard({
  week,
  completedNights,
  metFiveOfSeven,
  totalNights,
  shieldsAvailable,
  nextMilestone,
  nightsToNextMilestone,
}: WeekGoalCardProps) {
  const a11yMilestone =
    nextMilestone === null
      ? 'Você completou o Diploma do Cuidado: 90 noites de cuidado.'
      : `Faltam ${nightsToNextMilestone} ${nightWord(nightsToNextMilestone)} para a ${MILESTONE_LABEL[nextMilestone]}.`;

  return (
    <Card>
      <View style={styles.topRow}>
        <AppText variant="cardTitle" style={styles.title}>
          Meta da semana
        </AppText>
        <AppText variant="meta" color={colors.purple} style={styles.count}>
          {completedNights} de 7 noites
        </AppText>
      </View>

      <View
        style={styles.week}
        accessibilityLabel={`${completedNights} de 7 noites de cuidado nesta semana.`}
      >
        {week.map((day, i) => {
          const isToday = day.state === 'today_pending';
          return (
            <View key={day.date} style={styles.day}>
              <DayMark state={day.state} />
              <AppText
                style={[styles.dayLabel, isToday ? styles.dayLabelToday : null]}
                color={isToday ? colors.purple : colors.ink3}
              >
                {isToday ? 'hoje' : WEEKDAY_LABELS[i]}
              </AppText>
            </View>
          );
        })}
      </View>

      <AppText variant="meta" style={styles.microcopy}>
        {metFiveOfSeven
          ? 'Meta da semana alcançada: 5 de 7 noites. Que cuidado bonito.'
          : 'A meta é 5 de 7 noites. Uma noite perdida não apaga as outras.'}
      </AppText>

      <View style={styles.metaSub}>
        <ShieldIcon size={16} variant="filled" />
        <AppText variant="meta" style={styles.metaText}>
          {totalNights} {nightWord(totalNights)} de cuidado no total
          {shieldsAvailable > 0
            ? ` · ${shieldsAvailable} ${shieldsAvailable === 1 ? 'escudo guardado' : 'escudos guardados'}`
            : ''}
        </AppText>
      </View>

      <View style={styles.metaMark}>
        <StarIcon size={15} variant="filled" />
        <AppText variant="meta" style={styles.metaText} accessibilityLabel={a11yMilestone}>
          {nextMilestone === null
            ? 'Diploma do Cuidado conquistado: 90 noites.'
            : `Faltam ${nightsToNextMilestone} ${nightWord(nightsToNextMilestone)} para a ${MILESTONE_LABEL[nextMilestone]}`}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
  },
  count: {
    fontFamily: fonts.interBold,
    fontSize: 13,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  day: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayLabel: {
    fontFamily: fonts.interSemiBold,
    fontSize: 10.5,
  },
  dayLabelToday: {
    fontFamily: fonts.interBold,
  },
  microcopy: {
    marginTop: spacing.md,
  },
  metaSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  metaMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 7,
  },
  metaText: {
    flex: 1,
  },
});
