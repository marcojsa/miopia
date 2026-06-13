// Aceite genérico de Termos de Uso + Política de Privacidade (mockup .consent).
// Checkbox roxo. SEPARADO do aceite de dados de saúde por exigência legal
// (LGPD art. 14 §1º: o consentimento de dado sensível é específico e destacado).
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

import { ConsentCheckbox } from './ConsentCheckbox';

export interface TermsConsentRowProps {
  checked: boolean;
  onToggle: () => void;
}

export function TermsConsentRow({ checked, onToggle }: TermsConsentRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="Li e aceito os Termos de Uso e a Política de Privacidade do Lumi"
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <ConsentCheckbox checked={checked} tone="purple" />
      <View style={styles.textWrap}>
        <AppText variant="body" color={colors.ink} style={styles.text}>
          Li e aceito os{' '}
          <AppText variant="body" color={colors.purple} style={styles.link}>
            Termos de Uso
          </AppText>{' '}
          e a{' '}
          <AppText variant="body" color={colors.purple} style={styles.link}>
            Política de Privacidade
          </AppText>{' '}
          do Lumi.
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.cardSm,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  textWrap: {
    flex: 1,
  },
  text: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  link: {
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
});
