// Olho com pupila do card educativo (path portado 1:1 do mockup evolucao.html,
// símbolo #eye-q). Decorativo (accessible={false}): o título ao lado dá sentido.
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export interface EyeQuestionIconProps {
  size?: number;
  color?: ColorValue;
}

export function EyeQuestionIcon({ size = 20, color = colors.purple }: EyeQuestionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.2} fill={color} />
    </Svg>
  );
}
