// Céu do mês em react-native-svg (mockup ceu.html, estilo A).
// Desenha, sobre o gradiente do céu: poeira de estrelas de fundo, a lua, as
// linhas tracejadas da constelação em progresso e uma estrela por noite —
// dourada (com glow) = noite completa, prateada (mini-escudo) = salva por
// escudo, nuvem = férias, pontilhada discreta = vazia, tracejada roxa = hoje
// (com glow sutil animado). Noites futuras não aparecem.
//
// REGRA DURA (ANVISA): nenhum número/dado clínico aparece aqui — só celebra
// ADESÃO. Amarelo-estrela é exclusivo destas estrelas/escudos.
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Polygon,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';

import { colors, fonts } from '@/theme/tokens';
import type { SkyDay } from '@/lib/gamification';
import {
  SKY_H,
  SKY_W,
  constellationPoints,
  layoutSky,
  type SkyMark,
} from './skyLayout';

const AnimatedG = Animated.createAnimatedComponent(G);

const STAR_POINTS =
  '10,0 12.65,6.36 19.51,6.91 14.28,11.39 15.88,18.09 10,14.5 4.12,18.09 5.72,11.39 0.49,6.91 7.35,6.36';
const SHIELD_PATH = 'M12 2 L20 5 V11 C20 16.5 16.6 20.4 12 22 C7.4 20.4 4 16.5 4 11 V5 Z';

// Poeira de estrelas do fundo (decorativa, fixa — fiel ao mockup).
const DUST: ReadonlyArray<{ cx: number; cy: number; r: number; o: number }> = [
  { cx: 30, cy: 160, r: 1.1, o: 0.35 },
  { cx: 140, cy: 40, r: 1.2, o: 0.3 },
  { cx: 210, cy: 150, r: 1.1, o: 0.3 },
  { cx: 350, cy: 200, r: 1.2, o: 0.35 },
  { cx: 300, cy: 290, r: 1.1, o: 0.3 },
  { cx: 100, cy: 300, r: 1.2, o: 0.3 },
  { cx: 370, cy: 100, r: 1, o: 0.3 },
  { cx: 195, cy: 265, r: 1, o: 0.3 },
];

export interface SkyCanvasProps {
  /** Saída de computeSky(...) para o mês exibido. */
  days: SkyDay[];
  /** Data lógica de hoje 'YYYY-MM-DD' (marca a estrela tracejada). */
  today: string;
  /** Nome do filho ativo (compõe o rótulo de acessibilidade do céu). */
  childName: string;
}

// Estrela dourada/prateada (preenchida) centrada em (cx,cy), com glow opcional.
function FilledStar({ mark, size }: { mark: SkyMark; size: number }) {
  const fill = mark.kind === 'silver' ? colors.silver : colors.star;
  const half = size / 2;
  return (
    <G x={mark.cx - half} y={mark.cy - half}>
      <Polygon points={STAR_POINTS} fill={fill} scale={size / 20} />
    </G>
  );
}

export function SkyCanvas({ days, today, childName }: SkyCanvasProps) {
  const marks = layoutSky(days, today);
  const line = constellationPoints(marks);

  // Glow pulsante (sutil) da estrela de HOJE — Animated nativo (Expo Go ok).
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.95, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const goldCount = marks.filter((m) => m.kind === 'gold').length;
  const a11yLabel =
    `Céu de ${childName}: ${goldCount} ${goldCount === 1 ? 'estrela acesa' : 'estrelas acesas'} ` +
    `por noites de cuidado neste mês.`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11yLabel}>
      <Svg width="100%" height={SKY_H} viewBox={`0 0 ${SKY_W} ${SKY_H}`}>
        {/* Poeira de estrelas */}
        {DUST.map((d, i) => (
          <Circle key={`dust-${i}`} cx={d.cx} cy={d.cy} r={d.r} fill={colors.purple200} opacity={d.o} />
        ))}

        {/* Lua (crescente, recortada) */}
        <Path
          d="M52 26 A 27 27 0 1 0 52 80 A 21 21 0 1 1 52 26 Z"
          fill={colors.moon}
          opacity={0.92}
        />

        {/* Linhas da constelação em progresso (tracejadas) */}
        {line.split(' ').length >= 2 ? (
          <Polyline
            points={line}
            fill="none"
            stroke={colors.white}
            strokeOpacity={0.28}
            strokeWidth={1.6}
            strokeDasharray="1 5"
            strokeLinecap="round"
          />
        ) : null}

        {/* Marcos das noites */}
        {marks.map((m) => {
          if (m.kind === 'cloud') {
            // Nuvem (viewBox 60x36): centra escalando ~0.78.
            const s = 0.78;
            return (
              <G key={m.date} x={m.cx - 30 * s} y={m.cy - 18 * s} opacity={0.85}>
                <G scale={s}>
                  <Circle cx={18} cy={24} r={10} fill={colors.cloud} />
                  <Circle cx={32} cy={17} r={13} fill={colors.cloud} />
                  <Circle cx={45} cy={25} r={9} fill={colors.cloud} />
                  <Path d="M14 22 H48 V33 H14 Z" fill={colors.cloud} />
                </G>
              </G>
            );
          }

          if (m.kind === 'empty') {
            // Vazia: estrela tracejada bem discreta (estado neutro, sem fracasso).
            const size = 18;
            const half = size / 2;
            return (
              <G key={m.date} x={m.cx - half} y={m.cy - half} opacity={0.5}>
                <Polygon
                  points={STAR_POINTS}
                  fill="none"
                  stroke={colors.purple200}
                  strokeWidth={1.1}
                  strokeDasharray="2 3"
                  strokeLinejoin="round"
                  scale={size / 20}
                />
              </G>
            );
          }

          if (m.kind === 'today') {
            // Hoje: estrela tracejada roxa/dourada com glow pulsante + rótulo "hoje".
            const size = 26;
            const half = size / 2;
            return (
              <G key={m.date}>
                <AnimatedG opacity={pulse}>
                  <Circle cx={m.cx} cy={m.cy} r={17} fill={colors.star} opacity={0.16} />
                </AnimatedG>
                <G x={m.cx - half} y={m.cy - half}>
                  <Polygon
                    points={STAR_POINTS}
                    fill="none"
                    stroke={colors.star}
                    strokeWidth={1.6}
                    strokeDasharray="3 3"
                    strokeLinejoin="round"
                    scale={size / 20}
                  />
                </G>
                <SvgText
                  x={m.cx}
                  y={m.cy + 26}
                  fontSize={9.5}
                  fontWeight="700"
                  fontFamily={fonts.interBold}
                  fill={colors.star}
                  textAnchor="middle"
                >
                  hoje
                </SvgText>
              </G>
            );
          }

          // gold / silver: estrela preenchida (glow nas douradas) + mini-escudo nas prateadas.
          const size = 22;
          return (
            <G key={m.date}>
              {m.kind === 'gold' ? (
                <Circle cx={m.cx} cy={m.cy} r={15} fill={colors.star} opacity={0.16} />
              ) : (
                <Circle cx={m.cx} cy={m.cy} r={14} fill={colors.silver} opacity={0.14} />
              )}
              <FilledStar mark={m} size={size} />
              {m.kind === 'silver' ? (
                <G x={m.cx + 6} y={m.cy - 16}>
                  <Path d={SHIELD_PATH} fill={colors.silver} scale={13 / 24} />
                </G>
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
