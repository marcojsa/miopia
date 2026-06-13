// Linha de configuração tocável (ícone opcional + título + descrição + chevron).
// Usada na seção "Sua conta" e na tela Conta. Ações destrutivas usam tom coral
// (variant 'danger') — nunca verde/vermelho semafórico em dado clínico (aqui
// não há dado clínico: é navegação de conta).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

export interface SettingsRowProps {
  title: string;
  description?: string;
  /** Ícone à esquerda (quadradinho roxo); decorativo. */
  icon?: ReactNode;
  onPress: () => void;
  /** 'danger' pinta o título em coral (ex.: Sair, Excluir conta). */
  variant?: 'default' | 'danger';
  /** Esconde o chevron à direita (ex.: ação imediata como Sair). */
  hideChevron?: boolean;
  accessibilityLabel?: string;
}

export function SettingsRow({
  title,
  description,
  icon,
  onPress,
  variant = 'default',
  hideChevron = false,
  accessibilityLabel,
}: SettingsRowProps) {
  const titleColor = variant === 'danger' ? colors.coral : colors.purple900;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {icon ? <View style={styles.iconBox}>{icon}</View> : null}
      <View style={styles.text}>
        <AppText variant="cardTitle" color={titleColor} style={styles.title}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="meta" color={colors.ink2} style={styles.description}>
            {description}
          </AppText>
        ) : null}
      </View>
      {hideChevron ? null : <ChevronIcon direction="right" color={colors.ink3} size={20} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 15,
  },
  description: {
    marginTop: 2,
  },
});
