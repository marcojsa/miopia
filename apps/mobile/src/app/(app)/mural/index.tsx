// ABA MURAL: orientações e vídeos publicados pela clínica, com filtro por
// categoria. Conteúdo EDUCATIVO geral — nenhum dado clínico da criança aqui
// (ANVISA RDC 657/2022). Abre offline pelo cache persistido.
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { CATEGORY_ORDER, categoryLabel } from '@/components/mural';
import { AppText, Card, EmptyState, Pill, Screen } from '@/components/ui';
import { queryKeys, useContents } from '@/hooks';
import { youtubeId, youtubeThumbnail } from '@/lib/youtube';
import { useSession } from '@/providers/auth';
import { colors, radii, spacing } from '@/theme/tokens';
import type { Content, ContentCategory } from '@/types/domain';

type Filter = ContentCategory | 'todos';

export default function MuralScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const contentsQuery = useContents();
  const [filter, setFilter] = useState<Filter>('todos');
  const [refreshing, setRefreshing] = useState(false);

  const contents = useMemo(() => contentsQuery.data ?? [], [contentsQuery.data]);
  const categories = useMemo(
    () => CATEGORY_ORDER.filter((c) => contents.some((item) => item.category === c)),
    [contents]
  );
  // Categoria escolhida que ficou sem conteúdo volta para "Todos".
  const active: Filter = filter !== 'todos' && categories.includes(filter) ? filter : 'todos';
  const visible = active === 'todos' ? contents : contents.filter((c) => c.category === active);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.contents(session?.user.id ?? null) });
    } finally {
      setRefreshing(false);
    }
  };

  // As rotas tipadas (.expo/types) só incluem o mural depois do próximo `expo start`.
  const open = (id: string): void => router.push(`/mural/${encodeURIComponent(id)}` as Href);

  const header = (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header">
        Mural da clínica
      </AppText>
      <AppText variant="body" color={colors.ink2} style={styles.subtitle}>
        Orientações da Dra. para o dia a dia
      </AppText>
    </View>
  );

  if (contentsQuery.isLoading) {
    return (
      <Screen>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
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

        {contents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {(['todos', ...categories] as Filter[]).map((c) => {
              const selected = c === active;
              const label = c === 'todos' ? 'Todos' : categoryLabel(c);
              return (
                <Pressable
                  key={c}
                  onPress={() => setFilter(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Filtrar: ${label}`}
                  style={({ pressed }) => (pressed ? styles.pressed : null)}
                >
                  <Pill
                    label={label}
                    color={selected ? colors.white : colors.purple}
                    backgroundColor={selected ? colors.purple : colors.purple50}
                    style={styles.chip}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.body}>
          {contentsQuery.isRefetchError ||
          (contentsQuery.failureCount > 0 && contentsQuery.data !== undefined) ? (
            <AppText variant="meta" color={colors.ink2} style={styles.cardWrap}>
              Sem conexão. Mostrando a última versão salva.
            </AppText>
          ) : null}

          {contentsQuery.isError && contentsQuery.data === undefined ? (
            <EmptyState
              icon={<LumiOwl size={72} />}
              title="Não foi possível carregar o mural"
              message="Verifique sua internet e puxe para atualizar. O que você já viu abre offline."
            />
          ) : contents.length === 0 ? (
            <EmptyState
              icon={<LumiOwl size={72} />}
              title="O mural ainda está vazio"
              message="Quando a clínica publicar orientações e vídeos para o dia a dia, eles aparecem aqui."
            />
          ) : (
            visible.map((item) => (
              <View key={item.id} style={styles.cardWrap}>
                <ContentCard content={item} onPress={() => open(item.id)} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function ContentCard({ content, onPress }: { content: Content; onPress: () => void }) {
  const videoId = youtubeId(content.youtube_url);
  const excerpt = content.body?.trim() ?? '';
  const category = categoryLabel(content.category);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${content.title}. ${category}${videoId ? ', com vídeo' : ''}. Abrir`}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card unpadded>
        {videoId ? (
          <View style={styles.thumbBox}>
            <Image
              source={{ uri: youtubeThumbnail(videoId) }}
              style={styles.thumb}
              resizeMode="cover"
              accessible={false}
            />
            <View style={styles.playBadge}>
              <PlayIcon size={26} color={colors.white} />
            </View>
          </View>
        ) : null}
        <View style={styles.cardText}>
          <Pill label={category} style={styles.categoryPill} />
          <AppText variant="cardTitle" numberOfLines={2}>
            {content.title}
          </AppText>
          {excerpt.length > 0 ? (
            <AppText variant="body" color={colors.ink2} numberOfLines={3} style={styles.excerpt}>
              {excerpt}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: 0,
  },
  chipsScroll: {
    marginTop: spacing.lg,
    flexGrow: 0,
  },
  chipsRow: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
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
  thumbBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.purple100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(29,24,64,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  categoryPill: {
    marginBottom: spacing.sm,
  },
  excerpt: {
    marginTop: spacing.xs,
  },
});
