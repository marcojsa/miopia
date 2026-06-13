// DASHBOARD DE EVOLUÇÃO POR FILHO.
// Header claro com o nome do filho; card educativo fixo no topo ("O que é
// comprimento axial?"); lista de consultas (mais recente primeiro) com valores
// absolutos por olho em TINTA NEUTRA + a "Avaliação da Dra. Christiane"; rodapé
// fixo devolvendo a interpretação à médica.
//
// ANVISA RDC 657/2022 + decisão jurídica 12/06/2026: o app SÓ EXIBE. ZERO
// variação/delta, ZERO seta de tendência, ZERO média/percentil, ZERO gráfico de
// evolução, ZERO cor semafórica. Nenhuma comparação entre consultas em lugar
// nenhum. A única leitura clínica é o texto da médica (sempre roxo neutro fixo).
// Abre OFFLINE via cache TanStack persistido.
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AxialLengthCard, ClinicalDisclaimer, MeasurementCard } from '@/components/progresso';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { useChildren, useMeasurements, queryKeys } from '@/hooks';
import { colors, spacing } from '@/theme/tokens';

export default function ChildProgressScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const childrenQuery = useChildren();
  const measurementsQuery = useMeasurements(childId ?? '');

  const child = (childrenQuery.data ?? []).find((c) => c.id === childId);
  const measurements = measurementsQuery.data ?? [];

  const onRefresh = useCallback(async (): Promise<void> => {
    if (!childId) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.measurements(childId) });
    } finally {
      setRefreshing(false);
    }
  }, [childId, queryClient]);

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
        {child ? `Evolução de ${child.first_name}` : 'Evolução'}
      </AppText>
      <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
        O acompanhamento das consultas, em ordem do tempo.
      </AppText>
    </View>
  );

  if (measurementsQuery.isLoading) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void onRefresh();
            }}
            tintColor={colors.purple}
          />
        }
      >
        {header}

        <View style={styles.body}>
          <View style={styles.cardWrap}>
            <AxialLengthCard />
          </View>

          {measurementsQuery.isError ? (
            <EmptyState
              icon={<LumiOwl size={72} />}
              title="Não foi possível carregar as consultas"
              message="Verifique sua internet e puxe para atualizar. As consultas já vistas abrem offline."
            />
          ) : measurements.length === 0 ? (
            <EmptyState
              icon={<LumiOwl size={72} />}
              title="Ainda não há consultas registradas"
              message="Assim que a Dra. Christiane registrar uma consulta, as medidas e a avaliação dela aparecem aqui."
            />
          ) : (
            measurements.map((m) => (
              <View key={m.id} style={styles.cardWrap}>
                <MeasurementCard measurement={m} />
              </View>
            ))
          )}

          <ClinicalDisclaimer />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.md,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pressedDim: {
    opacity: 0.6,
  },
  subtitle: {
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: 0,
  },
  body: {
    paddingHorizontal: spacing.screenX,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
});
