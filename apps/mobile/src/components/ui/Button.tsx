// Botão do design system.
// - primary: roxo #453A94 (ações gerais)
// - done: verde #88B04B — USO EXCLUSIVO do check-in "Feito" (regra de cor)
// - ghost: branco com borda #E2E8F0 (ações secundárias, "Não foi possível")
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'done' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Mostra spinner e bloqueia o toque (ex.: check-in sincronizando). */
  loading?: boolean;
  /** Ícone à esquerda do rótulo (ex.: <CheckIcon /> no Feito). */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Padrão: o próprio label. */
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const blocked = disabled || loading;
  const spinnerColor = variant === 'ghost' ? colors.purple : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !blocked ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  label: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 15,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.purple },
  done: { backgroundColor: colors.green },
  ghost: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.white },
  done: { color: colors.white },
  ghost: { color: colors.ink2, fontFamily: fonts.nunitoExtraBold, fontSize: 13.5 },
});
