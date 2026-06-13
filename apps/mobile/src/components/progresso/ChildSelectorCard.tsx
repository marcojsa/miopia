// Card de seleção de filho no índice da aba Progresso (quando há mais de um).
// Mostra avatar (ilustração/inicial — LGPD, sem foto) + nome + chevron. NENHUM
// dado clínico aqui: só o nome e, opcionalmente, o regime de tratamento.
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { AppText, Card, ChildAvatar, Pill } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';
import type { Child } from '@/types/domain';

export interface ChildSelectorCardProps {
  child: Child;
  /** Rótulo de regime (ex.: "Atropina"); omitido quando não há tratamento ativo. */
  regimeLabel?: string;
  onPress: () => void;
}

export function ChildSelectorCard({ child, regimeLabel, onPress }: ChildSelectorCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver a evolução de ${child.first_name}`}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card style={styles.card}>
        <ChildAvatar firstName={child.first_name} seed={child.avatar_key ?? child.id} size={44} />
        <View style={styles.text}>
          <AppText variant="cardTitle">{child.first_name}</AppText>
          {regimeLabel ? <Pill label={regimeLabel} style={styles.pill} /> : null}
        </View>
        <ChevronIcon direction="right" color={colors.ink3} size={20} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pill: {
    marginTop: spacing.xs,
  },
});
