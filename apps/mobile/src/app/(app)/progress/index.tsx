// ABA PROGRESSO (índice): a evolução é por filho.
// 1 filho -> redireciona direto para o dashboard dele; vários -> seletor com
// cards (avatar + nome + regime). NENHUM dado clínico aqui — só nome e regime.
// ANVISA RDC 657/2022: a interpretação clínica vive só no dashboard, no texto
// da médica; esta tela não exibe nem julga medida nenhuma.
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChildSelectorCard, regimeLabel } from '@/components/progresso';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { useChildren, useTreatments } from '@/hooks';
import { useUiStore } from '@/stores/ui';
import { colors, spacing } from '@/theme/tokens';

export default function ProgressIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setActiveChildId = useUiStore((s) => s.setActiveChildId);

  const childrenQuery = useChildren();
  const treatmentsQuery = useTreatments();

  const children = childrenQuery.data ?? [];

  if (childrenQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  if (childrenQuery.isError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Não foi possível carregar agora"
            message="Verifique sua internet e puxe para atualizar. Os dados também abrem offline assim que carregarem uma vez."
          />
        </View>
      </Screen>
    );
  }

  if (children.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title="Nenhum filho cadastrado ainda"
            message="Assim que a clínica cadastrar o acompanhamento, a evolução das consultas aparece aqui."
          />
        </View>
      </Screen>
    );
  }

  // 1 filho: vai direto para o dashboard (sem passo de seleção). O dashboard lê
  // o childId da rota, então não dependemos de activeChildId aqui.
  if (children.length === 1) {
    const only = children[0];
    return <Redirect href={{ pathname: '/(app)/progress/[childId]', params: { childId: only.id } }} />;
  }

  const treatments = treatmentsQuery.data ?? [];

  const handleSelect = (childId: string): void => {
    setActiveChildId(childId);
    router.push({ pathname: '/(app)/progress/[childId]', params: { childId } });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          Evolução
        </AppText>
        <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
          Escolha um filho para ver o acompanhamento das consultas.
        </AppText>

        {children.map((child) => {
          const treatment = treatments.find((t) => t.child_id === child.id);
          return (
            <View key={child.id} style={styles.cardWrap}>
              <ChildSelectorCard
                child={child}
                regimeLabel={treatment ? regimeLabel(treatment.type) : undefined}
                onPress={() => handleSelect(child.id)}
              />
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
});
