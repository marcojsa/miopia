// DETALHE DO MURAL: vídeo (player embutido) + texto completo de um conteúdo
// publicado. Conteúdo EDUCATIVO geral — nenhum dado clínico da criança aqui
// (ANVISA RDC 657/2022). Lê da mesma query da lista (abre offline).
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { YoutubePlayer, categoryLabel } from '@/components/mural';
import { AppText, Button, EmptyState, Pill, Screen } from '@/components/ui';
import { useContents } from '@/hooks';
import { youtubeId, youtubeWatchUrl } from '@/lib/youtube';
import { colors, spacing } from '@/theme/tokens';

export default function MuralDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentsQuery = useContents();

  const content = (contentsQuery.data ?? []).find((c) => c.id === id);
  const videoId = youtubeId(content?.youtube_url);
  const externalUrl = content?.youtube_url?.trim() ?? '';

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/mural' as Href);
  };

  const backButton = (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Voltar para o mural"
      hitSlop={10}
      style={({ pressed }) => [styles.back, pressed ? styles.pressedDim : null]}
    >
      <ChevronIcon direction="left" color={colors.purple} size={20} />
    </Pressable>
  );

  if (contentsQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.header}>{backButton}</View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  if (!content) {
    const failed = contentsQuery.isError && contentsQuery.data === undefined;
    return (
      <Screen>
        <View style={styles.header}>{backButton}</View>
        <View style={styles.centered}>
          <EmptyState
            icon={<LumiOwl size={72} />}
            title={failed ? 'Não foi possível carregar agora' : 'Este conteúdo não está mais no mural'}
            message={
              failed
                ? 'Verifique sua internet e tente de novo.'
                : 'A clínica pode ter tirado este conteúdo do ar. Veja os outros no mural.'
            }
            action={{ label: 'Voltar para o mural', onPress: goBack }}
          />
        </View>
      </Screen>
    );
  }

  const body = content.body?.trim() ?? '';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {backButton}
          <Pill label={categoryLabel(content.category)} style={styles.categoryPill} />
          <AppText variant="title" accessibilityRole="header">
            {content.title}
          </AppText>
        </View>

        <View style={styles.body}>
          {videoId ? (
            <>
              <YoutubePlayer videoId={videoId} title={content.title} />
              <Button
                label="Assistir no YouTube"
                variant="ghost"
                onPress={() => {
                  void Linking.openURL(youtubeWatchUrl(videoId));
                }}
                accessibilityLabel={`Assistir o vídeo "${content.title}" no YouTube`}
              />
            </>
          ) : externalUrl.length > 0 ? (
            <Button
              label="Abrir no YouTube"
              variant="ghost"
              onPress={() => {
                void Linking.openURL(externalUrl);
              }}
              accessibilityLabel={`Abrir o vídeo "${content.title}" no YouTube`}
            />
          ) : null}

          {body.length > 0 ? (
            <AppText variant="body" color={colors.ink} style={styles.text}>
              {body}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
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
  categoryPill: {
    marginBottom: spacing.sm,
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
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  text: {
    fontSize: 15,
    lineHeight: 23,
  },
});
