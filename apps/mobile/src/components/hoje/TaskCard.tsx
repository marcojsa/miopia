// Card de check-in de 1 toque (mockup hoje.html Versão A .task):
// ícone (gota/lente), título, instrução curta, badge de horário e os botões
// "Feito" (verde, USO EXCLUSIVO) e "Não foi possível" (fantasma). Espelha as
// ações da notificação. Sem dado clínico — adesão é relato da família (ANVISA).
import { StyleSheet, View } from 'react-native';

import { CheckIcon, DropIcon, LensIcon } from '@/components/icons';
import { AppText, Button, Card, Pill } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';
import type { TreatmentType } from '@/types/domain';

export interface TaskCardProps {
  type: TreatmentType;
  title: string;
  instruction: string;
  /** Horário formatado (ex.: "20h30") ou null se sem horário sugerido. */
  time: string | null;
  /** true enquanto o check-in deste tratamento está sincronizando. */
  busy?: boolean;
  onDone: () => void;
  onSkip: () => void;
}

function TaskIcon({ type }: { type: TreatmentType }) {
  if (type === 'ortho_k') return <LensIcon size={22} color={colors.purple} />;
  return <DropIcon size={22} color={colors.purple} />;
}

export function TaskCard({ type, title, instruction, time, busy = false, onDone, onSkip }: TaskCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.iconBox}>
          <TaskIcon type={type} />
        </View>
        <View style={styles.text}>
          <AppText variant="cardTitle" numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="meta" style={styles.instruction} numberOfLines={2}>
            {instruction}
          </AppText>
        </View>
        {time ? <Pill label={time} style={styles.timePill} textStyle={styles.timeText} /> : null}
      </View>

      <View style={styles.buttons}>
        <Button
          label="Feito"
          variant="done"
          icon={<CheckIcon size={17} color={colors.white} />}
          loading={busy}
          onPress={onDone}
          style={styles.doneBtn}
          accessibilityLabel={`Marcar ${title} como feito`}
        />
        <Button
          label="Não foi possível"
          variant="ghost"
          disabled={busy}
          onPress={onSkip}
          style={styles.skipBtn}
          accessibilityLabel={`Registrar que não foi possível: ${title}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  instruction: {
    marginTop: 1,
  },
  timePill: {
    backgroundColor: colors.purple50,
  },
  timeText: {
    color: colors.purple,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  doneBtn: {
    flex: 1.25,
  },
  skipBtn: {
    flex: 1,
  },
});
