// Pill da criança no topo do consentimento (mockup .child-pill).
// Mostra de QUEM é o consentimento atual: avatar (inicial, sem foto — LGPD),
// nome e data de nascimento. O nome da criança fica gravado no registro de aceite.
import { StyleSheet, View } from 'react-native';

import { AppText, ChildAvatar } from '@/components/ui';
import { colors, fonts, radii, shadows } from '@/theme/tokens';
import type { Child } from '@/types/domain';

export interface ConsentChildPillProps {
  child: Child;
}

/** Formata 'YYYY-MM-DD' como 'DD/MM/YYYY' (sem Date, evita fuso). */
function formatBirthDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function ConsentChildPill({ child }: ConsentChildPillProps) {
  return (
    <View style={styles.pill}>
      <ChildAvatar firstName={child.first_name} seed={child.avatar_key ?? child.id} size={28} />
      <View style={styles.textWrap}>
        <AppText variant="meta" color={colors.purple900} style={styles.name} numberOfLines={1}>
          {child.first_name}
        </AppText>
        <AppText variant="small" color={colors.ink3} style={styles.birth}>
          Nascimento: {formatBirthDate(child.birth_date)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.purple100,
    borderRadius: radii.pill,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    ...shadows.card,
  },
  textWrap: {
    flexShrink: 1,
  },
  name: {
    fontFamily: fonts.nunitoExtraBold,
    fontSize: 13,
  },
  birth: {
    fontFamily: fonts.interMedium,
    fontSize: 11,
    marginTop: 1,
  },
});
