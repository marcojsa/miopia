// Pill/chip de rótulo (horário da tarefa, badges como "amanhã").
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

export interface PillProps {
  label: string;
  /** Cor do texto; padrão roxo primário. */
  color?: string;
  /** Cor de fundo; padrão roxo-50. */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Pill({
  label,
  color = colors.purple,
  backgroundColor = colors.purple50,
  style,
  textStyle,
}: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor }, style]}>
      <Text style={[styles.text, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.interBold,
    fontSize: 13,
  },
});
