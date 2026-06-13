// Confirmação suave pós-check-in do dia: "Noite registrada. Boa noite!" com uma
// estrela dourada. Celebra ADESÃO (a noite de cuidado), nunca resultado clínico
// — nenhum número clínico aqui (regra dura do produto).
import { StyleSheet, View } from 'react-native';

import { StarIcon } from '@/components/icons';
import { AppText, Card } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

export interface NightDoneCardProps {
  childName: string;
}

export function NightDoneCard({ childName }: NightDoneCardProps) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.starBox}>
          <StarIcon size={26} variant="filled" />
        </View>
        <View style={styles.text}>
          <AppText variant="cardTitle">Noite registrada. Boa noite!</AppText>
          <AppText variant="meta" style={styles.sub}>
            Tudo certo com os cuidados de {childName} hoje. A estrela desta noite está acesa.
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  starBox: {
    width: 44,
    height: 44,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  sub: {
    marginTop: 2,
  },
});
