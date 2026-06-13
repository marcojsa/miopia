// Conta e privacidade: dados do responsável, resumo dos direitos (LGPD), link
// "Falar com a clínica" (WhatsApp) e a EXCLUSÃO de conta in-app (exigência Apple
// + LGPD) com confirmação dupla (digitar EXCLUIR).
//
// A exclusão chama a Edge Function delete-account (executa a matriz
// APAGA/ANONIMIZA/RETÉM no servidor) e depois faz signOut. Explicitamos o que é
// apagado e o que PERMANECE: o prontuário/medições pertencem à clínica e são
// retidos por norma do CFM (não são apagados pela exclusão da conta).
//
// ANVISA/LGPD: nenhum dado clínico é exibido ou julgado; aqui é só conta e
// direitos do titular.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { ChevronIcon } from '@/components/icons';
import { AppText, Button, Card, Screen, SectionHeader } from '@/components/ui';
import { cancelAllSchedules } from '@/lib/notifications/scheduler';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { colors, radii, spacing } from '@/theme/tokens';

// WhatsApp da clínica (Alto de Pinheiros).
const CLINIC_WHATSAPP = 'https://wa.me/5511977235838';
const CONFIRM_WORD = 'EXCLUIR';

const LGPD_RIGHTS = [
  'Saber quais dados guardamos e por quê.',
  'Pedir uma cópia dos seus dados e dos da criança.',
  'Corrigir uma informação errada.',
  'Retirar o consentimento e excluir sua conta deste app.',
];

interface Status {
  kind: 'error' | 'info';
  text: string;
}

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const email = session?.user.email ?? 'Sem e-mail';

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const canGoBack = router.canGoBack();
  const confirmMatches = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const openWhatsApp = async (): Promise<void> => {
    try {
      const can = await Linking.canOpenURL(CLINIC_WHATSAPP);
      if (can) {
        await Linking.openURL(CLINIC_WHATSAPP);
      } else {
        Alert.alert(
          'Não foi possível abrir o WhatsApp',
          'Instale o WhatsApp ou fale com a recepção da clínica.'
        );
      }
    } catch {
      Alert.alert('Não foi possível abrir o WhatsApp', 'Tente novamente em instantes.');
    }
  };

  // 2ª confirmação (após digitar EXCLUIR): alerta nativo bloqueante.
  const confirmDeletion = (): void => {
    if (deleting || !confirmMatches) return;
    Alert.alert(
      'Excluir sua conta?',
      'Esta ação não pode ser desfeita. Sua conta de acesso e os registros de cuidado deste app serão apagados. As medições das consultas permanecem no prontuário da clínica (exigência do CFM).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: () => {
            void runDeletion();
          },
        },
      ]
    );
  };

  const runDeletion = async (): Promise<void> => {
    setDeleting(true);
    setStatus(null);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      // Limpa os lembretes locais antes de encerrar a sessão.
      await cancelAllSchedules();
      await supabase.auth.signOut();
      // O guard do (app)/_layout redireciona ao detectar a sessão nula.
    } catch {
      setStatus({
        kind: 'error',
        text: 'Não foi possível concluir a exclusão agora. Verifique sua internet e tente de novo, ou fale com a clínica.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              Conta e privacidade
            </AppText>
            <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
              Seus dados, seus direitos e o controle da sua conta.
            </AppText>
          </View>

          <View style={styles.body}>
            <Card>
              <AppText variant="meta" color={colors.ink3}>
                Responsável
              </AppText>
              <AppText variant="body" color={colors.ink} numberOfLines={1} style={styles.email}>
                {email}
              </AppText>
              <AppText variant="meta" color={colors.ink2} style={styles.emailNote}>
                O acesso é criado pela clínica, por convite. Para trocar de e-mail, fale com a
                recepção.
              </AppText>
            </Card>

            <SectionHeader title="Seus direitos (LGPD)" style={styles.sectionHeader} />
            <Card>
              <AppText variant="body" color={colors.ink2} style={styles.rightsIntro}>
                A Lei Geral de Proteção de Dados garante a você:
              </AppText>
              {LGPD_RIGHTS.map((right) => (
                <View key={right} style={styles.rightRow}>
                  <View style={styles.rightDot} />
                  <AppText variant="body" color={colors.ink} style={styles.rightText}>
                    {right}
                  </AppText>
                </View>
              ))}
            </Card>

            <Pressable
              onPress={() => {
                void openWhatsApp();
              }}
              accessibilityRole="button"
              accessibilityLabel="Falar com a clínica no WhatsApp"
              style={({ pressed }) => [styles.linkWrap, pressed ? styles.pressed : null]}
            >
              <Card style={styles.linkCard}>
                <View style={styles.linkText}>
                  <AppText variant="cardTitle">Falar com a clínica</AppText>
                  <AppText variant="meta" color={colors.ink2} style={styles.linkSub}>
                    Tire dúvidas sobre seus dados ou peça uma cópia pelo WhatsApp.
                  </AppText>
                </View>
                <ChevronIcon direction="right" color={colors.ink3} size={20} />
              </Card>
            </Pressable>

            <SectionHeader title="Excluir minha conta" style={styles.sectionHeader} />
            <Card style={styles.dangerCard}>
              <AppText variant="body" color={colors.ink} style={styles.dangerIntro}>
                Ao excluir, apagamos sua conta de acesso e os registros de cuidado feitos por você
                neste app.
              </AppText>
              <AppText variant="meta" color={colors.ink2} style={styles.dangerKeep}>
                O que permanece: as medições e a evolução das consultas pertencem ao prontuário da
                clínica e são mantidas por exigência do Conselho Federal de Medicina (CFM). A
                exclusão da conta não apaga o prontuário.
              </AppText>

              {status ? (
                <View style={styles.banner} accessibilityLiveRegion="polite">
                  <AppText variant="meta" color={colors.ink}>
                    {status.text}
                  </AppText>
                </View>
              ) : null}

              <AuthTextField
                label={`Para confirmar, digite ${CONFIRM_WORD}`}
                value={confirmText}
                onChangeText={(text) => {
                  setConfirmText(text);
                  if (status) setStatus(null);
                }}
                placeholder={CONFIRM_WORD}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleting}
                containerStyle={styles.confirmField}
                accessibilityLabel={`Digite ${CONFIRM_WORD} para confirmar a exclusão`}
              />

              <Pressable
                onPress={confirmDeletion}
                disabled={!confirmMatches || deleting}
                accessibilityRole="button"
                accessibilityLabel="Excluir minha conta"
                accessibilityState={{ disabled: !confirmMatches || deleting }}
                style={({ pressed }) => [
                  styles.deleteButton,
                  !confirmMatches || deleting ? styles.deleteButtonDisabled : null,
                  pressed && confirmMatches && !deleting ? styles.pressed : null,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <AppText variant="cardTitle" color={colors.white} style={styles.deleteLabel}>
                    Excluir minha conta
                  </AppText>
                )}
              </Pressable>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xxl,
  },
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
  pressed: {
    opacity: 0.7,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  body: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  email: {
    marginTop: 3,
  },
  emailNote: {
    marginTop: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  rightsIntro: {
    marginBottom: spacing.sm,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  rightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.purple400,
    marginTop: 7,
    marginRight: spacing.md,
  },
  rightText: {
    flex: 1,
  },
  linkWrap: {
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
  dangerCard: {
    borderWidth: 1.5,
    borderColor: colors.coral,
  },
  dangerIntro: {
    marginBottom: spacing.sm,
  },
  dangerKeep: {
    marginBottom: spacing.md,
  },
  banner: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: radii.cardSm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  confirmField: {
    marginBottom: spacing.md,
  },
  deleteButton: {
    backgroundColor: colors.coral,
    borderRadius: radii.button,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteLabel: {
    fontSize: 15,
  },
});
