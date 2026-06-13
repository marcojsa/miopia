// Ícones SVG exclusivos da tela de consentimento (portados 1:1 do mockup
// docs/mockups/onboarding-consentimento.html). Ficam aqui, e não no barrel de
// ícones da fundação (@/components/icons), porque são de uso local desta tela.
// Decorativos por padrão (accessible={false}): o significado vem do texto ao lado.
import type { ColorValue } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export interface ConsentIconProps {
  size?: number;
  color?: ColorValue;
}

/** Pasta — "O que registramos" (mockup #folder). */
export function FolderIcon({ size = 19, color = colors.purple }: ConsentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M3 7 A2 2 0 0 1 5 5 H9 L11 7 H19 A2 2 0 0 1 21 9 V17 A2 2 0 0 1 19 19 H5 A2 2 0 0 1 3 17 Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Alvo — "Para que usamos" (mockup #target). */
export function TargetIcon({ size = 19, color = colors.purple }: ConsentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 4 A8 8 0 1 0 12.001 4 Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <Path d="M12 9 A3 3 0 1 0 12.001 9 Z" fill={color} />
    </Svg>
  );
}

/** Duas pessoas — "Quem vê esses dados" (mockup #people). */
export function PeopleConsentIcon({ size = 19, color = colors.purple }: ConsentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M9 4.8 A3.2 3.2 0 1 0 9.001 4.8 Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M3.5 19 A5.5 5.5 0 0 1 14.5 19"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M16 5.5 A3 3 0 0 1 16 11 M16.5 14 A5.5 5.5 0 0 1 20.5 18.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Balança da justiça — "Seus direitos" (mockup #scale). */
export function ScaleIcon({ size = 19, color = colors.purple }: ConsentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 3 V20 M6 20 H18 M5 7 H19 M5 7 L3 13 H7 Z M19 7 L17 13 H21 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Escudo com coração — tag da autorização de dados de saúde (mockup #heart-shield). */
export function HeartShieldIcon({ size = 15, color = colors.white }: ConsentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 2 L20 5 V11 C20 16.5 16.6 20.4 12 22 C7.4 20.4 4 16.5 4 11 V5 Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M12 15 C12 15 8.5 12.8 8.5 10.6 A1.9 1.9 0 0 1 12 9.6 A1.9 1.9 0 0 1 15.5 10.6 C15.5 12.8 12 15 12 15 Z"
        fill={color}
      />
    </Svg>
  );
}

/** Cadeado — selo da versão do termo no rodapé (mockup #lock). */
export function LockIcon({ size = 13, color = colors.ink3 }: ConsentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x={5} y={10.5} width={14} height={9.5} rx={3} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M8 10.5 V8 A4 4 0 0 1 16 8 V10.5" fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
