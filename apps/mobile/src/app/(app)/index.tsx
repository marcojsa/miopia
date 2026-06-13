// ABA HOJE (home) — VERSÃO A aprovada (docs/mockups/hoje.html).
// Responde em < 5s "o que falta fazer esta noite?": header com saudação + data,
// chips de filhos, cards de check-in de 1 toque (Feito / Não foi possível) do
// filho ativo, meta semanal perdoadora (5 de 7) e a porta de entrada para o Céu.
//
// REGRAS DURAS: nenhum dado clínico nesta tela — adesão é RELATO da família, não
// medida (ANVISA RDC 657/2022). Verde só no botão Feito; amarelo-estrela só em
// estrelas/escudos/marcos. Gamificação celebra ADESÃO, nunca resultado clínico.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GreetingHeader,
  NightDoneCard,
  SkyTeaserCard,
  TaskCard,
  WeekGoalCard,
  formatTimePtBR,
  greetingForHour,
  isScheduledToday,
  longDatePtBR,
  taskInstruction,
  taskTitle,
  type ChildChip,
} from '@/components/hoje';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, EmptyState, Screen, SectionHeader } from '@/components/ui';
import {
  markTodayPausedIfNeeded,
  queryKeys,
  useAdherenceLogs,
  useChildren,
  useCheckinMutation,
  usePausedDates,
  useTodayAdherence,
  useTreatments,
} from '@/hooks';
import { flushOutbox } from '@/lib/outbox';
import { localDateString } from '@/lib/date';
import {
  computeShields,
  computeStreakAndMilestones,
  computeWeek,
} from '@/lib/gamification';
import { useSession } from '@/providers/auth';
import { useUiStore } from '@/stores/ui';
import { colors, spacing } from '@/theme/tokens';
import type { AdherenceStatus, Treatment } from '@/types/domain';

// Nome de exibição do responsável (metadata da sessão) com fallback acolhedor.
function displayNameOf(metadata: Record<string, unknown> | undefined): string {
  const name = metadata?.display_name ?? metadata?.full_name ?? metadata?.name;
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim().split(/\s+/)[0];
  }
  return 'família';
}

// Subtítulo do chip do filho: tipo do 1º tratamento + horário (ex.: "colírio 20h30").
function chipSubtitle(treatments: Treatment[]): string | null {
  const t = treatments[0];
  if (!t) return null;
  const time = formatTimePtBR(t.suggested_time);
  const word = t.type === 'ortho_k' ? 'lente' : t.type === 'atropina' ? 'colírio' : 'cuidado';
  return time ? `${word} ${time}` : word;
}

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const activeChildId = useUiStore((s) => s.activeChildId);
  const setActiveChildId = useUiStore((s) => s.setActiveChildId);

  const childrenQuery = useChildren();
  const allTreatmentsQuery = useTreatments(); // todos da família (para os subtítulos dos chips)
  const todayQuery = useTodayAdherence();

  const childTreatmentsQuery = useTreatments(activeChildId ?? undefined);
  const adherenceQuery = useAdherenceLogs(activeChildId ?? '');
  const pausedQuery = usePausedDates(activeChildId ?? '');

  const checkin = useCheckinMutation();
  // Tratamento cujo check-in está sincronizando (bloqueia só aquele card).
  const [busyTreatmentId, setBusyTreatmentId] = useState<string | null>(null);

  const children = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);

  // Default: primeiro filho. Reage também se o filho ativo sumir (arquivado).
  useEffect(() => {
    if (children.length === 0) return;
    const exists = activeChildId && children.some((c) => c.id === activeChildId);
    if (!exists) setActiveChildId(children[0].id);
  }, [children, activeChildId, setActiveChildId]);

  // Cada noite de férias do filho ativo vira nuvem no céu (idempotente).
  useEffect(() => {
    if (activeChildId) void markTodayPausedIfNeeded(activeChildId);
  }, [activeChildId]);

  const today = localDateString();
  const now = useMemo(() => new Date(), []);
  const weekday = now.getDay();

  const activeChild = useMemo(
    () => children.find((c) => c.id === activeChildId) ?? null,
    [children, activeChildId]
  );

  // Chips: cada filho + subtítulo do 1º tratamento (da query da família inteira).
  const chips: ChildChip[] = useMemo(() => {
    const all = allTreatmentsQuery.data ?? [];
    return children.map((child) => ({
      child,
      subtitle: chipSubtitle(all.filter((t) => t.child_id === child.id)),
    }));
  }, [children, allTreatmentsQuery.data]);

  // Tratamentos do filho ativo agendados para hoje.
  const scheduledTreatments = useMemo(
    () =>
      (childTreatmentsQuery.data ?? []).filter((t) => isScheduledToday(t, today, weekday)),
    [childTreatmentsQuery.data, today, weekday]
  );

  // Logs de HOJE do filho ativo (qualquer status conta como "respondido").
  const loggedTreatmentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const log of todayQuery.data ?? []) {
      if (log.child_id === activeChildId) ids.add(log.treatment_id);
    }
    return ids;
  }, [todayQuery.data, activeChildId]);

  const pendingTreatments = useMemo(
    () => scheduledTreatments.filter((t) => !loggedTreatmentIds.has(t.id)),
    [scheduledTreatments, loggedTreatmentIds]
  );

  const allDone = scheduledTreatments.length > 0 && pendingTreatments.length === 0;

  // Gamificação (adesão do filho ativo). starts_on = o mais antigo dos tratamentos
  // ativos, para a simulação cobrir todo o período de cuidado (bate com o céu).
  const startsOn = useMemo(() => {
    const list = childTreatmentsQuery.data ?? [];
    if (list.length === 0) return undefined;
    return list.reduce((min, t) => (t.starts_on < min ? t.starts_on : min), list[0].starts_on);
  }, [childTreatmentsQuery.data]);

  const logs = adherenceQuery.data ?? [];
  const pausedDates = pausedQuery.data?.pausedDates ?? [];

  const week = useMemo(
    () => computeWeek(logs, pausedDates, today, startsOn),
    [logs, pausedDates, today, startsOn]
  );
  const shields = useMemo(
    () => computeShields(logs, pausedDates, today, startsOn),
    [logs, pausedDates, today, startsOn]
  );
  const milestones = useMemo(
    () => computeStreakAndMilestones(logs, pausedDates, today, startsOn),
    [logs, pausedDates, today, startsOn]
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await flushOutbox();
      // flushOutbox invalida a key legada ['adherence_logs']; invalidar a real aqui.
      await queryClient.invalidateQueries({ queryKey: ['adherence'] });
      await Promise.all([
        childrenQuery.refetch(),
        allTreatmentsQuery.refetch(),
        childTreatmentsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckin = (treatment: Treatment, status: AdherenceStatus): void => {
    if (!activeChildId) return;
    setBusyTreatmentId(treatment.id);
    checkin.mutate(
      { treatmentId: treatment.id, childId: activeChildId, status },
      { onSettled: () => setBusyTreatmentId((prev) => (prev === treatment.id ? null : prev)) }
    );
  };

  const greeting = greetingForHour(now.getHours());
  const displayName = displayNameOf(session?.user.user_metadata);

  // ── Estados de carregamento / erro / sem filhos ────────────────────────────
  const childrenLoading = childrenQuery.isLoading;
  const childrenError = childrenQuery.isError;

  const header = (
    <GreetingHeader
      greeting={greeting}
      displayName={displayName}
      longDate={longDatePtBR(now)}
      chips={chips}
      activeChildId={activeChildId}
      onSelectChild={setActiveChildId}
    />
  );

  if (childrenLoading) {
    return (
      <Screen edges={['left', 'right']}>
        {header}
        <View style={styles.centered}>
          <AppText variant="body" color={colors.ink2}>
            Carregando a noite de hoje...
          </AppText>
        </View>
      </Screen>
    );
  }

  if (childrenError) {
    return (
      <Screen edges={['left', 'right']}>
        {header}
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Não conseguimos carregar agora"
            message="Verifique sua internet e puxe a tela para baixo para tentar de novo."
          />
        </View>
      </Screen>
    );
  }

  if (children.length === 0) {
    return (
      <Screen edges={['left', 'right']}>
        {header}
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Nenhuma criança por aqui ainda"
            message="Assim que a clínica cadastrar o tratamento do seu filho, os cuidados da noite aparecem aqui."
          />
        </View>
      </Screen>
    );
  }

  const childName = activeChild?.first_name ?? '';

  return (
    <Screen edges={['left', 'right']}>
      {header}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void onRefresh();
            }}
            tintColor={colors.purple}
            colors={[colors.purple]}
          />
        }
      >
        <SectionHeader title="Esta noite" />

        {pendingTreatments.map((t) => (
          <TaskCard
            key={t.id}
            type={t.type}
            title={taskTitle(t.type, childName)}
            instruction={taskInstruction(t)}
            time={formatTimePtBR(t.suggested_time)}
            busy={busyTreatmentId === t.id}
            onDone={() => handleCheckin(t, 'feito')}
            onSkip={() => handleCheckin(t, 'pulado')}
          />
        ))}

        {allDone ? <NightDoneCard childName={childName} /> : null}

        {scheduledTreatments.length === 0 ? (
          <EmptyState
            title="Nenhum cuidado para esta noite"
            message={`${childName} não tem cuidados programados para hoje. Aproveite a noite.`}
            style={styles.noTasks}
          />
        ) : null}

        <WeekGoalCard
          week={week.days}
          completedNights={week.completedNights}
          metFiveOfSeven={week.metFiveOfSeven}
          totalNights={shields.totalNights}
          shieldsAvailable={shields.available}
          nextMilestone={milestones.nextMilestone}
          nightsToNextMilestone={milestones.nightsToNextMilestone}
        />

        {activeChild ? (
          <SkyTeaserCard
            childName={childName}
            totalNights={shields.totalNights}
            shieldsAvailable={shields.available}
            onOpen={() => router.push('/ceu')}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  noTasks: {
    paddingVertical: spacing.lg,
  },
});
