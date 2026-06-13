// Detalhe do filho: regime ativo (tipo, instruções da médica, horário sugerido),
// preferência de lembrete atual, atalho "Ajustar lembretes" e o toggle
// "Pausar lembretes (férias/doença)".
//
// Pausar é 100% LOCAL no MVP (usePausedDates/setChildPaused): ao alternar,
// chamamos setChildPaused() e DEPOIS syncSchedulesForFamily() com TODOS os
// filhos (remindersPaused atualizado). Pausar vira NUVENS no céu, sem quebrar a
// sequência (perdão, não fracasso).
//
// ANVISA RDC 657/2022: as instruções exibidas são o texto prescrito pela
// médica; o app não calcula, interpreta nem julga nada. Sem dado clínico aqui.
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildFamilySchedule,
  effectiveTime,
  fallbackTimeFor,
  formatReminderTime,
  formatTimePtBR,
  ORTHOK_OFF_TIME,
  regimeLabel,
} from '@/components/familia';
import { ChevronIcon, DropIcon, LensIcon, SunriseIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Card, EmptyState, Pill, Screen } from '@/components/ui';
import {
  getPausedState,
  queryKeys,
  useChildren,
  usePausedDates,
  useReminderPrefs,
  useTreatments,
  setChildPaused,
} from '@/hooks';
import { syncSchedulesForFamily } from '@/lib/notifications/scheduler';
import { colors, radii, spacing } from '@/theme/tokens';
import type { ReminderPref, Treatment } from '@/types/domain';

export default function ChildDetailScreen() {
  const { childId: childIdParam } = useLocalSearchParams<{ childId: string }>();
  const childId = childIdParam ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const childrenQuery = useChildren();
  const treatmentsQuery = useTreatments(childId);
  const prefsQuery = useReminderPrefs();
  const pausedQuery = usePausedDates(childId);

  const [togglingPause, setTogglingPause] = useState(false);

  const child = (childrenQuery.data ?? []).find((c) => c.id === childId);
  const treatments = treatmentsQuery.data ?? [];
  const prefs = prefsQuery.data ?? [];
  const paused = pausedQuery.data?.paused ?? false;

  const canGoBack = router.canGoBack();

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar para a lista de filhos"
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed ? styles.pressedDim : null]}
        >
          <ChevronIcon direction="left" color={colors.purple} size={20} />
        </Pressable>
      ) : null}
      <AppText variant="title" accessibilityRole="header">
        {child ? `Cuidado de ${child.first_name}` : 'Cuidado do filho'}
      </AppText>
      <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
        Regime orientado pela médica e os lembretes deste filho.
      </AppText>
    </View>
  );

  if (childrenQuery.isLoading || treatmentsQuery.isLoading) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  if (!child) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Filho não encontrado"
            message="Talvez o acompanhamento tenha sido encerrado. Volte e tente de novo."
            action={canGoBack ? { label: 'Voltar', onPress: () => router.back() } : undefined}
          />
        </View>
      </Screen>
    );
  }

  // Alterna a pausa de férias do filho e reconcilia TODOS os lembretes da
  // família (o scheduler precisa do estado de pausa de cada filho).
  const handleTogglePause = async (next: boolean): Promise<void> => {
    if (togglingPause) return;
    setTogglingPause(true);
    try {
      await setChildPaused(childId, next);

      const allChildren = childrenQuery.data ?? [];
      const allTreatments =
        queryClient.getQueryData<Treatment[]>(queryKeys.treatments(undefined)) ?? treatments;

      // Estado de pausa atual de cada filho (o do childId já reflete `next`).
      const pausedSet = new Set<string>();
      await Promise.all(
        allChildren.map(async (c) => {
          const state = await getPausedState(c.id);
          if (state.paused) pausedSet.add(c.id);
        })
      );

      const schedule = buildFamilySchedule(allChildren, allTreatments, prefs, pausedSet);
      await syncSchedulesForFamily(schedule);
    } catch {
      Alert.alert(
        'Não foi possível atualizar agora',
        'Sua escolha foi salva neste aparelho, mas os lembretes podem demorar a refletir. Tente de novo em instantes.'
      );
    } finally {
      setTogglingPause(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {header}

        <View style={styles.body}>
          {treatments.length === 0 ? (
            <Card>
              <AppText variant="cardTitle">Sem regime ativo</AppText>
              <AppText variant="body" color={colors.ink2} style={styles.cardBodyText}>
                No momento não há tratamento ativo para {child.first_name}. Quando a clínica
                registrar um novo regime, ele aparece aqui.
              </AppText>
            </Card>
          ) : (
            treatments.map((treatment) => (
              <View key={treatment.id} style={styles.cardWrap}>
                <RegimeCard
                  treatment={treatment}
                  reminderTime={describeReminder(treatment, prefs)}
                  paused={paused}
                />
              </View>
            ))
          )}

          {treatments.length > 0 ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/family/reminders/[childId]',
                  params: { childId },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Ajustar lembretes de ${child.first_name}`}
              style={({ pressed }) => [styles.cardWrap, pressed ? styles.pressed : null]}
            >
              <Card style={styles.linkCard}>
                <View style={styles.linkText}>
                  <AppText variant="cardTitle">Ajustar lembretes</AppText>
                  <AppText variant="meta" color={colors.ink2} style={styles.linkSub}>
                    Mude o horário em que cada lembrete chega no seu aparelho.
                  </AppText>
                </View>
                <ChevronIcon direction="right" color={colors.ink3} size={20} />
              </Card>
            </Pressable>
          ) : null}

          <Card style={styles.pauseCard}>
            <View style={styles.pauseRow}>
              <View style={styles.pauseText}>
                <AppText variant="cardTitle">Pausar lembretes</AppText>
                <AppText variant="meta" color={colors.ink2} style={styles.pauseSub}>
                  Para férias ou dias de doença. As noites pausadas viram nuvens no céu, sem
                  quebrar a sequência de {child.first_name}.
                </AppText>
              </View>
              <Switch
                value={paused}
                onValueChange={(next) => {
                  void handleTogglePause(next);
                }}
                disabled={togglingPause}
                trackColor={{ false: colors.line, true: colors.purple400 }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.line}
                accessibilityLabel="Pausar lembretes deste filho"
              />
            </View>
            {paused ? (
              <View style={styles.pauseBanner}>
                <AppText variant="meta" color={colors.purple800}>
                  Lembretes pausados. Reative quando a rotina voltar — a sequência continua de onde
                  parou.
                </AppText>
              </View>
            ) : null}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Texto do horário de lembrete efetivo (preferência > sugestão > fallback). */
function describeReminder(treatment: Treatment, prefs: ReminderPref[]): string {
  const time = effectiveTime(treatment, prefs, fallbackTimeFor(treatment.type));
  if (treatment.type === 'ortho_k') {
    return `Colocar ${formatReminderTime(time)} · retirar ${formatReminderTime(ORTHOK_OFF_TIME)}`;
  }
  return formatReminderTime(time);
}

interface RegimeCardProps {
  treatment: Treatment;
  reminderTime: string;
  paused: boolean;
}

function RegimeCard({ treatment, reminderTime, paused }: RegimeCardProps) {
  const suggested = formatTimePtBR(treatment.suggested_time);
  return (
    <Card>
      <View style={styles.regimeHead}>
        <View style={styles.regimeIcon}>
          {treatment.type === 'atropina' ? (
            <DropIcon size={22} color={colors.purple} />
          ) : treatment.type === 'ortho_k' ? (
            <LensIcon size={22} color={colors.purple} />
          ) : (
            <SunriseIcon size={22} color={colors.purple} />
          )}
        </View>
        <View style={styles.regimeTitleWrap}>
          <AppText variant="cardTitle">{regimeLabel(treatment.type)}</AppText>
          {suggested ? (
            <AppText variant="meta" color={colors.ink2} style={styles.regimeSuggested}>
              Horário sugerido pela médica: {suggested}
            </AppText>
          ) : null}
        </View>
      </View>

      {treatment.instructions && treatment.instructions.trim().length > 0 ? (
        <View style={styles.instructionsBox}>
          <AppText variant="meta" color={colors.ink3} style={styles.instructionsLabel}>
            Orientação da médica
          </AppText>
          <AppText variant="body" color={colors.ink}>
            {treatment.instructions.trim()}
          </AppText>
        </View>
      ) : null}

      <View style={styles.reminderRow}>
        <AppText variant="meta" color={colors.ink2}>
          Lembrete neste aparelho
        </AppText>
        {paused ? (
          <Pill label="Pausado" color={colors.ink2} backgroundColor={colors.line} />
        ) : (
          <Pill label={reminderTime} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenX,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pressedDim: {
    opacity: 0.6,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: spacing.xxl,
  },
  body: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  cardBodyText: {
    marginTop: spacing.xs,
  },
  regimeHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regimeIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  regimeTitleWrap: {
    flex: 1,
  },
  regimeSuggested: {
    marginTop: 2,
  },
  instructionsBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.cardSm,
    padding: spacing.md,
  },
  instructionsLabel: {
    marginBottom: spacing.xs,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    flex: 1,
    marginRight: spacing.md,
  },
  linkSub: {
    marginTop: 3,
  },
  pauseCard: {
    marginTop: spacing.xs,
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pauseText: {
    flex: 1,
    marginRight: spacing.md,
  },
  pauseSub: {
    marginTop: 3,
  },
  pauseBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.purple50,
    borderRadius: radii.cardSm,
    borderWidth: 1,
    borderColor: colors.purple100,
    padding: spacing.md,
  },
});
