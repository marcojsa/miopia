// Boas-vindas: tela de marca do Lumi. Céu noturno (gradiente 178deg do design
// system), Lumi grande, nome do app, proposta de valor em 1 linha (cuidado da
// rotina — sem promessa clínica) e assinatura da clínica.
// Não existe auto-cadastro: o acesso nasce por convite da clínica, então o
// único caminho daqui é "Entrar" -> /sign-in.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoonIcon, StarIcon } from '@/components/icons';
import { LumiOwl } from '@/components/lumi/LumiOwl';
import { AppText, Screen } from '@/components/ui';
import { colors, fonts, gradients, radii, spacing } from '@/theme/tokens';

// Estrelas decorativas do céu (douradas e prateadas, como no céu da criança).
interface SkyStarSpec {
  top: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  size: number;
  opacity: number;
  color: string;
}

const SKY_STARS: readonly SkyStarSpec[] = [
  { top: '8%', left: '12%', size: 13, opacity: 0.9, color: colors.star },
  { top: '6%', right: '36%', size: 9, opacity: 0.6, color: colors.silver },
  { top: '13%', right: '22%', size: 11, opacity: 0.8, color: colors.star },
  { top: '19%', left: '24%', size: 8, opacity: 0.45, color: colors.silver },
  { top: '23%', right: '11%', size: 12, opacity: 0.7, color: colors.star },
  { top: '29%', left: '9%', size: 9, opacity: 0.5, color: colors.star },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Screen background={colors.purple950} edges={[]}>
      <LinearGradient
        colors={[...gradients.skyBackground.colors]}
        locations={[...gradients.skyBackground.locations]}
        start={gradients.skyBackground.start}
        end={gradients.skyBackground.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Céu decorativo: invisível para leitores de tela. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.moon}>
          <MoonIcon size={34} color={colors.moon} />
        </View>
        {SKY_STARS.map((star, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              top: star.top,
              left: star.left,
              right: star.right,
              opacity: star.opacity,
            }}
          >
            <StarIcon size={star.size} variant="filled" color={star.color} />
          </View>
        ))}
      </View>

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <View style={styles.hero}>
          <LumiOwl size={150} accessibilityLabel="Lumi, a coruja que enxerga no escuro" />
          <AppText accessibilityRole="header" style={styles.appName}>
            Lumi
          </AppText>
          <AppText style={styles.tagline}>
            Cuidar da visão do seu filho, uma noite de cada vez.
          </AppText>
        </View>

        <View>
          <AppText style={styles.signature}>Oftalmologia Alto de Pinheiros</AppText>
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
            style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
          >
            <AppText style={styles.ctaLabel}>Entrar</AppText>
          </Pressable>
          <AppText style={styles.microcopy}>O acesso é criado pela clínica, por convite.</AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.headerX,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moon: {
    position: 'absolute',
    top: '7%',
    right: '13%',
    opacity: 0.95,
  },
  appName: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 44,
    lineHeight: 52,
    color: colors.white,
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
  tagline: {
    fontFamily: fonts.interMedium,
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.purple100,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: spacing.sm,
  },
  signature: {
    fontFamily: fonts.nunitoExtraBold,
    fontSize: 11.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.purple200,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  // CTA branco sobre o céu: o Button primário (#453A94) sumiria no pé do
  // gradiente, que termina exatamente em #453A94. Mesmas métricas do Button.
  cta: {
    backgroundColor: colors.white,
    borderRadius: radii.button,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    fontFamily: fonts.nunitoBlack,
    fontSize: 16,
    color: colors.purple800,
  },
  microcopy: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.purple200,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
