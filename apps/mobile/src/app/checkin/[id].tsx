// MODAL DE CHECK-IN — aberto pelo TAP no corpo da notificação (o grupo (app) faz
// router.push(`/checkin/${id}`)). Formatos do id (parseNotifId):
// - "childId:tipo" (atropina/ortho-k, formato antigo): 'atropina' -> tratamento
//   atropina; 'orthok_on'/'orthok_off' -> tratamento ortho_k;
// - "childId:tipo:treatmentId:dose" (colírio e lente de contato): o tratamento
//   pelo id e a dose do dia que a resposta registra.
//
// Registra a dose via useCheckinMutation (outbox-first, optimistic) com
// log_date = localDateString() (corte 04h) e note opcional ao escolher
// "Não foi possível hoje". Casos especiais que NÃO gravam log: orthok_off (a noite
// já foi registrada ao COLOCAR a lente) e lente_on da lente de contato de 1 vez
// por dia (o registro do dia é na hora de tirar).
//
// REGRAS DURAS (ANVISA RDC 657/2022): nenhum dado clínico nesta tela; a
// celebração comemora ADESÃO (a estrela), nunca resultado — sem número clínico.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireSession } from '@/components/auth/RequireSession';
import { CheckinSheet, StarCelebration } from '@/components/checkin';
import { formatReminderTime, scheduledDoses } from '@/components/familia/familiaHelpers';
import { taskInstruction } from '@/components/hoje';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Button, EmptyState, Screen } from '@/components/ui';
import {
  useChildRoutines,
  useChildren,
  useCheckinMutation,
  useTodayAdherence,
  useTreatments,
} from '@/hooks';
import { localDateString } from '@/lib/date';
import { colirioName, doseLabel, dosesPerDay, routineFor } from '@/lib/doseSchedule';
import { parseNotifId } from '@/lib/notifications/scheduler';
import { useUiStore } from '@/stores/ui';
import { colors, spacing } from '@/theme/tokens';
import type { AdherenceStatus, ReminderType, Treatment } from '@/types/domain';

// Fecha sozinho ~1.2s depois da estrela acender (volta para a tela anterior).
const CELEBRATION_MS = 1200;

// Tipos de lembrete que vieram antes das doses (textos e comportamento preservados).
const LEGACY_TYPES: ReadonlySet<ReminderType> = new Set(['atropina', 'orthok_on', 'orthok_off']);

// O tratamento do banco que corresponde a cada tipo de lembrete.
function treatmentMatchesReminder(t: Treatment, type: ReminderType): boolean {
  if (type === 'atropina') return t.type === 'atropina';
  if (type === 'colirio') return t.type === 'colirio';
  if (type === 'lente_on' || type === 'lente_dose' || type === 'lente_off') {
    return t.type === 'lente_contato';
  }
  return t.type === 'ortho_k'; // orthok_on e orthok_off são o MESMO tratamento ortho_k
}

// Título amigável por tipo (com o nome do filho).
function sheetTitle(type: ReminderType, firstName: string, treatment: Treatment | null): string {
  switch (type) {
    case 'atropina':
      return `Hora da gotinha de ${firstName}`;
    case 'orthok_on':
      return `Hora de colocar a lente de ${firstName}`;
    case 'orthok_off':
      return `Bom dia! Hora de retirar a lente de ${firstName}`;
    case 'colirio':
      return `${colirioName(treatment?.name)} de ${firstName}`;
    case 'lente_on':
      return `Hora de colocar a lente de ${firstName}`;
    case 'lente_dose':
      return `Lente de contato de ${firstName}`;
    case 'lente_off':
      return `Tirou a lente de ${firstName}?`;
  }
}

export default function CheckinModalScreen() {
  return (
    <RequireSession>
      <CheckinModalScreenContent />
    </RequireSession>
  );
}

function CheckinModalScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const parsed = useMemo(() => (id ? parseNotifId(id) : null), [id]);
  const childId = parsed?.childId ?? '';
  const type = parsed?.type ?? null;
  const dose = parsed?.dose ?? 1;
  const reminderTreatmentId = parsed?.treatmentId ?? null;

  const childrenQuery = useChildren();
  const treatmentsQuery = useTreatments(childId || undefined);
  const routinesQuery = useChildRoutines();
  const today = localDateString();
  const todayQuery = useTodayAdherence(today);
  const checkin = useCheckinMutation();

  const [celebrating, setCelebrating] = useState(false);
  // A celebração com estrela é só para 'feito'; 'pulado' recebe só a mensagem.
  const [celebratedStatus, setCelebratedStatus] = useState<AdherenceStatus>('feito');
  // "Mudar resposta" a partir do estado "já registrada".
  const [correcting, setCorrecting] = useState(false);
  // Mensagem da celebração (definida no momento do registro).
  const [celebrationMsg, setCelebrationMsg] = useState('');
  // Evita disparar dois registros (toque duplo / re-render).
  const submittedRef = useRef(false);

  // Id inválido (notificação corrompida / deep link manual): volta para a home.
  useEffect(() => {
    if (id && !parsed) router.replace('/');
  }, [id, parsed, router]);

  const child = useMemo(
    () => (childrenQuery.data ?? []).find((c) => c.id === childId) ?? null,
    [childrenQuery.data, childId]
  );

  // Lembrete por dose: o tratamento pelo id. Se o regime foi trocado depois do
  // agendamento, só cai no do mesmo tipo quando não há dúvida (um só ativo).
  const treatment = useMemo(() => {
    if (!type) return null;
    const candidates = (treatmentsQuery.data ?? []).filter((t) => treatmentMatchesReminder(t, type));
    if (reminderTreatmentId) {
      const exact = candidates.find((t) => t.id === reminderTreatmentId);
      if (exact) return exact;
      return candidates.length === 1 ? candidates[0] : null;
    }
    return candidates[0] ?? null;
  }, [treatmentsQuery.data, type, reminderTreatmentId]);

  const total = treatment ? dosesPerDay(treatment) : 1;
  const doseValid = dose <= total;

  // Linha da dose ("2ª de 4 · 11h40") nos tratamentos de várias doses.
  const doseSubtitle = useMemo(() => {
    if (!treatment || total <= 1) return null;
    const routine = routineFor(routinesQuery.data ?? [], childId);
    const slot = scheduledDoses(treatment, [], routine).find((s) => s.dose === dose);
    const time = slot?.time ? formatReminderTime(slot.time) : null;
    return [doseLabel(dose, total), time].filter(Boolean).join(' · ');
  }, [treatment, total, routinesQuery.data, childId, dose]);

  // Log de hoje desta dose (qualquer status conta como "respondido"). Não vale
  // para orthok_off, que nunca grava log próprio.
  const todayLog = useMemo(() => {
    if (!treatment) return null;
    return (
      (todayQuery.data ?? []).find(
        (log) =>
          log.child_id === childId &&
          log.treatment_id === treatment.id &&
          log.log_date === today &&
          (log.dose ?? 1) === dose
      ) ?? null
    );
  }, [todayQuery.data, childId, treatment, today, dose]);
  const alreadyLoggedToday = todayLog !== null && !correcting;

  // Auto-fecha depois da celebração.
  useEffect(() => {
    if (!celebrating) return;
    const handle = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, CELEBRATION_MS);
    return () => clearTimeout(handle);
  }, [celebrating, router]);

  const close = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const register = (status: AdherenceStatus, note: string | null): void => {
    if (!treatment || submittedRef.current) return;
    submittedRef.current = true;
    const legacy = type !== null && LEGACY_TYPES.has(type);
    setCelebrationMsg(
      status === 'feito'
        ? legacy
          ? 'Noite de cuidado registrada!'
          : 'Cuidado registrado!'
        : 'Tudo bem. Amanhã é um novo dia.'
    );
    setCelebratedStatus(status);
    // Outbox-first + optimistic: a estrela pode acender já (não esperamos a rede).
    checkin.mutate({
      treatmentId: treatment.id,
      childId,
      dose,
      status,
      note,
      replace: todayLog !== null,
    });
    // Ao fechar, a Hoje abre no filho que acabou de ser registrado.
    useUiStore.getState().setActiveChildId(childId);
    setCelebrating(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const loading = childrenQuery.isLoading || treatmentsQuery.isLoading || todayQuery.isLoading;

  // Id inválido: o efeito acima já redireciona; render neutro enquanto navega.
  if (!parsed || !type) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  // Celebração ocupa a tela inteira (some sozinha em ~1.2s). Noite pulada não
  // acende estrela: só a mensagem acolhedora.
  if (celebrating) {
    return (
      <Screen>
        <View style={styles.centered}>
          {celebratedStatus === 'feito' ? (
            <StarCelebration message={celebrationMsg} />
          ) : (
            <EmptyState icon={<LumiOwl size={72} />} title={celebrationMsg} />
          )}
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  const firstName = child?.first_name ?? '';
  const title = sheetTitle(type, firstName, treatment);
  const legacy = LEGACY_TYPES.has(type);

  // Filho ou tratamento não encontrado (regime trocado/arquivado entre o
  // agendamento e o tap), ou dose que o tratamento não tem mais: estado
  // acolhedor, nunca de erro/fracasso.
  if (!child || !treatment || !doseValid) {
    return (
      <Screen>
        <View style={styles.body}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Este lembrete não está mais ativo"
            message="O cuidado pode ter mudado. Abra a aba Hoje para ver o que está programado."
            action={{ label: 'Ir para a Hoje', onPress: close }}
          />
        </View>
      </Screen>
    );
  }

  // orthok_off: a noite já foi registrada ao COLOCAR a lente (orthok_on grava o
  // log). Retirar de manhã é só rotina — NÃO gravamos nada aqui; bom dia e fecha.
  if (type === 'orthok_off') {
    return (
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
          >
            <AppText variant="title" accessibilityRole="header" style={styles.morningTitle}>
              {title}
            </AppText>
            <AppText variant="body" color={colors.ink2} style={styles.morningText}>
              Lente retirada. Bom dia! A noite de ontem já está registrada — não
              precisa marcar nada agora.
            </AppText>
            <Button label="Fechar" onPress={close} style={styles.morningBtn} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // lente_on da lente de contato de 1 vez por dia: colocar só lembra; o registro
  // do dia é na hora de tirar. Mostra a regra de uso da médica e fecha.
  if (type === 'lente_on' && total <= 1) {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        >
          <AppText variant="title" accessibilityRole="header" style={styles.morningTitle}>
            {title}
          </AppText>
          <AppText variant="body" color={colors.ink2} style={styles.morningText}>
            {taskInstruction(treatment)}
          </AppText>
          <AppText variant="body" color={colors.ink2} style={styles.morningText}>
            Não precisa marcar nada agora: o registro do dia é na hora de tirar a lente.
          </AppText>
          <Button label="Fechar" onPress={close} style={styles.morningBtn} />
        </ScrollView>
      </Screen>
    );
  }

  // Já registrado hoje: confirma acolhedoramente e oferece fechar (sem regravar).
  if (alreadyLoggedToday) {
    return (
      <Screen>
        <View style={styles.body}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title={
              legacy
                ? 'A noite de hoje já está registrada.'
                : total > 1
                  ? 'Esta dose de hoje já está registrada.'
                  : 'O cuidado de hoje já está registrado.'
            }
            message={
              todayLog?.status === 'pulado'
                ? 'Ficou registrado que hoje não foi possível. Se foi engano, dá para mudar a resposta.'
                : 'Não precisa fazer nada agora. Que tal ver as estrelas no céu?'
            }
            action={{ label: 'Fechar', onPress: close }}
          />
          <Button
            label="Mudar resposta"
            variant="ghost"
            onPress={() => setCorrecting(true)}
            style={styles.morningBtn}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <CheckinSheet
            type={type}
            title={title}
            subtitle={doseSubtitle}
            instruction={taskInstruction(treatment)}
            busy={checkin.isPending}
            onDone={() => register('feito', null)}
            onSkip={(note) => register('pulado', note)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
  },
  morningTitle: {
    marginBottom: spacing.md,
  },
  morningText: {
    marginBottom: spacing.xl,
  },
  morningBtn: {
    marginTop: spacing.sm,
  },
});
