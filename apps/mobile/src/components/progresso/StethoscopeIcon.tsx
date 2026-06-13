// Estetoscópio decorativo do bloco "Avaliação da Dra." (path portado 1:1 do
// mockup evolucao.html, símbolo #stetho). Decorativo (accessible={false}): o
// significado vem do título "Avaliação da Dra. Christiane" ao lado.
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export interface StethoscopeIconProps {
  size?: number;
  color?: ColorValue;
}

export function StethoscopeIcon({ size = 20, color = colors.purple }: StethoscopeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M6 3 V8 A4 4 0 0 0 14 8 V3"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M10 12 V14 A5 5 0 0 0 20 14 V12"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={20} cy={10.5} r={2.2} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
