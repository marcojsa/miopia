// Editor de horário de lembrete por tratamento. Mostra o horário sugerido pela
// médica e o pessoal; oferece pills de horários comuns (19h30–22h30, de 30 em
// 30) e ajuste fino por steppers de 5 min (NADA de DateTimePicker nativo —
// compatível com Expo Go). Salvar = upsert em reminder_prefs (preferência do
// RESPONSÁVEL, separada da prescrição) + syncSchedulesForFamily() + feedback.
//
// Ortho-k: editamos só o horário de COLOCAR à noite; a retirada é fixa de manhã
// (07h) no MVP — mostrada como informação, não editável.
//
// Rotina da criança (acorda/dorme, child_routines): mesmo seletor de horário, com
// "Salvar rotina" próprio. Dela saem os horários do colírio de várias doses,
// mostrados aqui como informação.
//
// Lente de contato (1 vez por dia): o responsável escolhe a hora de colocar
// (reminder_prefs.reminder_time) e a de tirar (remove_time). A Dra. passa a regra
// e pode limitar as horas de uso: a tela mostra a regra e avisa quando a escolha
// passa do limite. "Usar a rotina" apaga a preferência (volta ao padrão).
//
// Troca de regime pela clínica: a tela rebusca os tratamentos ao abrir e ao ganhar
// foco, e todo salvamento rebusca antes de gravar e grava no tratamento ATIVO
// correspondente (mesmo tipo; no colírio, mesmo nome). Se ele não existe mais, avisa
// e não grava. O banco também redireciona (20261009000001).
//
// ANVISA/LGPD: aqui só há preferência de horário de notificação. Nenhum dado
// clínico é exibido, calculado ou julgado.
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildFamilySchedule,
  effectiveTime,
  fallbackTimeFor,
  formatReminderTime,
  formatTimePtBR,
  isDailyLens,
  lensTimesFor,
  ORTHOK_OFF_TIME,
  parseHM,
  reminderTimeLabel,
  toReminderTimeString,
  treatmentLabel,
} from '@/components/familia';
import { ChevronIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Button, Card, EmptyState, Pill, Screen } from '@/components/ui';
import {
  getPausedState,
  queryKeys,
  ROUTINE_ERROR,
  useChildRoutine,
  useChildRoutines,
  useChildren,
  useReminderPrefs,
  useTreatments,
} from '@/hooks';
import {
  dosesPerDay,
  fromMinutes,
  LENS_ORDER_WARNING,
  lensTimes,
  outsideRoutine,
  routineError,
  sameColirio,
  usesRoutine,
  type Routine,
} from '@/lib/doseSchedule';
import { requestNotificationPermission } from '@/lib/notifications/permission';
import { syncSchedulesForFamily } from '@/lib/notifications/scheduler';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { colors, radii, spacing } from '@/theme/tokens';
import type { ReminderPref, ReminderTime, Treatment } from '@/types/domain';

// Horários comuns no MVP: 19h30 a 22h30, de 30 em 30 minutos.
const COMMON_TIMES: ReminderTime[] = [
  { hour: 19, minute: 30 },
  { hour: 20, minute: 0 },
  { hour: 20, minute: 30 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
  { hour: 22, minute: 30 },
];

// Rotina: horários comuns de acordar e de dormir.
const WAKE_TIMES: ReminderTime[] = [
  { hour: 6, minute: 0 },
  { hour: 6, minute: 30 },
  { hour: 7, minute: 0 },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 8, minute: 30 },
];
const BED_TIMES: ReminderTime[] = [
  { hour: 20, minute: 0 },
  { hour: 20, minute: 30 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
  { hour: 22, minute: 30 },
];

// Lente de contato: horários comuns de tirar (os de colocar são os de acordar).
const LENS_OFF_TIMES: ReminderTime[] = [
  { hour: 15, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
];

const STEP_MINUTES = 5;
const MIN_TOTAL = 0; // 00h00
const MAX_TOTAL = 23 * 60 + 55; // 23h55

function toTotal(t: ReminderTime): number {
  return t.hour * 60 + t.minute;
}

function fromTotal(total: number): ReminderTime {
  const clamped = Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, total));
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

/** Cópia do mapa sem a chave `key`. */
function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...map };
  delete copy[key];
  return copy;
}

/** A clínica encerrou o tratamento e não há ativo correspondente: não grava. */
const TREATMENT_CHANGED =
  'A clínica alterou este tratamento. Atualizamos a tela; confira os horários e salve de novo.';

class TreatmentChangedError extends Error {}

function sameTime(a: ReminderTime, b: ReminderTime): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

interface Status {
  kind: 'error' | 'info';
  text: string;
}

export default function RemindersScreen() {
  const { childId: childIdParam } = useLocalSearchParams<{ childId: string }>();
  const childId = childIdParam ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const childrenQuery = useChildren();
  const treatmentsQuery = useTreatments(childId, { alwaysFresh: true });
  // Voltar para esta tela (foco) também rebusca: a clínica pode ter trocado o regime.
  const refetchTreatments = treatmentsQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchTreatments();
    }, [refetchTreatments])
  );
  const prefsQuery = useReminderPrefs();
  const routinesQuery = useChildRoutines();
  const { routine, save: saveRoutine } = useChildRoutine(childId);

  const child = (childrenQuery.data ?? []).find((c) => c.id === childId);
  const prefs = useMemo(() => prefsQuery.data ?? [], [prefsQuery.data]);

  // Editor de horário só para os lembretes de 1 vez por dia (atropina, ortho-k,
  // colírio 1x); óculos/lentes não têm notificação no MVP.
  const treatments = useMemo(
    () =>
      (treatmentsQuery.data ?? []).filter(
        (t) =>
          (t.type === 'atropina' || t.type === 'ortho_k' || t.type === 'colirio') &&
          !usesRoutine(t)
      ),
    [treatmentsQuery.data]
  );
  // Colírio de várias doses (e lente com mais de 1 vez por dia): horários saem da rotina.
  const routineTreatments = useMemo(
    () => (treatmentsQuery.data ?? []).filter((t) => usesRoutine(t) && !isDailyLens(t)),
    [treatmentsQuery.data]
  );
  // Lente de contato de 1 vez por dia: hora de colocar e de tirar escolhidas aqui.
  const lensTreatments = useMemo(
    () => (treatmentsQuery.data ?? []).filter((t) => isDailyLens(t)),
    [treatmentsQuery.data]
  );

  // Rotina em edição (inicia na salva, ou 07:00–21:00).
  const [wakeEdit, setWakeEdit] = useState<ReminderTime | null>(null);
  const [bedEdit, setBedEdit] = useState<ReminderTime | null>(null);
  const [routineStatus, setRoutineStatus] = useState<Status | null>(null);
  const wake = wakeEdit ?? parseHM(routine.wake) ?? { hour: 7, minute: 0 };
  const bed = bedEdit ?? parseHM(routine.bed) ?? { hour: 21, minute: 0 };
  const wakeHM = fromMinutes(toTotal(wake));
  const bedHM = fromMinutes(toTotal(bed));
  const routineInvalid = routineError(wakeHM, bedHM);
  const editingRoutine = { wake: wakeHM, bed: bedHM };

  const handleSaveRoutine = (): void => {
    if (routineInvalid) {
      setRoutineStatus({ kind: 'error', text: routineInvalid });
      return;
    }
    setRoutineStatus(null);
    saveRoutine.mutate(
      { wake: wakeHM, bed: bedHM },
      {
        onSuccess: () => {
          setWakeEdit(null);
          setBedEdit(null);
          setRoutineStatus({
            kind: 'info',
            text: 'Rotina salva. Os lembretes do colírio e da lente já seguem os horários novos.',
          });
        },
        onError: (e) => {
          setRoutineStatus({
            kind: 'error',
            text:
              e.name === ROUTINE_ERROR
                ? e.message
                : 'Não foi possível salvar a rotina agora. Verifique sua internet e tente de novo.',
          });
        },
      }
    );
  };

  // Horário editado por tratamento (inicia no horário efetivo atual).
  const initialTimes = useMemo(() => {
    const map: Record<string, ReminderTime> = {};
    for (const t of treatments) {
      map[t.id] = effectiveTime(t, prefs, fallbackTimeFor(t.type));
    }
    return map;
  }, [treatments, prefs]);

  const [times, setTimes] = useState<Record<string, ReminderTime>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  // Lente: horários em edição (o que não foi mexido segue a preferência salva ou a rotina).
  const [lensEdits, setLensEdits] = useState<Record<string, { on?: ReminderTime; off?: ReminderTime }>>({});
  const [lensStatus, setLensStatus] = useState<Record<string, Status>>({});
  const [lensSaving, setLensSaving] = useState<string | null>(null);

  const editLens = (treatmentId: string, patch: { on?: ReminderTime; off?: ReminderTime }): void => {
    setLensStatus((prev) => without(prev, treatmentId));
    setLensEdits((prev) => ({ ...prev, [treatmentId]: { ...prev[treatmentId], ...patch } }));
  };

  // Horário atual de um tratamento: editado (se houver) ou o inicial calculado.
  const timeFor = (treatmentId: string): ReminderTime =>
    times[treatmentId] ?? initialTimes[treatmentId] ?? { hour: 20, minute: 30 };

  const setTimeFor = (treatmentId: string, t: ReminderTime): void => {
    setStatus(null);
    setTimes((prev) => ({ ...prev, [treatmentId]: t }));
  };

  const adjustBy = (treatmentId: string, deltaMinutes: number): void => {
    setTimeFor(treatmentId, fromTotal(toTotal(timeFor(treatmentId)) + deltaMinutes));
  };

  const canGoBack = router.canGoBack();

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed ? styles.pressedDim : null]}
        >
          <ChevronIcon direction="left" color={colors.purple} size={20} />
        </Pressable>
      ) : null}
      <AppText variant="title" accessibilityRole="header">
        Horários dos lembretes
      </AppText>
      <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
        {child
          ? `Quando os lembretes de ${child.first_name} chegam neste aparelho.`
          : 'Quando os lembretes chegam neste aparelho.'}
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

  if (treatments.length === 0 && routineTreatments.length === 0 && lensTreatments.length === 0) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Nenhum lembrete para ajustar"
            message="Quando houver um regime ativo, o horário de cada lembrete aparece aqui."
            action={canGoBack ? { label: 'Voltar', onPress: () => router.back() } : undefined}
          />
        </View>
      </Screen>
    );
  }

  /**
   * Rebusca os tratamentos deste filho e devolve, para cada um da tela, o ATIVO
   * correspondente (o mesmo id; ou, depois de uma troca de regime, o do mesmo tipo
   * e, no colírio, do mesmo nome). Sem correspondente, lança TreatmentChangedError.
   */
  const resolveActive = async (
    shown: Treatment[]
  ): Promise<{ fresh: Treatment[]; byShownId: Map<string, Treatment> }> => {
    const result = await refetchTreatments();
    if (result.error || !result.data) throw result.error ?? new Error('tratamentos indisponíveis');
    const fresh = result.data.filter((t) => t.active);
    const byShownId = new Map<string, Treatment>();
    for (const t of shown) {
      const current =
        fresh.find((a) => a.id === t.id) ??
        fresh.find((a) => a.type === t.type && (t.type !== 'colirio' || sameColirio(a.name, t.name)));
      if (!current) throw new TreatmentChangedError(TREATMENT_CHANGED);
      byShownId.set(t.id, current);
    }
    return { fresh, byShownId };
  };

  // Reagenda com as preferências novas. Reconstrói o estado de pausa de cada
  // filho para não reativar lembretes de quem está de férias. `freshChild`: os
  // tratamentos deste filho recém-buscados (o cache da família pode estar velho).
  const reschedule = async (nextPrefs: ReminderPref[], freshChild: Treatment[]): Promise<void> => {
    const allChildren = childrenQuery.data ?? [];
    const allTreatments = [
      ...(queryClient.getQueryData<Treatment[]>(queryKeys.treatments(undefined)) ?? []).filter(
        (t) => t.child_id !== childId
      ),
      ...freshChild,
    ];
    void queryClient.invalidateQueries({ queryKey: queryKeys.treatments(undefined) });
    const pausedSet = new Set<string>();
    await Promise.all(
      allChildren.map(async (c) => {
        const state = await getPausedState(c.id);
        if (state.paused) pausedSet.add(c.id);
      })
    );
    const schedule = buildFamilySchedule(
      allChildren,
      allTreatments,
      nextPrefs,
      pausedSet,
      routinesQuery.data ?? []
    );
    await syncSchedulesForFamily(schedule);
  };

  // Rotina usada nos avisos e nos padrões: a que está na tela, se válida.
  const shownRoutine = routineInvalid ? routine : editingRoutine;

  /** Horários da lente na tela: edição > preferência salva > rotina (com o limite da Dra.). */
  const lensView = (t: Treatment) => {
    const saved = lensTimesFor(t, prefs, shownRoutine);
    const hasPref = prefs.some((p) => p.treatment_id === t.id && p.enabled);
    const edit = lensEdits[t.id];
    const current = lensTimes({
      wake: shownRoutine.wake,
      bed: shownRoutine.bed,
      maxHours: t.max_wear_hours ?? null,
      prefOn: edit?.on ? fromMinutes(toTotal(edit.on)) : hasPref ? saved.on : null,
      prefOff: edit?.off ? fromMinutes(toTotal(edit.off)) : hasPref ? saved.off : null,
    });
    return {
      on: parseHM(current.on) ?? { hour: 7, minute: 0 },
      off: parseHM(current.off) ?? { hour: 21, minute: 0 },
      warning: current.warning,
      hasPref,
    };
  };

  const handleSaveLens = async (t: Treatment): Promise<void> => {
    if (lensSaving) return;
    const userId = session?.user.id;
    const setOwnStatus = (s: Status): void => setLensStatus((prev) => ({ ...prev, [t.id]: s }));
    if (!userId) {
      setOwnStatus({ kind: 'error', text: 'Sua sessão expirou. Entre de novo para salvar.' });
      return;
    }
    const view = lensView(t);
    if (view.warning === LENS_ORDER_WARNING) {
      setOwnStatus({ kind: 'error', text: LENS_ORDER_WARNING });
      return;
    }
    setLensSaving(t.id);
    try {
      const { fresh, byShownId } = await resolveActive([t]);
      const active = byShownId.get(t.id) as Treatment;
      const row: ReminderPref = {
        guardian_user_id: userId,
        treatment_id: active.id,
        reminder_time: toReminderTimeString(view.on),
        remove_time: toReminderTimeString(view.off),
        enabled: true,
      };
      const { error } = await supabase
        .from('reminder_prefs')
        .upsert(row, { onConflict: 'guardian_user_id,treatment_id' });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs });
      setLensEdits((prev) => without(prev, t.id));
      await reschedule([...prefs.filter((p) => p.treatment_id !== active.id), row], fresh);
      setLensStatus((prev) => ({
        ...without(prev, t.id),
        [active.id]: {
          kind: 'info',
          text: `Horários da lente salvos: colocar ${formatReminderTime(view.on)}, tirar ${formatReminderTime(view.off)}.`,
        },
      }));
    } catch (e) {
      setOwnStatus({
        kind: 'error',
        text:
          e instanceof TreatmentChangedError
            ? e.message
            : 'Não foi possível salvar agora. Verifique sua internet e tente de novo.',
      });
    } finally {
      setLensSaving(null);
    }
  };

  // "Usar a rotina": apaga a preferência da lente (volta ao padrão).
  const handleResetLens = async (t: Treatment): Promise<void> => {
    if (lensSaving) return;
    const userId = session?.user.id;
    const setOwnStatus = (s: Status): void => setLensStatus((prev) => ({ ...prev, [t.id]: s }));
    if (!userId) {
      setOwnStatus({ kind: 'error', text: 'Sua sessão expirou. Entre de novo para salvar.' });
      return;
    }
    setLensSaving(t.id);
    try {
      const { fresh, byShownId } = await resolveActive([t]);
      const active = byShownId.get(t.id) as Treatment;
      const { error } = await supabase
        .from('reminder_prefs')
        .delete()
        .eq('guardian_user_id', userId)
        .eq('treatment_id', active.id);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs });
      setLensEdits((prev) => without(prev, t.id));
      await reschedule(prefs.filter((p) => p.treatment_id !== active.id), fresh);
      setLensStatus((prev) => ({
        ...without(prev, t.id),
        [active.id]: { kind: 'info', text: 'Pronto. A lente voltou a seguir a rotina.' },
      }));
    } catch (e) {
      if (e instanceof TreatmentChangedError) {
        setOwnStatus({ kind: 'error', text: e.message });
        return;
      }
      setOwnStatus({
        kind: 'error',
        text: 'Não foi possível voltar à rotina agora. Verifique sua internet e tente de novo.',
      });
    } finally {
      setLensSaving(null);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    if (!session?.user.id) {
      setStatus({ kind: 'error', text: 'Sua sessão expirou. Entre de novo para salvar.' });
      return;
    }
    setStatus(null);
    setSaving(true);
    try {
      const { fresh, byShownId } = await resolveActive(treatments);
      // Um por tratamento ativo (dois da tela nunca caem no mesmo, mas a PK não perdoa).
      const rows = [
        ...new Map(
          treatments.map((t) => {
            const activeId = (byShownId.get(t.id) as Treatment).id;
            return [
              activeId,
              {
                guardian_user_id: session.user.id,
                treatment_id: activeId,
                reminder_time: toReminderTimeString(timeFor(t.id)),
                enabled: true,
              },
            ] as const;
          })
        ).values(),
      ];

      const { error } = await supabase
        .from('reminder_prefs')
        .upsert(rows, { onConflict: 'guardian_user_id,treatment_id' });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs });

      // Reagenda com os horários novos.
      const updatedPrefs: ReminderPref[] = rows.map((r) => ({
        guardian_user_id: r.guardian_user_id,
        treatment_id: r.treatment_id,
        reminder_time: r.reminder_time,
        remove_time: null,
        enabled: r.enabled,
      }));
      // Mescla as preferências novas sobre as antigas (outros filhos intactos).
      const mergedPrefs = [
        ...prefs.filter((p) => !updatedPrefs.some((u) => u.treatment_id === p.treatment_id)),
        ...updatedPrefs,
      ];
      await reschedule(mergedPrefs, fresh);

      // Android 13+: sem a permissão o lembrete agendado não aparece.
      const permission = await requestNotificationPermission();
      setStatus(
        permission.status === 'denied' || permission.status === 'undetermined'
          ? {
              kind: 'error',
              text: 'Horários salvos, mas as notificações estão desligadas neste aparelho. Veja "Ajuda com notificações" na aba Família.',
            }
          : { kind: 'info', text: 'Horários salvos. Os lembretes já valem a partir de hoje.' }
      );
    } catch (e) {
      setStatus({
        kind: 'error',
        text:
          e instanceof TreatmentChangedError
            ? e.message
            : 'Não foi possível salvar agora. Verifique sua internet e tente de novo.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        <View style={styles.body}>
          <View style={styles.cardWrap}>
            <Card>
              <AppText variant="cardTitle">
                {child ? `Rotina de ${child.first_name}` : 'Rotina da criança'}
              </AppText>
              <AppText variant="meta" color={colors.ink2} style={styles.editorSub}>
                Dela saem os horários do colírio de várias doses, sempre entre o acordar e o
                dormir, e o padrão da lente de contato.
              </AppText>
              <AppText variant="meta" color={colors.ink3} style={styles.commonLabel}>
                Acorda às
              </AppText>
              <TimePicker
                value={wake}
                commonTimes={WAKE_TIMES}
                onSelect={(t) => {
                  setRoutineStatus(null);
                  setWakeEdit(t);
                }}
                onStep={(delta) => {
                  setRoutineStatus(null);
                  setWakeEdit(fromTotal(toTotal(wake) + delta));
                }}
              />
              <AppText variant="meta" color={colors.ink3} style={styles.commonLabel}>
                Dorme às
              </AppText>
              <TimePicker
                value={bed}
                commonTimes={BED_TIMES}
                onSelect={(t) => {
                  setRoutineStatus(null);
                  setBedEdit(t);
                }}
                onStep={(delta) => {
                  setRoutineStatus(null);
                  setBedEdit(fromTotal(toTotal(bed) + delta));
                }}
              />
              {routineInvalid || routineStatus ? (
                <View
                  style={[
                    styles.banner,
                    styles.routineBanner,
                    !routineInvalid && routineStatus?.kind === 'info'
                      ? styles.bannerInfo
                      : styles.bannerError,
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  <AppText
                    variant="meta"
                    color={
                      !routineInvalid && routineStatus?.kind === 'info' ? colors.purple800 : colors.ink
                    }
                  >
                    {routineInvalid ?? routineStatus?.text}
                  </AppText>
                </View>
              ) : null}
              <Button
                label={saveRoutine.isPending ? 'Salvando...' : 'Salvar rotina'}
                onPress={handleSaveRoutine}
                loading={saveRoutine.isPending}
                disabled={routineInvalid !== null}
                style={styles.save}
              />
            </Card>
          </View>

          {lensTreatments.map((t) => {
            const view = lensView(t);
            const own = lensStatus[t.id];
            const busy = lensSaving === t.id;
            const rule = t.instructions?.trim();
            return (
              <View key={t.id} style={styles.cardWrap}>
                <Card>
                  <AppText variant="cardTitle">{treatmentLabel(t)}</AppText>
                  <AppText variant="meta" color={colors.ink2} style={styles.editorSub}>
                    {rule ? `Regra da Dra.: ${rule}` : 'Você escolhe a hora de colocar e a de tirar.'}
                  </AppText>
                  {t.max_wear_hours ? (
                    <AppText variant="meta" color={colors.ink2} style={styles.editorSub}>
                      Limite da Dra.: no máximo {t.max_wear_hours} h de uso por dia.
                    </AppText>
                  ) : null}
                  <AppText variant="meta" color={colors.ink3} style={styles.commonLabel}>
                    Colocar às
                  </AppText>
                  <TimePicker
                    value={view.on}
                    commonTimes={WAKE_TIMES}
                    onSelect={(time) => editLens(t.id, { on: time })}
                    onStep={(delta) => editLens(t.id, { on: fromTotal(toTotal(view.on) + delta) })}
                  />
                  <AppText variant="meta" color={colors.ink3} style={styles.commonLabel}>
                    Tirar às
                  </AppText>
                  <TimePicker
                    value={view.off}
                    commonTimes={LENS_OFF_TIMES}
                    onSelect={(time) => editLens(t.id, { off: time })}
                    onStep={(delta) => editLens(t.id, { off: fromTotal(toTotal(view.off) + delta) })}
                  />
                  {view.warning ? (
                    <View
                      style={[styles.banner, styles.routineBanner, styles.bannerError]}
                      accessibilityLiveRegion="polite"
                    >
                      <AppText variant="meta" color={colors.ink}>
                        {view.warning}
                      </AppText>
                    </View>
                  ) : null}
                  {own ? (
                    <View
                      style={[
                        styles.banner,
                        styles.routineBanner,
                        own.kind === 'info' ? styles.bannerInfo : styles.bannerError,
                      ]}
                      accessibilityLiveRegion="polite"
                    >
                      <AppText variant="meta" color={own.kind === 'info' ? colors.purple800 : colors.ink}>
                        {own.text}
                      </AppText>
                    </View>
                  ) : null}
                  <Button
                    label={busy ? 'Salvando...' : 'Salvar horários da lente'}
                    onPress={() => {
                      void handleSaveLens(t);
                    }}
                    loading={busy}
                    disabled={view.warning === LENS_ORDER_WARNING}
                    style={styles.lensSave}
                  />
                  {view.hasPref || lensEdits[t.id] ? (
                    <Button
                      label="Usar a rotina"
                      variant="ghost"
                      onPress={() => {
                        void handleResetLens(t);
                      }}
                      disabled={busy}
                      style={styles.save}
                    />
                  ) : null}
                </Card>
              </View>
            );
          })}

          {routineTreatments.map((t) => (
            <View key={t.id} style={styles.cardWrap}>
              <Card>
                <AppText variant="cardTitle">{treatmentLabel(t)}</AppText>
                <AppText variant="meta" color={colors.ink2} style={styles.editorSub}>
                  {`${dosesPerDay(t)} vezes por dia, espalhadas entre o acordar e o dormir.`}
                </AppText>
                <View style={styles.orthokOff}>
                  <AppText variant="meta" color={colors.ink2}>
                    Lembretes: {reminderTimeLabel(t, prefs, editingRoutine)}
                  </AppText>
                </View>
              </Card>
            </View>
          ))}

          {status ? (
            <View
              style={[
                styles.banner,
                status.kind === 'info' ? styles.bannerInfo : styles.bannerError,
              ]}
              accessibilityLiveRegion="polite"
            >
              <AppText
                variant="meta"
                color={status.kind === 'info' ? colors.purple800 : colors.ink}
              >
                {status.text}
              </AppText>
            </View>
          ) : null}

          {treatments.map((treatment) => (
            <View key={treatment.id} style={styles.cardWrap}>
              <TreatmentTimeEditor
                treatment={treatment}
                value={timeFor(treatment.id)}
                routine={shownRoutine}
                onSelect={(t) => setTimeFor(treatment.id, t)}
                onStep={(delta) => adjustBy(treatment.id, delta)}
              />
            </View>
          ))}

          {treatments.length > 0 ? (
            <Button
              label={saving ? 'Salvando...' : 'Salvar horários'}
              onPress={() => {
                void handleSave();
              }}
              loading={saving}
              style={styles.save}
            />
          ) : null}
          <AppText variant="small" style={styles.footNote}>
            Os lembretes deste app são deste aparelho. Em alguns Androids a economia de bateria pode
            atrasá-los — veja "Ajuda com notificações".
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

interface TreatmentTimeEditorProps {
  treatment: Treatment;
  value: ReminderTime;
  /** Rotina da criança, para avisar quando o lembrete cai no sono. */
  routine: Routine;
  onSelect: (t: ReminderTime) => void;
  onStep: (deltaMinutes: number) => void;
}

function TreatmentTimeEditor({ treatment, value, routine, onSelect, onStep }: TreatmentTimeEditorProps) {
  const suggested = formatTimePtBR(treatment.suggested_time);
  const isOrthok = treatment.type === 'ortho_k';
  const outside = outsideRoutine(fromMinutes(toTotal(value)), routine);
  return (
    <Card>
      <AppText variant="cardTitle">{treatmentLabel(treatment)}</AppText>
      <AppText variant="meta" color={colors.ink2} style={styles.editorSub}>
        {isOrthok
          ? 'Lembrete de COLOCAR a lente à noite.'
          : treatment.type === 'colirio'
            ? 'Lembrete do colírio.'
            : 'Lembrete da noite.'}
        {suggested ? ` Sugerido pela médica: ${suggested}.` : ''}
      </AppText>

      <TimePicker value={value} commonTimes={COMMON_TIMES} onSelect={onSelect} onStep={onStep} />

      {outside ? (
        <View style={[styles.banner, styles.routineBanner, styles.bannerError]} accessibilityLiveRegion="polite">
          <AppText variant="meta" color={colors.ink}>
            {outside === 'depois'
              ? `Este lembrete toca às ${formatReminderTime(value)}, depois da hora de dormir (${formatTimePtBR(routine.bed)}). Ajuste o horário se precisar.`
              : `Este lembrete toca às ${formatReminderTime(value)}, antes da hora de acordar (${formatTimePtBR(routine.wake)}). Ajuste o horário se precisar.`}
          </AppText>
        </View>
      ) : null}

      {isOrthok ? (
        <View style={styles.orthokOff}>
          <AppText variant="meta" color={colors.ink2}>
            Retirar a lente: lembrete fixo às {formatReminderTime(ORTHOK_OFF_TIME)} da manhã.
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

interface TimePickerProps {
  value: ReminderTime;
  commonTimes: ReminderTime[];
  onSelect: (t: ReminderTime) => void;
  onStep: (deltaMinutes: number) => void;
}

/** Seletor de horário: steppers de 5 min + pills de horários comuns. */
function TimePicker({ value, commonTimes, onSelect, onStep }: TimePickerProps) {
  return (
    <>
      <View style={styles.timeDisplayRow}>
        <Pressable
          onPress={() => onStep(-STEP_MINUTES)}
          accessibilityRole="button"
          accessibilityLabel="Diminuir 5 minutos"
          hitSlop={8}
          style={({ pressed }) => [styles.stepper, pressed ? styles.pressedDim : null]}
        >
          <AppText variant="title" color={colors.purple}>
            −
          </AppText>
        </Pressable>
        <View style={styles.timeValueBox}>
          <AppText variant="display" color={colors.purple900} style={styles.timeValue}>
            {formatReminderTime(value)}
          </AppText>
        </View>
        <Pressable
          onPress={() => onStep(STEP_MINUTES)}
          accessibilityRole="button"
          accessibilityLabel="Aumentar 5 minutos"
          hitSlop={8}
          style={({ pressed }) => [styles.stepper, pressed ? styles.pressedDim : null]}
        >
          <AppText variant="title" color={colors.purple}>
            +
          </AppText>
        </Pressable>
      </View>

      <AppText variant="meta" color={colors.ink3} style={styles.commonLabel}>
        Horários comuns
      </AppText>
      <View style={styles.pillsRow}>
        {commonTimes.map((t) => {
          const selected = sameTime(t, value);
          return (
            <Pressable
              key={`${t.hour}:${t.minute}`}
              onPress={() => onSelect(t)}
              accessibilityRole="button"
              accessibilityLabel={`Definir ${formatReminderTime(t)}`}
              style={({ pressed }) => (pressed ? styles.pressedDim : null)}
            >
              <Pill
                label={formatReminderTime(t)}
                color={selected ? colors.white : colors.purple}
                backgroundColor={selected ? colors.purple : colors.purple50}
              />
            </Pressable>
          );
        })}
      </View>
    </>
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
  banner: {
    borderRadius: radii.cardSm,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  routineBanner: {
    marginTop: spacing.md,
    marginBottom: 0,
  },
  bannerInfo: {
    backgroundColor: colors.purple50,
    borderColor: colors.purple200,
  },
  bannerError: {
    backgroundColor: colors.white,
    borderColor: colors.coral,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  editorSub: {
    marginTop: 3,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stepper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValueBox: {
    minWidth: 120,
    alignItems: 'center',
  },
  timeValue: {
    fontVariant: ['tabular-nums'],
  },
  commonLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  orthokOff: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.cardSm,
    padding: spacing.md,
  },
  save: {
    marginTop: spacing.sm,
  },
  lensSave: {
    marginTop: spacing.md,
  },
  footNote: {
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
