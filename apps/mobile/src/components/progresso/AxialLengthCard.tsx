// Card educativo fixo no topo da evolução: "O que é comprimento axial?".
// Expansível (toca para abrir/fechar), tom acolhedor e SEM alarme. Explica o
// conceito em linguagem de leigo e devolve a interpretação à médica (regra
// editorial ANVISA: o app explica conceitos, nunca classifica o resultado).
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EyeQuestionIcon } from './EyeQuestionIcon';
import { ChevronIcon } from '@/components/icons';
import { AppText, Card } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

export function AxialLengthCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? 'Recolher explicação sobre comprimento axial'
            : 'O que é comprimento axial? Toque para ler a explicação'
        }
        style={styles.headerRow}
      >
        <View style={styles.iconBox}>
          <EyeQuestionIcon size={20} color={colors.purple} />
        </View>
        <View style={styles.headText}>
          <AppText variant="cardTitle">O que é comprimento axial?</AppText>
          <AppText variant="small" color={colors.ink3}>
            Entenda essa medida em 1 minuto
          </AppText>
        </View>
        <ChevronIcon direction={expanded ? 'up' : 'down'} color={colors.ink3} size={20} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <AppText variant="body" color={colors.ink} style={styles.paragraph}>
            O comprimento axial é o tamanho do olho, medido em milímetros (mm). É a medida mais
            precisa do acompanhamento do controle da miopia.
          </AppText>
          <AppText variant="body" color={colors.ink} style={styles.paragraph}>
            O olho cresce junto com a criança, e o objetivo do tratamento é acompanhar esse
            crescimento ao longo das consultas.
          </AppText>
          <View style={styles.note}>
            <AppText variant="body" color={colors.purple900}>
              Quem avalia o que essas medidas significam é a Dra. Christiane, na consulta. O app
              apenas mostra os valores registrados por ela.
            </AppText>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headText: {
    flex: 1,
  },
  body: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  paragraph: {
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  note: {
    marginTop: spacing.xs,
    backgroundColor: colors.purple50,
    borderRadius: radii.cardSm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
