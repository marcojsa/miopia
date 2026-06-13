// O CÉU (modo criança) — tela cheia, sem tab bar (mockup docs/mockups/ceu.html,
// coruja estilo A). Aberta pela tab Hoje (SkyTeaserCard -> router.push('/ceu')).
// Mostra, sobre o gradiente do céu: o mês corrente de noites de cuidado do filho
// ativo (estrelas por computeSky), o progresso até o próximo marco, os 3 marcos
// 7/30/90, os escudos guardados e a Lumi com um incentivo contextual.
//
// REGRAS DURAS (ANVISA RDC 657/2022 + LGPD): NENHUM dado/número clínico aparece
// aqui — a recompensa é sempre por ADESÃO (noites de cuidado), jamais por
// resultado de consulta. Amarelo-estrela é exclusivo das estrelas/escudos/marcos.
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LumiBubble,
  MilestoneCards,
  MilestoneProgress,
  ShieldRow,
  SkyCanvas,
  SkyLegend,
} from '@/components/ceu';
import { XIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { useAdherenceLogs, useChildren, usePausedDates, useTreatments } from '@/hooks';
import { localDateString } from '@/lib/date';
import {
  computeShields,
  computeSky,
  computeStreakAndMilestones,
} from '@/lib/gamification';
import { useUiStore } from '@/stores/ui';
import { colors, fonts, gradients, spacing } from '@/theme/tokens';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export default function CeuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const activeChildId = useUiStore((s) => s.activeChildId);
  const childrenQuery = useChildren();

  // Filho do céu: o ativo; se sumiu/ausente, o primeiro da família.
  const children = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const child = useMemo(() => {
    const byActive = children.find((c) => c.id === activeChildId);
    return byActive ?? children[0] ?? null;
  }, [children, activeChildId]);
  const childId = child?.id ?? '';

  const treatmentsQuery = useTreatments(childId || undefined);
  const adherenceQuery = useAdherenceLogs(childId);
  const pausedQuery = usePausedDates(childId);

  const today = localDateString();
  const monthYM = today.slice(0, 7); // 'YYYY-MM'
  const monthLabel = MONTH_NAMES[Number(monthYM.slice(5, 7)) - 1];

  // starts_on = o mais antigo dos tratamentos ativos (mesma base da Hoje, p/
  // o céu bater com a meta da semana e os escudos).
  const startsOn = useMemo(() => {
    const list = treatmentsQuery.data ?? [];
    if (list.length === 0) return undefined;
    return list.reduce((min, t) => (t.starts_on < min ? t.starts_on : min), list[0].starts_on);
  }, [treatmentsQuery.data]);

  const logs = adherenceQuery.data ?? [];
  const pausedDates = pausedQuery.data?.pausedDates ?? [];

  const sky = useMemo(
    () => computeSky(logs, pausedDates, monthYM, startsOn ?? today, today),
    [logs, pausedDates, monthYM, startsOn, today]
  );
  const shields = useMemo(
    () => computeShields(logs, pausedDates, today, startsOn),
    [logs, pausedDates, today, startsOn]
  );
  const milestones = useMemo(
    () => computeStreakAndMilestones(logs, pausedDates, today, startsOn),
    [logs, pausedDates, today, startsOn]
  );

  const childName = child?.first_name ?? '';

  const header = (
    <View style={[styles.topbar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Fechar o céu"
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
      >
        <XIcon size={18} color={colors.white} />
      </Pressable>
      <View style={styles.title} pointerEvents="none">
        <AppText style={styles.month} color={colors.purple200}>
          {monthLabel}
        </AppText>
        <AppText accessibilityRole="header" style={styles.heading} color={colors.white}>
          {childName ? `O céu de ${childName}` : 'O céu'}
        </AppText>
      </View>
    </View>
  );

  const skyBg = (
    <LinearGradient
      colors={[...gradients.skyBackground.colors]}
      locations={[...gradients.skyBackground.locations]}
      start={gradients.skyBackground.start}
      end={gradients.skyBackground.end}
      style={StyleSheet.absoluteFill}
    />
  );

  // Sem filho cadastrado: estado acolhedor (nunca de erro/fracasso).
  if (!childrenQuery.isLoading && children.length === 0) {
    return (
      <Screen background={colors.purple950} edges={[]}>
        <StatusBar style="light" />
        {skyBg}
        {header}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<LumiOwl size={88} />}
            title="O céu ainda não começou"
            message="Assim que a clínica cadastrar o tratamento, cada noite de cuidado vira uma estrela aqui."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen background={colors.purple950} edges={[]}>
      <StatusBar style="light" />
      {skyBg}
      {header}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <SkyCanvas days={sky} today={today} childName={childName} />
        <SkyLegend />

        <View style={styles.cards}>
          <MilestoneProgress
            totalNights={shields.totalNights}
            nextMilestone={milestones.nextMilestone}
            nightsToNextMilestone={milestones.nightsToNextMilestone}
          />
          <MilestoneCards
            totalNights={shields.totalNights}
            nextMilestone={milestones.nextMilestone}
            nightsToNextMilestone={milestones.nightsToNextMilestone}
          />
          <ShieldRow childName={childName} shieldsAvailable={shields.available} />
        </View>

        <View style={styles.lumi}>
          <LumiBubble
            childName={childName}
            totalNights={shields.totalNights}
            nextMilestone={milestones.nextMilestone}
            nightsToNextMilestone={milestones.nightsToNextMilestone}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.xs,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    flex: 1,
    alignItems: 'center',
    marginRight: 38, // compensa o X p/ centralizar o título
  },
  month: {
    fontFamily: fonts.interSemiBold,
    fontSize: 12,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 21,
    lineHeight: 27,
  },
  body: {
    paddingTop: spacing.xs,
  },
  cards: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  lumi: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
  },
});
