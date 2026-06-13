// Card escuro "O céu da [filho]" (mockup .ceu-card): porta de entrada para o
// Céu da criança. Lumi pequena + resumo de ADESÃO ("N noites de cuidado no
// total · M escudos guardados") + botão "Abrir o céu". Celebra adesão, nunca
// resultado clínico. Gradiente cardCeu + sombra cardDark (sobre fundo claro).
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText } from '@/components/ui';
import { colors, fonts, gradients, radii, shadows, spacing } from '@/theme/tokens';

export interface SkyTeaserCardProps {
  childName: string;
  totalNights: number;
  shieldsAvailable: number;
  onOpen: () => void;
}

function summaryLine(totalNights: number, shieldsAvailable: number): string {
  const nights = `${totalNights} ${totalNights === 1 ? 'noite' : 'noites'} de cuidado no total`;
  if (shieldsAvailable <= 0) return `${nights}. Mostre o céu para ele.`;
  const shields = `${shieldsAvailable} ${shieldsAvailable === 1 ? 'escudo guardado' : 'escudos guardados'}`;
  return `${nights} · ${shields}. Mostre o céu para ele.`;
}

export function SkyTeaserCard({ childName, totalNights, shieldsAvailable, onOpen }: SkyTeaserCardProps) {
  return (
    <LinearGradient
      colors={[...gradients.cardCeu.colors]}
      start={gradients.cardCeu.start}
      end={gradients.cardCeu.end}
      style={styles.card}
    >
      <View style={styles.text}>
        <AppText variant="cardTitle" color={colors.white}>
          O céu da {childName}
        </AppText>
        <AppText variant="meta" color={colors.purple200} style={styles.summary}>
          {summaryLine(totalNights, shieldsAvailable)}
        </AppText>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Abrir o céu de ${childName}`}
          style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
        >
          <AppText style={styles.buttonLabel} color={colors.white}>
            Abrir o céu
          </AppText>
        </Pressable>
      </View>

      <View
        style={styles.owl}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LumiOwl size={84} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 22,
    paddingVertical: spacing.lg,
    paddingHorizontal: 18,
    overflow: 'hidden',
    ...shadows.cardDark,
  },
  text: {
    flex: 1,
  },
  summary: {
    marginTop: 3,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radii.chip,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 13,
  },
  owl: {
    width: 84,
  },
});
