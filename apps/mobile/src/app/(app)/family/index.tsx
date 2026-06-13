// ABA FAMÍLIA (índice): cartão por filho (avatar, nome, idade, regime resumido)
// -> detalhe; e a seção "Sua conta" (e-mail logado, ajuda com notificações,
// conta e privacidade, sair).
//
// LGPD: a criança aparece só por inicial/ilustração e nome — sem foto, sem CPF.
// ANVISA: aqui não há dado clínico (idade é cadastral; o regime é só rótulo);
// nenhum valor ou juízo clínico é exibido.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon, PeopleIcon } from '@/components/icons';
import { SettingsRow, ageLabel, regimeSummary } from '@/components/familia';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Card, ChildAvatar, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { useChildren, useTreatments } from '@/hooks';
import { cancelAllSchedules } from '@/lib/notifications/scheduler';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { colors, spacing } from '@/theme/tokens';

export default function FamilyIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const childrenQuery = useChildren();
  const treatmentsQuery = useTreatments();
  const [signingOut, setSigningOut] = useState(false);

  const children = childrenQuery.data ?? [];
  const treatments = treatmentsQuery.data ?? [];
  const email = session?.user.email ?? 'Sem e-mail';

  const handleSignOut = (): void => {
    if (signingOut) return;
    Alert.alert(
      'Sair do app?',
      'Você precisará entrar de novo com seu e-mail. Os lembretes deste aparelho serão desligados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            void doSignOut();
          },
        },
      ]
    );
  };

  const doSignOut = async (): Promise<void> => {
    setSigningOut(true);
    try {
      // Lembretes são locais a este aparelho: ao sair, limpamos para não
      // tocar na conta de outra pessoa que entrar depois.
      await cancelAllSchedules();
      await supabase.auth.signOut();
      // O guard do (app)/_layout redireciona ao detectar a sessão nula.
    } catch {
      Alert.alert('Não foi possível sair agora', 'Tente novamente em instantes.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          Família
        </AppText>
        <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
          O cuidado de cada filho e as configurações da sua conta.
        </AppText>

        <SectionHeader title="Seus filhos" style={styles.sectionHeader} />

        {childrenQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.purple} />
          </View>
        ) : childrenQuery.isError ? (
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Não foi possível carregar agora"
            message="Verifique sua internet e tente de novo. Os dados também abrem offline assim que carregarem uma vez."
          />
        ) : children.length === 0 ? (
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Nenhum filho cadastrado ainda"
            message="Assim que a clínica cadastrar o acompanhamento, cada filho aparece aqui com o regime e os lembretes."
          />
        ) : (
          children.map((child) => {
            const treatment = treatments.find((t) => t.child_id === child.id);
            const age = ageLabel(child.birth_date);
            return (
              <Pressable
                key={child.id}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/family/child/[childId]',
                    params: { childId: child.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Abrir o cuidado de ${child.first_name}`}
                style={({ pressed }) => [styles.childWrap, pressed ? styles.pressed : null]}
              >
                <Card style={styles.childCard}>
                  <ChildAvatar
                    firstName={child.first_name}
                    seed={child.avatar_key ?? child.id}
                    size={46}
                  />
                  <View style={styles.childText}>
                    <AppText variant="cardTitle">
                      {age ? `${child.first_name}, ${age}` : child.first_name}
                    </AppText>
                    <AppText variant="meta" color={colors.ink2} style={styles.childRegime}>
                      {regimeSummary(treatment)}
                    </AppText>
                  </View>
                  <ChevronIcon direction="right" color={colors.ink3} size={20} />
                </Card>
              </Pressable>
            );
          })
        )}

        <SectionHeader title="Sua conta" style={styles.sectionHeaderTop} />
        <Card style={styles.accountCard}>
          <View style={styles.accountHead}>
            <View style={styles.accountIcon}>
              <PeopleIcon size={20} color={colors.purple} />
            </View>
            <View style={styles.accountText}>
              <AppText variant="meta" color={colors.ink3}>
                E-mail da conta
              </AppText>
              <AppText variant="body" color={colors.ink} numberOfLines={1}>
                {email}
              </AppText>
            </View>
          </View>

          <View style={styles.divider} />

          <SettingsRow
            title="Ajuda com notificações"
            description="Lembretes atrasando ou silenciosos? Veja como ajustar no seu aparelho."
            onPress={() => router.push('/(app)/family/notifications-help')}
          />
          <View style={styles.divider} />
          <SettingsRow
            title="Conta e privacidade"
            description="Seus dados, seus direitos (LGPD) e exclusão da conta."
            onPress={() => router.push('/(app)/family/account')}
          />
          <View style={styles.divider} />
          <SettingsRow
            title={signingOut ? 'Saindo...' : 'Sair'}
            variant="danger"
            hideChevron
            onPress={handleSignOut}
            accessibilityLabel="Sair do app"
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionHeaderTop: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  childWrap: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  childRegime: {
    marginTop: 3,
  },
  accountCard: {
    paddingVertical: spacing.sm,
  },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  accountText: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
});
