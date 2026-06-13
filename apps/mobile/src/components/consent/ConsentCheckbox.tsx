// Quadradinho de checkbox do consentimento (mockup .box).
// Duas tintas: 'purple' (aceite genérico de Termos) e 'green' (aceite ESPECÍFICO
// de dados de saúde — LGPD art. 14 §1º). O verde #88B04B é o único verde do app
// (botão Feito + este checkbox), por isso o tom é exclusivo desta confirmação.
import { StyleSheet, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { colors } from '@/theme/tokens';

export type ConsentCheckboxTone = 'purple' | 'green';

export interface ConsentCheckboxProps {
  checked: boolean;
  tone?: ConsentCheckboxTone;
}

export function ConsentCheckbox({ checked, tone = 'purple' }: ConsentCheckboxProps) {
  const accent = tone === 'green' ? colors.green : colors.purple;
  return (
    <View
      style={[
        styles.box,
        { borderColor: checked ? accent : tone === 'green' ? colors.green : colors.purple200 },
        checked ? { backgroundColor: accent } : null,
      ]}
    >
      {checked ? <CheckIcon size={15} color={colors.white} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
