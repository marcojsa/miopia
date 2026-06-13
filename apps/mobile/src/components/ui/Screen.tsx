// Container de tela: SafeAreaView + fundo claro padrão (#F5FAFD).
// Telas com header em gradiente (Hoje) ou fundo céu devem passar edges={[]}
// (ou só ['left','right']) e tratar o topo dentro do próprio gradiente.
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Cor de fundo; padrão colors.surface (#F5FAFD). */
  background?: string;
  /** Bordas com inset seguro; padrão ['top','left','right'] (tab bar cuida do bottom). */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right'];

export function Screen({ children, background = colors.surface, edges = DEFAULT_EDGES, style }: ScreenProps) {
  return (
    <SafeAreaView edges={[...edges]} style={[styles.root, { backgroundColor: background }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
