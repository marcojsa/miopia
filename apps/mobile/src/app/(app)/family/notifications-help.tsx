// "Ajuda com notificações" — guia honesto de Android: confirmar notificações
// ativadas, o canal "Lembretes do tratamento", desligar a otimização de bateria
// (caminho genérico + nota de que varia por fabricante) e um botão de teste.
//
// Honestidade técnica: no Expo Go a entrega de notificações difere do app final
// (sandbox compartilhado), então avisamos explicitamente. Sem libs nativas extras
// (compatível com Expo Go): usamos só expo-notifications, já instalado.
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon } from '@/components/icons';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

interface Step {
  n: number;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Permita as notificações do Lumi',
    body: 'Nas configurações do aparelho, abra Apps, encontre o Lumi e confirme que as notificações estão ligadas. Sem essa permissão, nenhum lembrete chega.',
  },
  {
    n: 2,
    title: 'Deixe o canal "Lembretes do tratamento" ativo',
    body: 'Ainda nas notificações do Lumi, mantenha o canal "Lembretes do tratamento" ligado, com som e prioridade altos. É por ele que os lembretes da noite aparecem.',
  },
  {
    n: 3,
    title: 'Desligue a economia de bateria para o Lumi',
    body: 'Em Apps > Lumi > Bateria, escolha "Sem restrições" (ou "Não otimizar"). A economia de bateria é a causa mais comum de lembretes atrasados ou silenciosos.',
  },
];

export default function NotificationsHelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'denied' | 'error'>(
    'idle'
  );

  const canGoBack = router.canGoBack();

  const handleTestNotification = async (): Promise<void> => {
    if (testStatus === 'sending') return;
    setTestStatus('sending');
    try {
      const settings = await Notifications.getPermissionsAsync();
      let granted = settings.granted;
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.granted;
      }
      if (!granted) {
        setTestStatus('denied');
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Notificação de teste do Lumi',
          body: 'Se você está vendo isto, os lembretes deste aparelho estão funcionando.',
        },
        trigger: null, // dispara agora
      });
      setTestStatus('sent');
    } catch {
      setTestStatus('error');
    }
  };

  const testLabel =
    testStatus === 'sending' ? 'Enviando...' : 'Enviar notificação de teste';

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
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
            Ajuda com notificações
          </AppText>
          <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
            Lembretes atrasando ou silenciosos? Esses passos resolvem na maioria dos aparelhos.
          </AppText>
        </View>

        <View style={styles.body}>
          {STEPS.map((step) => (
            <View key={step.n} style={styles.cardWrap}>
              <Card style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <AppText variant="cardTitle" color={colors.purple}>
                    {step.n}
                  </AppText>
                </View>
                <View style={styles.stepText}>
                  <AppText variant="cardTitle" style={styles.stepTitle}>
                    {step.title}
                  </AppText>
                  <AppText variant="body" color={colors.ink2} style={styles.stepBody}>
                    {step.body}
                  </AppText>
                </View>
              </Card>
            </View>
          ))}

          <Card style={styles.noteCard}>
            <AppText variant="meta" color={colors.ink3} style={styles.noteLabel}>
              O caminho muda conforme o fabricante
            </AppText>
            <AppText variant="body" color={colors.ink2}>
              Em Samsung, costuma estar em "Cuidados do dispositivo" {'>'} Bateria. Em Xiaomi/Redmi
              (MIUI), procure "Economia de bateria" e ative "Sem restrições" e "Início automático"
              para o Lumi. Os nomes variam, mas a ideia é a mesma: impedir o sistema de pausar o
              app.
            </AppText>
          </Card>

          <View style={styles.testWrap}>
            <Button
              label={testLabel}
              onPress={() => {
                void handleTestNotification();
              }}
              loading={testStatus === 'sending'}
            />
            {testStatus === 'sent' ? (
              <AppText
                variant="meta"
                color={colors.purple800}
                style={styles.testFeedback}
                accessibilityLiveRegion="polite"
              >
                Teste enviado. A notificação deve aparecer em instantes.
              </AppText>
            ) : testStatus === 'denied' ? (
              <AppText
                variant="meta"
                color={colors.ink}
                style={styles.testFeedback}
                accessibilityLiveRegion="polite"
              >
                As notificações estão bloqueadas. Ative-as nas configurações do aparelho (passo 1) e
                tente de novo.
              </AppText>
            ) : testStatus === 'error' ? (
              <AppText
                variant="meta"
                color={colors.ink}
                style={styles.testFeedback}
                accessibilityLiveRegion="polite"
              >
                Não foi possível enviar o teste agora. Tente novamente em instantes.
              </AppText>
            ) : null}
          </View>

          <Card style={styles.expoNote}>
            <AppText variant="meta" color={colors.ink2}>
              Importante: enquanto o app roda em modo de teste (Expo Go), a entrega das notificações
              pode diferir da versão final publicada. No app instalado pela loja, os lembretes são
              mais confiáveis.
              {Platform.OS === 'ios'
                ? ' No iPhone, basta manter as notificações do Lumi ativadas.'
                : ''}
            </AppText>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  subtitle: {
    marginTop: spacing.xs,
  },
  body: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
  },
  stepBody: {
    marginTop: spacing.xs,
  },
  noteCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  noteLabel: {
    marginBottom: spacing.xs,
  },
  testWrap: {
    marginBottom: spacing.lg,
  },
  testFeedback: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  expoNote: {
    backgroundColor: colors.purple50,
  },
});
