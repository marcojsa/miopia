// Lumi, a coruja mascote — ESTILO A APROVADO (redonda e macia).
// Port fiel do <symbol id="owl-a"> de docs/mockups/ceu.html (viewBox 0 0 200 220).
// Penas #453A94/#5B4FB5, olho externo #6F63C8 + branco + pupila #241D4F +
// reflexo, barriga #EDEBFF, bico/pés #F4976C.
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export interface LumiOwlProps {
  /** Largura em px; a altura segue a proporção 200x220 do desenho original. */
  size?: number;
  /** Rótulo de acessibilidade; padrão descreve a mascote. */
  accessibilityLabel?: string;
}

export function LumiOwl({
  size = 96,
  accessibilityLabel = 'Lumi, a coruja que enxerga no escuro',
}: LumiOwlProps) {
  return (
    <Svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 200 220"
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {/* Tufos das orelhas */}
      <Path d="M60 40 L73 16 L86 42 Z" fill={colors.purple} />
      <Path d="M114 42 L127 16 L140 40 Z" fill={colors.purple} />
      {/* Corpo */}
      <Ellipse cx={100} cy={122} rx={66} ry={78} fill={colors.purple500} />
      {/* Asas */}
      <Ellipse cx={41} cy={138} rx={15} ry={33} fill={colors.purple} rotation={16} origin="41, 138" />
      <Ellipse
        cx={159}
        cy={138}
        rx={15}
        ry={33}
        fill={colors.purple}
        rotation={-16}
        origin="159, 138"
      />
      {/* Barriga com plumas */}
      <Ellipse cx={100} cy={155} rx={40} ry={37} fill={colors.owlBelly} />
      <Path
        d="M84 142 Q92 150 100 142"
        fill="none"
        stroke={colors.purple200}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M100 142 Q108 150 116 142"
        fill="none"
        stroke={colors.purple200}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M92 158 Q100 166 108 158"
        fill="none"
        stroke={colors.purple200}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Olhos enormes */}
      <Circle cx={76} cy={92} r={30} fill={colors.owlEye} />
      <Circle cx={124} cy={92} r={30} fill={colors.owlEye} />
      <Circle cx={76} cy={92} r={22} fill={colors.white} />
      <Circle cx={124} cy={92} r={22} fill={colors.white} />
      <Circle cx={79} cy={94} r={10} fill={colors.owlPupil} />
      <Circle cx={127} cy={94} r={10} fill={colors.owlPupil} />
      <Circle cx={82.5} cy={90.5} r={3.5} fill={colors.white} />
      <Circle cx={130.5} cy={90.5} r={3.5} fill={colors.white} />
      {/* Bico e pés */}
      <Path d="M92 112 L108 112 L100 125 Z" fill={colors.coral} />
      <Ellipse cx={84} cy={199} rx={10} ry={6} fill={colors.coral} />
      <Ellipse cx={116} cy={199} rx={10} ry={6} fill={colors.coral} />
    </Svg>
  );
}
