// Card branco padrão com a sombra do design system.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  /** Raio do canto; padrão radii.card (20). Use radii.cardSm (16) em cards compactos. */
  radius?: number;
  /** Remove o padding interno padrão (16) quando o conteúdo controla o próprio espaçamento. */
  unpadded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, radius = radii.card, unpadded = false, style }: CardProps) {
  return (
    <View
      style={[styles.card, { borderRadius: radius }, unpadded ? null : styles.padded, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    ...shadows.card,
  },
  padded: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
});
