// Lumi + balão de incentivo (mockup .lumi-row + .bubble): a coruja à esquerda,
// balão branco (cantos 16/16/16/4) com uma frase contextual de ADESÃO e a
// assinatura "Lumi, a coruja que enxerga no escuro".
// REGRA DURA: a frase NUNCA contém número clínico nem resultado de consulta —
// só celebra o cuidado/noites (ANVISA). Amarelo só nas estrelas, não aqui.
import { StyleSheet, View } from 'react-native';

import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme/tokens';

export interface LumiBubbleProps {
  childName: string;
  totalNights: number;
  nextMilestone: 7 | 30 | 90 | null;
  nightsToNextMilestone: number;
}

const MILESTONE_NAME: Record<7 | 30 | 90, string> = {
  7: 'primeira constelação',
  30: 'Constelação da Coruja',
  90: 'Diploma do Cuidado',
};

function nightWord(n: number): string {
  return n === 1 ? 'noite' : 'noites';
}

// Frase contextual SEM número clínico. Usa noites de cuidado e o próximo marco.
function incentive(props: LumiBubbleProps): string {
  const { childName, totalNights, nextMilestone, nightsToNextMilestone } = props;
  if (totalNights === 0) {
    return `Vamos acender a primeira estrela de ${childName} esta noite?`;
  }
  if (nextMilestone === null) {
    return `Céu completo! ${childName} cuidou da visão por 90 noites. Que orgulho.`;
  }
  if (nightsToNextMilestone <= 3) {
    return `Faltam só ${nightsToNextMilestone} ${nightWord(nightsToNextMilestone)} para a ${MILESTONE_NAME[nextMilestone]}!`;
  }
  return `Cada noite de cuidado acende uma estrela. Continue assim, ${childName}!`;
}

export function LumiBubble(props: LumiBubbleProps) {
  const text = incentive(props);
  return (
    <View style={styles.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <LumiOwl size={92} />
      </View>
      <View style={styles.bubble}>
        <AppText style={styles.text} color={colors.purple900}>
          {text}
        </AppText>
        <AppText style={styles.sign} color={colors.ink2}>
          Lumi, a coruja que enxerga no escuro
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    shadowColor: '#0D0A24',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  text: {
    fontFamily: fonts.nunitoBold,
    fontSize: 13.5,
    lineHeight: 19,
  },
  sign: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
});
