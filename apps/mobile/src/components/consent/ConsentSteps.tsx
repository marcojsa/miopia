// Indicador de passos do consentimento (mockup .steps).
// Um segmento por criança a autorizar: as já concluídas ficam roxo-claro
// preenchidas, a atual em roxo cheio, as futuras em traço claro. Dá ao
// responsável a noção de "quanto falta" quando há mais de um filho.
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

export interface ConsentStepsProps {
  /** Quantidade total de crianças a autorizar nesta sessão. */
  total: number;
  /** Índice (base 0) da criança atual. */
  current: number;
}

export function ConsentSteps({ total, current }: ConsentStepsProps) {
  // Pelo menos 1 segmento; evita barra vazia se chamado com total 0.
  const count = Math.max(total, 1);
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i < current ? styles.done : i === current ? styles.now : styles.todo,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  done: {
    backgroundColor: colors.purple400,
  },
  now: {
    backgroundColor: colors.purple,
  },
  todo: {
    backgroundColor: colors.purple100,
  },
});
