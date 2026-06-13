// Avatar da criança: SEM foto por design (LGPD/minimização) — inicial do nome
// sobre cor derivada de forma ESTÁVEL do avatar_key/id (mesma criança, mesma
// cor em qualquer tela/aparelho). Paletas dos mockups: roxa e azul.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts } from '@/theme/tokens';

interface AvatarPalette {
  background: string;
  foreground: string;
}

// hoje.html: .av.a (Alice, roxa) e .av.p (Pedro, azul).
const PALETTES: readonly AvatarPalette[] = [
  { background: '#C9C2EE', foreground: '#2A2350' }, // roxa
  { background: '#A8C8DE', foreground: '#1F3A4D' }, // azul
];

/** Hash determinístico simples (djb2) — estável entre sessões e aparelhos. */
function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return h >>> 0;
}

export interface ChildAvatarProps {
  /** Nome da criança (fonte da inicial e do accessibilityLabel). */
  firstName: string;
  /** Semente estável da cor: use child.avatar_key ?? child.id. */
  seed: string;
  /** Diâmetro em px; padrão 28 (chip do header da Hoje). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function ChildAvatar({ firstName, seed, size = 28, style }: ChildAvatarProps) {
  const palette = PALETTES[hashSeed(seed) % PALETTES.length];
  const initial = firstName.trim().charAt(0).toUpperCase();

  return (
    <View
      accessible
      accessibilityLabel={`Avatar de ${firstName}`}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.background,
        },
        style,
      ]}
    >
      <Text style={[styles.initial, { color: palette.foreground, fontSize: size * 0.46 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fonts.nunitoBlack,
  },
});
