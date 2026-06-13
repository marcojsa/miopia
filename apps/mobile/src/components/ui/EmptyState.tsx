// Estado vazio acolhedor (sem tom de erro/fracasso — regra do produto).
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { spacing } from '@/theme/tokens';

export interface EmptyStateProps {
  title: string;
  message?: string;
  /** Ilustração/ícone opcional acima do título (ex.: <LumiOwl size={72} />). */
  icon?: ReactNode;
  /** Ação opcional (botão primary). */
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ title, message, icon, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.root, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <AppText variant="cardTitle" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" style={[styles.center, styles.message]}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 32,
  },
  icon: { marginBottom: spacing.lg },
  center: { textAlign: 'center' },
  message: { marginTop: spacing.sm },
  action: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
