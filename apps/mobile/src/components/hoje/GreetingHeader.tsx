// Header gradiente da aba Hoje: saudação por hora + data por extenso pt-BR e
// chips dos filhos (ChildAvatar + nome + horário). O chip selecionado controla
// useUiStore.activeChildId. Padrão de gradiente + insets copiado de sign-in.tsx.
// Decoração de estrelinhas é invisível para leitores de tela.
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, ChildAvatar } from '@/components/ui';
import { colors, fonts, gradients, radii, spacing } from '@/theme/tokens';
import type { Child } from '@/types/domain';

export interface ChildChip {
  child: Child;
  /** Subtexto do chip (ex.: "colírio 20h30"), já formatado pela tela. */
  subtitle: string | null;
}

export interface GreetingHeaderProps {
  greeting: string;
  displayName: string;
  longDate: string;
  chips: ChildChip[];
  activeChildId: string | null;
  onSelectChild: (childId: string) => void;
}

// Estrelinhas decorativas do céu do header (mockup .specks).
const SPECKS: ReadonlyArray<{ top: number; left: DimensionValue; size: number; opacity: number }> = [
  { top: 14, left: '10%', size: 3, opacity: 0.7 },
  { top: 8, left: '84%', size: 2.5, opacity: 0.6 },
  { top: 40, left: '73%', size: 3.5, opacity: 0.5 },
  { top: 6, left: '31%', size: 2.5, opacity: 0.5 },
  { top: 30, left: '54%', size: 2.5, opacity: 0.45 },
];

export function GreetingHeader({
  greeting,
  displayName,
  longDate,
  chips,
  activeChildId,
  onSelectChild,
}: GreetingHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[...gradients.headerHoje.colors]}
      start={gradients.headerHoje.start}
      end={gradients.headerHoje.end}
      style={[styles.header, { paddingTop: insets.top + spacing.md }]}
    >
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {SPECKS.map((s, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              borderRadius: s.size / 2,
              backgroundColor: colors.purple200,
              opacity: s.opacity,
            }}
          />
        ))}
      </View>

      <AppText variant="display" color={colors.white} accessibilityRole="header" style={styles.greet}>
        {greeting}, {displayName}
      </AppText>
      <AppText variant="body" color={colors.purple200} style={styles.date}>
        {longDate}
      </AppText>

      {chips.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {chips.map(({ child, subtitle }) => {
            const selected = child.id === activeChildId;
            return (
              <Pressable
                key={child.id}
                onPress={() => onSelectChild(child.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Ver a noite de ${child.first_name}`}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <ChildAvatar firstName={child.first_name} seed={child.avatar_key ?? child.id} size={28} />
                <View style={styles.chipText}>
                  <AppText style={styles.chipName} color={colors.white} numberOfLines={1}>
                    {child.first_name}
                  </AppText>
                  {subtitle ? (
                    <AppText style={styles.chipSub} color={colors.purple200} numberOfLines={1}>
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.headerX,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  greet: {
    marginTop: spacing.xs,
  },
  date: {
    marginTop: 2,
  },
  chipsScroll: {
    marginTop: spacing.lg,
    marginHorizontal: -spacing.headerX,
  },
  chipsRow: {
    paddingHorizontal: spacing.headerX,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  chipSelected: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
  chipText: {
    maxWidth: 150,
  },
  chipName: {
    fontFamily: fonts.nunitoExtraBold,
    fontSize: 13,
  },
  chipSub: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    lineHeight: 14,
  },
});
