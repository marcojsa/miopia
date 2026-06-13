// Três cards de marcos de ADESÃO (mockup .marcos): 7 noites (primeira
// constelação), 30 (Constelação da Coruja), 90 (Diploma do Cuidado).
// Atingido = ícone preenchido + texto "Conquistada!"; bloqueado = esmaecido
// com "Faltam N!" no marco em curso e descrição neutra nos demais.
// Marcos celebram ADESÃO, nunca resultado clínico (regra dura).
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { StarIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme/tokens';

const STAR_POINTS =
  '10,0 12.65,6.36 19.51,6.91 14.28,11.39 15.88,18.09 10,14.5 4.12,18.09 5.72,11.39 0.49,6.91 7.35,6.36';

export interface MilestoneCardsProps {
  totalNights: number;
  nextMilestone: 7 | 30 | 90 | null;
  nightsToNextMilestone: number;
}

// Ícone 7: estrela única dourada / tracejada se ainda bloqueado.
function SevenIcon({ achieved }: { achieved: boolean }) {
  return <StarIcon size={26} variant={achieved ? 'filled' : 'empty'} />;
}

// Ícone 30: trio de estrelas (mockup), preenchidas se conquistado.
function ThirtyIcon({ achieved }: { achieved: boolean }) {
  const fill = achieved ? colors.star : 'none';
  const stroke = achieved ? undefined : colors.star;
  return (
    <Svg width={34} height={26} viewBox="0 0 34 26" accessible={false}>
      <Polygon points={STAR_POINTS} fill={fill} stroke={stroke} strokeWidth={achieved ? 0 : 1.4} x={0} y={8} scale={13 / 20} />
      <Polygon points={STAR_POINTS} fill={fill} stroke={stroke} strokeWidth={achieved ? 0 : 1.4} x={11} y={0} scale={13 / 20} />
      <Polygon points={STAR_POINTS} fill={fill} stroke={stroke} strokeWidth={achieved ? 0 : 1.4} x={21} y={10} scale={13 / 20} />
    </Svg>
  );
}

// Ícone 90: diploma (mockup #diploma).
function DiplomaIcon({ achieved }: { achieved: boolean }) {
  const c = achieved ? colors.star : colors.purple200;
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" accessible={false}>
      <Path d="M3 5 H21 V18 H3 Z" fill="none" stroke={c} strokeWidth={2} />
      <Path d="M7 10 H17 M7 13.5 H13" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={17} cy={16.5} r={3.2} fill={c} />
      <Path d="M15.6 19 L15 22 L17 20.8 L19 22 L18.4 19" fill={c} />
    </Svg>
  );
}

interface CardSpec {
  milestone: 7 | 30 | 90;
  label: string;
  Icon: React.ComponentType<{ achieved: boolean }>;
  doneText: string;
  // Descrição quando ainda não conquistado e NÃO é o marco em curso.
  lockedText: string;
  // Prefixo de "Faltam N!" quando É o marco em curso.
  inProgressName: string;
}

const SPECS: readonly CardSpec[] = [
  {
    milestone: 7,
    label: '7 noites',
    Icon: SevenIcon,
    doneText: 'Primeira constelação. Conquistada!',
    lockedText: 'Primeira constelação',
    inProgressName: 'primeira constelação',
  },
  {
    milestone: 30,
    label: '30 noites',
    Icon: ThirtyIcon,
    doneText: 'Constelação da Coruja. Conquistada!',
    lockedText: 'Constelação da Coruja',
    inProgressName: 'Constelação da Coruja',
  },
  {
    milestone: 90,
    label: '90 noites',
    Icon: DiplomaIcon,
    doneText: 'Céu completo e Diploma do Cuidado!',
    lockedText: 'Céu completo e Diploma do Cuidado',
    inProgressName: 'Diploma do Cuidado',
  },
];

function nightWord(n: number): string {
  return n === 1 ? 'noite' : 'noites';
}

export function MilestoneCards({
  totalNights,
  nextMilestone,
  nightsToNextMilestone,
}: MilestoneCardsProps) {
  return (
    <View style={styles.row}>
      {SPECS.map((spec) => {
        const achieved = totalNights >= spec.milestone;
        const inProgress = nextMilestone === spec.milestone;
        let text: string;
        if (achieved) text = spec.doneText;
        else if (inProgress)
          text = `${spec.inProgressName}. Faltam ${nightsToNextMilestone} ${nightWord(nightsToNextMilestone)}!`;
        else text = spec.lockedText;

        return (
          <View
            key={spec.milestone}
            style={[styles.card, !achieved ? styles.locked : null]}
            accessibilityLabel={`Marco de ${spec.label}: ${text}`}
          >
            <View style={styles.iconBox}>
              <spec.Icon achieved={achieved} />
            </View>
            <AppText style={styles.label} color={colors.white}>
              {spec.label}
            </AppText>
            <AppText style={styles.desc} color={colors.purple200}>
              {text}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  locked: {
    opacity: 0.55,
  },
  iconBox: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 12.5,
    marginTop: 3,
  },
  desc: {
    fontFamily: fonts.interMedium,
    fontSize: 10,
    lineHeight: 13.5,
    textAlign: 'center',
    marginTop: 2,
  },
});
