// ABA HOJE (home) — VERSÃO A aprovada (docs/mockups/hoje.html).
// Responde em < 5s "o que falta fazer esta noite?": header com saudação + data,
// chips de filhos, cards de check-in de 1 toque (Feito / Não foi possível) do
// filho ativo, meta semanal perdoadora (5 de 7) e a porta de entrada para o Céu.
//
// REGRAS DURAS: nenhum dado clínico nesta tela — adesão é RELATO da família, não
// medida (ANVISA RDC 657/2022). Verde só no botão Feito; amarelo-estrela só em
// estrelas/escudos/marcos. Gamificação celebra ADESÃO, nunca resultado clínico.
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reminderTimeLabel } from '@/components/familia/familiaHelpers';
import {
  GreetingHeader,
  NightDoneCard,
  SkyTeaserCard,
  TaskCard,
  WeekGoalCard,
  dueCareCount,
  greetingForHour,
  isScheduledTonight,
  longDatePtBR,
  taskInstruction,
  taskTitle,
  type ChildChip,
} from '@/components/hoje';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Card, EmptyState, Screen, SectionHeader } from '@/components/ui';
import {
  ALL_HISTORY,
  markTodayPausedIfNeeded,
  queryKeys,
  useAdherenceLogs,
  useChildren,
  useCheckinMutation,
  useNotificationPermission,
  usePausedChildIds,
  usePausedDates,
  useReminderPrefs,
  useTodayAdherence,
  useTreatmentHistory,
  useTreatments,
} from '@/hooks';
import { requestNotificationPermission } from '@/lib/notifications/permission';
import { flushOutbox } from '@/lib/outbox';
import { formatLocalYMD, localDateString, parseLocalYMD } from '@/lib/date';
import {
  computeShields,
  computeStreakAndMilestones,
  computeWeek,
} from '@/lib/gamification';
import { useSession } from '@/providers/auth';
import { useUiStore } from '@/stores/ui';
import { colors, spacing } from '@/theme/tokens';
import type { AdherenceLog, AdherenceStatus, ReminderPref, Treatment } from '@/types/domain';

// Nome de exibição do responsável (metadata da sessão) com fallback acolhedor.
function displayNameOf(metadata: Record<string, unknown> | undefined): string {
  const name = metadata?.display_name ?? metadata?.full_name ?? metadata?.name;
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim().split(/\s+/)[0];
  }
  return 'família';
}

// Subtítulo do chip do filho: tipo de cada tratamento + horário do lembrete deste
// aparelho (ex.: "lente 21h15 · colírio 20h30") — o mesmo horário em que a notificação toca.
function chipSubtitle(
  treatments: Treatment[],
  prefs: ReminderPref[],
  paused: boolean
): string | null {
  if (treatments.length === 0) return null;
  if (paused) return 'em pausa';
  return treatments
    .map((t) => {
      const time = reminderTimeLabel(t, prefs);
      const word = t.type === 'ortho_k' ? 'lente' : t.type === 'atropina' ? 'colírio' : 'cuidado';
      return time ? `${word} ${time}` : word;
    })
    .join(' · ');
}

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const activeChildId = useUiStore((s) => s.activeChildId);
  const setActiveChildId = useUiStore((s) => s.setActiveChildId);

  // A aba fica montada entre noites: ao voltar ao app, re-renderiza para recalcular
  // a data lógica (e com ela a key da query de hoje), a saudação e o dia da semana.
  // Também ao voltar para a aba (focus), que não re-renderiza sozinho.
  const [, setForegroundTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      setForegroundTick((n) => n + 1);
    }, [])
  );

  const now = new Date();
  // Data lógica da noite (corte 04h): às 00h30 de sábado a noite ainda é a de sexta.
  const today = localDateString(now);
  const calendarToday = formatLocalYMD(now);

  const childrenQuery = useChildren();
  const allTreatmentsQuery = useTreatments(); // todos da família (para os subtítulos dos chips)
  const todayQuery = useTodayAdherence(today);
  const prefsQuery = useReminderPrefs();
  const notifications = useNotificationPermission();

  const childTreatmentsQuery = useTreatments(activeChildId ?? undefined);
  // Ativos e encerrados: histórico da gamificação e troca de regime de madrugada.
  const historyQuery = useTreatmentHistory(activeChildId ?? '');
  const pausedQuery = usePausedDates(activeChildId ?? '');

  const checkin = useCheckinMutation();
  // Tratamento cujo check-in está sincronizando (bloqueia só aquele card).
  const [busyTreatmentId, setBusyTreatmentId] = useState<string | null>(null);
  // "Mudar resposta": reabre os cards da noite deste filho (chave filho:data).
  const [correcting, setCorrecting] = useState<string | null>(null);

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

  const activeChild = useMemo(
    () => children.find((c) => c.id === activeChildId) ?? null,
    [children, activeChildId]
  );

  // Chips: cada filho + subtítulo do 1º tratamento (da query da família inteira).
  const prefs = useMemo(() => prefsQuery.data ?? [], [prefsQuery.data]);
  const pausedIds = usePausedChildIds(children.map((c) => c.id));
  const chips: ChildChip[] = useMemo(() => {
    const all = allTreatmentsQuery.data ?? [];
    return children.map((child) => ({
      child,
      subtitle: chipSubtitle(
        all.filter((t) => t.child_id === child.id),
        prefs,
        pausedIds.has(child.id)
      ),
    }));
  }, [children, allTreatmentsQuery.data, prefs, pausedIds]);

  // Tratamentos do filho ativo agendados para a noite em curso.
  const scheduledTreatments = useMemo(
    () =>
      (childTreatmentsQuery.data ?? []).filter((t) =>
        isScheduledTonight(t, historyQuery.data ?? [], today, calendarToday)
      ),
    [childTreatmentsQuery.data, historyQuery.data, today, calendarToday]
  );

  // Logs de HOJE do filho ativo (qualquer status conta como "respondido").
  const todayLogs = useMemo(() => {
    const byTreatment = new Map<string, AdherenceLog>();
    for (const log of todayQuery.data ?? []) {
      if (log.child_id === activeChildId && log.log_date === today) {
        byTreatment.set(log.treatment_id, log);
      }
    }
    return byTreatment;
  }, [todayQuery.data, activeChildId, today]);

  // Troca de regime pela clínica: o banco passa o check-in de hoje para o
  // tratamento novo, que o cache de tratamentos (staleTime longo) ainda não tem.
  // Sem rebuscar, a Hoje pediria de novo a noite já registrada.
  const unknownTreatmentIds = useMemo(() => {
    const known = allTreatmentsQuery.data;
    if (!known) return '';
    const ids = new Set(known.map((t) => t.id));
    return [...new Set((todayQuery.data ?? []).map((l) => l.treatment_id))]
      .filter((id) => !ids.has(id))
      .sort()
      .join(',');
  }, [allTreatmentsQuery.data, todayQuery.data]);
  const refetchedFor = useRef('');
  useEffect(() => {
    if (!unknownTreatmentIds || refetchedFor.current === unknownTreatmentIds) return;
    refetchedFor.current = unknownTreatmentIds;
    void queryClient.invalidateQueries({ queryKey: ['treatments'] });
  }, [unknownTreatmentIds, queryClient]);

  const isCorrecting = correcting === `${activeChildId ?? ''}:${today}`;

  const pendingTreatments = useMemo(
    () =>
      isCorrecting
        ? scheduledTreatments
        : scheduledTreatments.filter((t) => !todayLogs.has(t.id)),
    [scheduledTreatments, todayLogs, isCorrecting]
  );

  const allAnswered = scheduledTreatments.length > 0 && pendingTreatments.length === 0;
  // A estrela só acende se TODOS os cuidados da noite foram feitos.
  const allFeito = allAnswered && scheduledTreatments.every((t) => todayLogs.get(t.id)?.status === 'feito');
  const paused = pausedQuery.data?.paused === true;
  // Noite já feita antes de ligar a pausa continua estrela: mostra o "Noite registrada".
  const showPause = paused && !allFeito && !isCorrecting;

  // Gamificação (adesão do filho ativo). starts_on = o mais antigo dos tratamentos
  // da criança, ativos ou encerrados, para a simulação cobrir todo o período de
  // cuidado (bate com o céu).
  const startsOn = useMemo(() => {
    const list = historyQuery.data ?? [];
    if (list.length === 0) return undefined;
    return list.reduce((min, t) => (t.starts_on < min ? t.starts_on : min), list[0].starts_on);
  }, [historyQuery.data]);

  // Histórico inteiro (a troca de regime não pode apagar as noites anteriores);
  // espera os tratamentos, que dizem quais noites eram devidas.
  const adherenceQuery = useAdherenceLogs(
    activeChildId ?? '',
    historyQuery.data === undefined ? null : ALL_HISTORY
  );

  // Noite devida = algum tratamento, ativo ou encerrado, programado nela.
  const isDue = useMemo(() => {
    const list = historyQuery.data ?? [];
    return (date: string) => dueCareCount(list, date) > 0;
  }, [historyQuery.data]);
  // Cuidados programados na noite: a estrela só acende com um 'feito' para cada.
  const dueCount = useMemo(() => {
    const list = historyQuery.data ?? [];
    return (date: string) => dueCareCount(list, date);
  }, [historyQuery.data]);

  const logs = adherenceQuery.data ?? [];
  const pausedDates = pausedQuery.data?.pausedDates ?? [];

  const week = useMemo(
    () => computeWeek(logs, pausedDates, today, startsOn, isDue, dueCount),
    [logs, pausedDates, today, startsOn, isDue, dueCount]
  );
  const shields = useMemo(
    () => computeShields(logs, pausedDates, today, startsOn, isDue, dueCount),
    [logs, pausedDates, today, startsOn, isDue, dueCount]
  );
  const milestones = useMemo(
    () => computeStreakAndMilestones(logs, pausedDates, today, startsOn, isDue, dueCount),
    [logs, pausedDates, today, startsOn, isDue, dueCount]
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await flushOutbox();
      await queryClient.invalidateQueries({ queryKey: ['adherence'] });
      await Promise.all([
        childrenQuery.refetch(),
        allTreatmentsQuery.refetch(),
        childTreatmentsQuery.refetch(),
        historyQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckin = (
    treatment: Treatment,
    status: AdherenceStatus,
    note: string | null = null
  ): void => {
    if (!activeChildId) return;
    const replace = todayLogs.has(treatment.id);
    setBusyTreatmentId(treatment.id);
    setCorrecting(null);
    checkin.mutate(
      { treatmentId: treatment.id, childId: activeChildId, status, note, replace },
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
      longDate={longDatePtBR(parseLocalYMD(today))}
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
  const notificationsOff =
    notifications.permission?.status === 'denied' ||
    (notifications.permission?.status === 'undetermined' && notifications.primerSeen);

  const handleEnableNotifications = async (): Promise<void> => {
    const result = await requestNotificationPermission();
    await notifications.refresh();
    if (result.status !== 'granted') router.push('/family/notifications-help');
  };

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
        {notificationsOff ? (
          <Pressable
            onPress={() => {
              void handleEnableNotifications();
            }}
            accessibilityRole="button"
            accessibilityLabel="Os lembretes estão desligados neste aparelho. Toque para ativar."
          >
            <Card style={styles.notificationsOff}>
              <AppText variant="cardTitle">Os lembretes estão desligados</AppText>
              <AppText variant="body" color={colors.ink2}>
                Sem permissão de notificação, o aparelho não avisa na hora do cuidado. Toque para
                ativar.
              </AppText>
            </Card>
          </Pressable>
        ) : null}

        <SectionHeader title="Esta noite" />

        {showPause && scheduledTreatments.length > 0 ? (
          <EmptyState
            icon={<LumiOwl size={72} />}
            title={`${childName} está em pausa (férias)`}
            message="Os lembretes estão pausados e a noite de hoje vira nuvem no céu. Não precisa marcar nada."
            action={{
              label: 'Retomar os cuidados',
              onPress: () => {
                if (activeChildId) {
                  router.push({
                    pathname: '/(app)/family/child/[childId]',
                    params: { childId: activeChildId },
                  });
                }
              },
            }}
            style={styles.noTasks}
          />
        ) : null}

        {(showPause ? [] : pendingTreatments).map((t) => (
          <TaskCard
            key={t.id}
            type={t.type}
            title={taskTitle(t.type, childName)}
            instruction={taskInstruction(t)}
            time={reminderTimeLabel(t, prefs)}
            busy={busyTreatmentId === t.id}
            onDone={() => handleCheckin(t, 'feito')}
            onSkip={(note) => handleCheckin(t, 'pulado', note)}
          />
        ))}

        {!showPause && allAnswered ? (
          <NightDoneCard
            childName={childName}
            variant={allFeito ? 'feito' : 'pulado'}
            onChangeAnswer={() => setCorrecting(`${activeChildId ?? ''}:${today}`)}
          />
        ) : null}

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
  notificationsOff: {
    gap: spacing.xs,
  },
});
