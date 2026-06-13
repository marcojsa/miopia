// Camada expansível de informação do consentimento (mockup .layer).
// Linguagem leiga, sem muro de texto: cada camada explica um aspecto do
// tratamento de dados (o que registramos / para que / quem vê / direitos).
// Toda a informação está disponível — expandir só organiza a leitura.
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

export interface ConsentLayerProps {
  /** Ícone à esquerda (ex.: <FolderIcon />). */
  icon: ReactNode;
  title: string;
  /** Texto explicativo em linguagem leiga. */
  body: string;
  /** Começa aberta? (a primeira camada abre como exemplo, igual ao mockup.) */
  defaultOpen?: boolean;
}

export function ConsentLayer({ icon, title, body, defaultOpen = false }: ConsentLayerProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.layer}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.head, pressed ? styles.pressed : null]}
      >
        <View style={styles.iconBox}>{icon}</View>
        <AppText variant="cardTitle" style={styles.title} numberOfLines={2}>
          {title}
        </AppText>
        <ChevronIcon direction={open ? 'down' : 'right'} color={colors.ink3} size={18} />
      </Pressable>
      {open ? (
        <AppText variant="body" color={colors.ink2} style={styles.body}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.cardSm,
    paddingHorizontal: 15,
    paddingVertical: 13,
    ...shadows.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
});
