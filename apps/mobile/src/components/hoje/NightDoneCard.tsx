// Confirmação suave pós-check-in do dia. Noite completa: "Noite registrada. Boa
// noite!" com uma estrela dourada. Noite com "não foi possível": registro neutro,
// sem estrela (a estrela só acende em noite de cuidado feito). Celebra ADESÃO,
// nunca resultado clínico — nenhum número clínico aqui (regra dura do produto).
import { StyleSheet, View } from 'react-native';

import { MoonIcon, StarIcon } from '@/components/icons';
import { AppText, Button, Card } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

export interface NightDoneCardProps {
  childName: string;
  /** 'feito' = todos os cuidados feitos; 'pulado' = algum "não foi possível". */
  variant?: 'feito' | 'pulado';
  /** Reabre os cuidados da noite para corrigir a resposta. */
  onChangeAnswer?: () => void;
}

export function NightDoneCard({ childName, variant = 'feito', onChangeAnswer }: NightDoneCardProps) {
  const done = variant === 'feito';
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.starBox}>
          {done ? <StarIcon size={26} variant="filled" /> : <MoonIcon size={24} />}
        </View>
        <View style={styles.text}>
          <AppText variant="cardTitle">
            {done ? 'Noite registrada. Boa noite!' : 'Registrado: hoje não foi possível.'}
          </AppText>
          <AppText variant="meta" style={styles.sub}>
            {done
              ? `Tudo certo com os cuidados de ${childName} hoje. A estrela desta noite está acesa.`
              : 'Tudo bem. Amanhã é um novo dia.'}
          </AppText>
        </View>
      </View>
      {onChangeAnswer ? (
        <Button
          label="Mudar resposta"
          variant="ghost"
          onPress={onChangeAnswer}
          accessibilityLabel={`Mudar a resposta da noite de ${childName}`}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
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
