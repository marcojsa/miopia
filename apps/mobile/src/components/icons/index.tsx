// Ícones SVG do Lumi — paths portados 1:1 dos mockups aprovados
// (docs/mockups/hoje.html e ceu.html). Todos decorativos por padrão:
// quem dá significado é o texto ao lado (accessibilityLabel fica no container).
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export interface IconProps {
  size?: number;
  color?: ColorValue;
}

/** Gota de colírio (atropina) — mockup #drop. */
export function DropIcon({ size = 22, color = colors.purple }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 3 C12 3 5.5 10.5 5.5 15 A6.5 6.5 0 0 0 18.5 15 C18.5 10.5 12 3 12 3 Z"
        fill={color}
      />
    </Svg>
  );
}

/** Lente de ortho-k — mockup #lens. */
export function LensIcon({ size = 22, color = colors.purple }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx={12} cy={12} r={8} fill="none" stroke={color} strokeWidth={2.2} />
      <Path
        d="M8.5 12 A3.5 3.5 0 0 1 12 8.5"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Amanhecer (retirar a lente de manhã) — mockup #sunrise. */
export function SunriseIcon({ size = 20, color = '#B07A3B' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M4 17 H20 M12 13 V7 M7.5 14 A4.5 4.5 0 0 1 16.5 14 M5 10 L6.5 11.5 M19 10 L17.5 11.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export type StarIconVariant = 'filled' | 'silver' | 'empty' | 'today';

const STAR_POINTS =
  '10,0 12.65,6.36 19.51,6.91 14.28,11.39 15.88,18.09 10,14.5 4.12,18.09 5.72,11.39 0.49,6.91 7.35,6.36';

export interface StarIconProps {
  size?: number;
  /**
   * filled = noite completa (dourada #FFC857) · silver = salva por escudo
   * (#C7CEDB) · empty = sem registro (tracejada cinza) · today = hoje
   * (contorno roxo). `color` sobrescreve a cor do variant quando necessário.
   */
  variant?: StarIconVariant;
  color?: ColorValue;
}

/** Estrela de 5 pontas — mockup #star5. */
export function StarIcon({ size = 22, variant = 'filled', color }: StarIconProps) {
  if (variant === 'filled' || variant === 'silver') {
    const fill = color ?? (variant === 'filled' ? colors.star : colors.silver);
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" accessible={false}>
        <Polygon points={STAR_POINTS} fill={fill} />
      </Svg>
    );
  }
  const stroke = color ?? (variant === 'today' ? colors.purple : '#CBD5E1');
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" accessible={false}>
      <Polygon
        points={STAR_POINTS}
        fill="none"
        stroke={stroke}
        strokeWidth={variant === 'today' ? 1.6 : 1.4}
        strokeDasharray={variant === 'empty' ? '3 3' : undefined}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export interface ShieldIconProps {
  size?: number;
  /** filled = escudo guardado (dourado) · empty = slot vazio (tracejado). */
  variant?: 'filled' | 'empty';
  color?: ColorValue;
}

/** Escudo de proteção da sequência — mockup #shield. */
export function ShieldIcon({ size = 20, variant = 'filled', color }: ShieldIconProps) {
  const d = 'M12 2 L20 5 V11 C20 16.5 16.6 20.4 12 22 C7.4 20.4 4 16.5 4 11 V5 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {variant === 'filled' ? (
        <Path d={d} fill={color ?? colors.star} />
      ) : (
        <Path
          d={d}
          fill="none"
          stroke={color ?? colors.purple200}
          strokeWidth={1.4}
          strokeDasharray="2.5 2.5"
        />
      )}
    </Svg>
  );
}

/** Nuvem do modo férias — mockup #cloudy (viewBox 60x36, proporção 5:3). */
export function CloudIcon({ size = 27, color = colors.cloud }: IconProps) {
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 60 36" accessible={false}>
      <Circle cx={18} cy={24} r={10} fill={color} />
      <Circle cx={32} cy={17} r={13} fill={color} />
      <Circle cx={45} cy={25} r={9} fill={color} />
      <Rect x={14} y={22} width={34} height={11} rx={5.5} fill={color} />
    </Svg>
  );
}

/** Lua crescente — mockup #moon. Ícone da tab Hoje. */
export function MoonIcon({ size = 22, color = colors.purple }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M19.5 14.2 A8.4 8.4 0 1 1 9.8 4.5 A6.8 6.8 0 0 0 19.5 14.2 Z" fill={color} />
    </Svg>
  );
}

export interface ChevronIconProps extends IconProps {
  direction?: 'right' | 'left' | 'up' | 'down';
}

const CHEVRON_ROTATION: Record<NonNullable<ChevronIconProps['direction']>, string> = {
  right: '0deg',
  down: '90deg',
  left: '180deg',
  up: '270deg',
};

/** Chevron de navegação (listas, voltar). */
export function ChevronIcon({ size = 20, color = colors.ink3, direction = 'right' }: ChevronIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={false}
      style={{ transform: [{ rotate: CHEVRON_ROTATION[direction] }] }}
    >
      <Path
        d="M9 5.5 L15.5 12 L9 18.5"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Check de confirmação — mockup #check. Padrão branco (uso no botão Feito). */
export function CheckIcon({ size = 17, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M5 12.5 L10 17.5 L19 7"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** X de fechar (modais, céu fullscreen). */
export function XIcon({ size = 18, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M6 6 L18 18 M18 6 L6 18"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Documento (relatório da consulta) — ícone da tab Progresso. */
export function DocumentIcon({ size = 22, color = colors.purple }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect
        x={5.5}
        y={3.5}
        width={13}
        height={17}
        rx={2.5}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M9 9 H15 M9 12.5 H15 M9 16 H12.5"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Duas pessoas — ícone da tab Família. */
export function PeopleIcon({ size = 22, color = colors.purple }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx={9} cy={8} r={3.4} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M3.5 19.5 C3.5 15.9 5.9 13.5 9 13.5 C12.1 13.5 14.5 15.9 14.5 19.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={16.8} cy={9} r={2.7} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M16.4 13.7 C19.1 13.9 20.8 15.9 20.8 18.8"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
