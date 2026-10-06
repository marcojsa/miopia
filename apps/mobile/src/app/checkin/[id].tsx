// MODAL DE CHECK-IN — aberto pelo TAP no corpo da notificação (responses.ts faz
// router.push(`/checkin/${childId}:${type}`)). A rota recebe id "childId:tipo"
// (parseNotifId). Resolve o filho (useChildren) e o tratamento (useTreatments):
// 'atropina' -> tratamento atropina; 'orthok_on'/'orthok_off' -> tratamento ortho_k.
//
// Registra a noite via useCheckinMutation (outbox-first, optimistic) com
// log_date = localDateString() (corte 04h) e note opcional ao escolher
// "Não foi possível hoje". Caso especial orthok_off: NÃO grava log — a noite já
// foi registrada ao COLOCAR a lente (orthok_on); aqui só damos bom dia e fechamos.
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
import { taskInstruction } from '@/components/hoje';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Button, EmptyState, Screen } from '@/components/ui';
import { useChildren, useCheckinMutation, useTodayAdherence, useTreatments } from '@/hooks';
import { localDateString } from '@/lib/date';
import { parseNotifId } from '@/lib/notifications/scheduler';
import { useUiStore } from '@/stores/ui';
import { colors, spacing } from '@/theme/tokens';
import type { AdherenceStatus, ReminderType, Treatment } from '@/types/domain';

// Fecha sozinho ~1.2s depois da estrela acender (volta para a tela anterior).
const CELEBRATION_MS = 1200;

// O tratamento do banco que corresponde a cada tipo de lembrete.
function treatmentMatchesReminder(t: Treatment, type: ReminderType): boolean {
  if (type === 'atropina') return t.type === 'atropina';
  return t.type === 'ortho_k'; // orthok_on e orthok_off são o MESMO tratamento ortho_k
}

// Título amigável por tipo (com o nome do filho).
function sheetTitle(type: ReminderType, firstName: string): string {
  switch (type) {
    case 'atropina':
      return `Hora da gotinha de ${firstName}`;
    case 'orthok_on':
      return `Hora de colocar a lente de ${firstName}`;
    case 'orthok_off':
      return `Bom dia! Hora de retirar a lente de ${firstName}`;
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

  const childrenQuery = useChildren();
  const treatmentsQuery = useTreatments(childId || undefined);
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

  const treatment = useMemo(
    () =>
      type
        ? (treatmentsQuery.data ?? []).find((t) => treatmentMatchesReminder(t, type)) ?? null
        : null,
    [treatmentsQuery.data, type]
  );

  // Log de hoje deste tratamento (qualquer status conta como "respondido"). Não
  // vale para orthok_off, que nunca grava log próprio.
  const todayLog = useMemo(() => {
    if (!treatment) return null;
    return (
      (todayQuery.data ?? []).find(
        (log) =>
          log.child_id === childId && log.treatment_id === treatment.id && log.log_date === today
      ) ?? null
    );
  }, [todayQuery.data, childId, treatment, today]);
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
    setCelebrationMsg(
      status === 'feito' ? 'Noite de cuidado registrada!' : 'Tudo bem. Amanhã é um novo dia.'
    );
    setCelebratedStatus(status);
    // Outbox-first + optimistic: a estrela pode acender já (não esperamos a rede).
    checkin.mutate({ treatmentId: treatment.id, childId, status, note, replace: todayLog !== null });
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
  const title = sheetTitle(type, firstName);

  // Filho ou tratamento não encontrado (regime trocado/arquivado entre o
  // agendamento e o tap): estado acolhedor, nunca de erro/fracasso.
  if (!child || !treatment) {
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

  // Já registrado hoje: confirma acolhedoramente e oferece fechar (sem regravar).
  if (alreadyLoggedToday) {
    return (
      <Screen>
        <View style={styles.body}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="A noite de hoje já está registrada."
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
