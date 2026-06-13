// AUTORIZAÇÃO ESPECÍFICA DE DADOS DE SAÚDE (LGPD art. 14 §1º) — mockup .health.
// Juridicamente crítico: o consentimento de dado sensível de criança precisa ser
// ESPECÍFICO e EM DESTAQUE, separado do aceite genérico de termos. Por isso este
// card tem borda 2px verde (#88B04B), tag verde própria e sombra verde — o único
// uso de verde no app além do botão Feito. Não é semáforo clínico.
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme/tokens';

import { ConsentCheckbox } from './ConsentCheckbox';
import { HeartShieldIcon } from './ConsentIcons';

export interface HealthConsentCardProps {
  /** Primeiro nome da criança, para personalizar a autorização. */
  childFirstName: string;
  checked: boolean;
  onToggle: () => void;
}

export function HealthConsentCard({ childFirstName, checked, onToggle }: HealthConsentCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.tag}>
        <HeartShieldIcon size={15} color={colors.white} />
        <AppText variant="small" color={colors.white} style={styles.tagText}>
          Autorização específica · dados de saúde
        </AppText>
      </View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`Autorizo, como responsável legal, o tratamento dos dados de saúde de ${childFirstName} para o acompanhamento do controle da miopia`}
        style={({ pressed }) => [styles.inner, pressed ? styles.pressed : null]}
      >
        <ConsentCheckbox checked={checked} tone="green" />
        <View style={styles.textWrap}>
          <AppText variant="body" color={colors.ink} style={styles.text}>
            <AppText variant="body" color={colors.purple900} style={styles.strong}>
              Autorizo, como responsável legal, o tratamento dos dados de saúde de {childFirstName}
            </AppText>{' '}
            para o acompanhamento do controle da miopia, conforme descrito acima.
          </AppText>
          <AppText variant="meta" color={colors.ink2} style={styles.who}>
            Esta autorização é separada dos termos gerais e pode ser revogada a qualquer momento em
            Mais › Privacidade.
          </AppText>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: 18,
    overflow: 'hidden',
    // Sombra verde própria (mockup: 0 8px 22px rgba(136,176,75,.18)).
    shadowColor: colors.green,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.green,
    paddingHorizontal: 15,
    paddingVertical: 7,
  },
  tagText: {
    fontFamily: fonts.nunitoExtraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 15,
  },
  pressed: {
    opacity: 0.7,
  },
  textWrap: {
    flex: 1,
  },
  text: {
    fontSize: 13,
    lineHeight: 20,
  },
  strong: {
    fontSize: 13,
    fontFamily: fonts.interBold,
    color: colors.purple900,
  },
  who: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 6,
  },
});
