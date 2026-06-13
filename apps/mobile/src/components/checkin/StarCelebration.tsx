// Celebração de ADESÃO ao registrar a noite (nunca de resultado clínico — ANVISA
// RDC 657/2022): uma estrela dourada que "acende" com um pop curto + halo.
// Amarelo-estrela é EXCLUSIVO de estrelas/escudos/marcos (regra de cor). Sem
// nenhum número clínico aqui — apenas a estrela e uma frase de cuidado.
// Animação com Animated nativo do RN (Expo Go-safe; sem reanimated/libs extras).
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { StarIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

export interface StarCelebrationProps {
  /** Mensagem curta de cuidado abaixo da estrela (ex.: "Noite registrada!"). */
  message: string;
}

const STAR_SIZE = 92;

/** Estrela dourada acendendo: pop de escala + fade do halo. */
export function StarCelebration({ message }: StarCelebrationProps) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 480,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scale, opacity, halo]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <View
      style={styles.wrap}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityLabel={message}
    >
      <View style={styles.starWrap}>
        <Animated.View
          pointerEvents="none"
          style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
        />
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <StarIcon size={STAR_SIZE} variant="filled" />
        </Animated.View>
      </View>
      <AppText variant="cardTitle" color={colors.purple900} style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  starWrap: {
    width: STAR_SIZE * 2,
    height: STAR_SIZE * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: STAR_SIZE,
    height: STAR_SIZE,
    borderRadius: STAR_SIZE / 2,
    backgroundColor: colors.star,
  },
  message: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
