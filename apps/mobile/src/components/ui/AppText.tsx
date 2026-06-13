// Texto com a escala tipográfica do design system (theme/tokens).
// Sempre prefira AppText a <Text> cru: garante Nunito/Inter e cores corretas.
import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/theme/tokens';

export type AppTextVariant = 'display' | 'title' | 'cardTitle' | 'body' | 'meta' | 'small';

export interface AppTextProps extends TextProps {
  /** display 25/Nunito900 · title 21/Nunito900 · cardTitle 16.5/Nunito900 ·
   * body 13.5/Inter500 · meta 12.5/Inter600 · small 11/Inter600. */
  variant?: AppTextVariant;
  /** Sobrescreve a cor padrão do variant. */
  color?: string;
}

const DEFAULT_COLOR: Record<AppTextVariant, string> = {
  display: colors.purple900,
  title: colors.purple900,
  cardTitle: colors.purple900,
  body: colors.ink,
  meta: colors.ink2,
  small: colors.ink3,
};

export function AppText({ variant = 'body', color, style, children, ...rest }: AppTextProps) {
  return (
    <Text style={[styles[variant], { color: color ?? DEFAULT_COLOR[variant] }, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  display: typography.variants.display,
  title: typography.variants.title,
  cardTitle: typography.variants.cardTitle,
  body: typography.variants.body,
  meta: typography.variants.meta,
  small: typography.variants.small,
});
