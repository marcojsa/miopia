// Título de seção em caixa alta (mockup .sec-t: "ESTA NOITE", "AMANHÃ CEDO").
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

export interface SectionHeaderProps {
  title: string;
  /** Conteúdo opcional alinhado à direita (link, contador). */
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, accessory, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 2,
  },
  title: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.ink3,
  },
});
