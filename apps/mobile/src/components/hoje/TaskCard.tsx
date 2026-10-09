// Card de check-in de 1 toque (mockup hoje.html Versão A .task):
// ícone (gota/lente), título, instrução curta, badge de horário e os botões
// "Feito" (verde, USO EXCLUSIVO) e "Não foi possível" (fantasma). Espelha as
// ações da notificação. "Não foi possível" pede confirmação (2º toque) e abre um
// motivo opcional, como o CheckinSheet. Sem dado clínico — adesão é relato da
// família (ANVISA).
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { CheckIcon, DropIcon, LensIcon } from '@/components/icons';
import { AppText, Button, Card, Pill } from '@/components/ui';
import { colors, fonts, radii, spacing } from '@/theme/tokens';
import type { AdherenceStatus, TreatmentType } from '@/types/domain';

export interface TaskCardProps {
  type: TreatmentType;
  title: string;
  /** Linha da dose (ex.: "2ª de 4 · 11h40"), nos tratamentos de várias doses. */
  subtitle?: string | null;
  instruction: string;
  /** Horário formatado (ex.: "20h30") ou null se sem horário sugerido. */
  time: string | null;
  /** Dose nos tratamentos de várias doses (ex.: "2ª de 4"), para o leitor de tela. */
  doseText?: string | null;
  /** Resposta já registrada desta dose (ao corrigir a noite), ou null. */
  currentStatus?: AdherenceStatus | null;
  /** true enquanto o check-in deste tratamento está sincronizando. */
  busy?: boolean;
  onDone: () => void;
  /** Chamado só no 2º toque (confirmação), com o motivo opcional. */
  onSkip: (note: string | null) => void;
}

function TaskIcon({ type }: { type: TreatmentType }) {
  if (type === 'ortho_k' || type === 'lente_contato') {
    return <LensIcon size={22} color={colors.purple} />;
  }
  return <DropIcon size={22} color={colors.purple} />;
}

export function TaskCard({
  type,
  title,
  subtitle = null,
  instruction,
  time,
  doseText = null,
  currentStatus = null,
  busy = false,
  onDone,
  onSkip,
}: TaskCardProps) {
  const [skipping, setSkipping] = useState(false);
  const [note, setNote] = useState('');
  const noteRef = useRef<TextInput>(null);

  const handleSkipPress = (): void => {
    if (!skipping) {
      setSkipping(true);
      requestAnimationFrame(() => noteRef.current?.focus());
      return;
    }
    const trimmed = note.trim();
    onSkip(trimmed.length > 0 ? trimmed : null);
    setSkipping(false);
    setNote('');
  };

  const a11yName = doseText ? `${title}, ${doseText}` : title;

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
          {subtitle ? (
            <AppText variant="meta" color={colors.purple} style={styles.instruction}>
              {subtitle}
            </AppText>
          ) : null}
          <AppText variant="meta" style={styles.instruction} numberOfLines={2}>
            {instruction}
          </AppText>
        </View>
        {time ? <Pill label={time} style={styles.timePill} textStyle={styles.timeText} /> : null}
      </View>

      {currentStatus ? (
        <Pill
          label={currentStatus === 'feito' ? 'Resposta atual: Feito' : 'Resposta atual: Não foi possível'}
          color={colors.ink}
          backgroundColor={colors.surface}
          style={styles.statusPill}
        />
      ) : null}

      {skipping ? (
        <TextInput
          ref={noteRef}
          value={note}
          onChangeText={setNote}
          placeholder="Quer anotar o motivo? (opcional)"
          placeholderTextColor={colors.ink3}
          style={styles.noteInput}
          multiline
          maxLength={240}
          editable={!busy}
          accessibilityLabel="Motivo (opcional)"
        />
      ) : null}

      <View style={styles.buttons}>
        <Button
          label="Feito"
          variant="done"
          icon={<CheckIcon size={17} color={colors.white} />}
          loading={busy}
          onPress={onDone}
          style={styles.doneBtn}
          accessibilityLabel={`Marcar ${doseText ? `${a11yName},` : a11yName} como feito`}
        />
        <Button
          label={skipping ? 'Confirmar' : 'Não foi possível'}
          variant="ghost"
          disabled={busy}
          onPress={handleSkipPress}
          style={styles.skipBtn}
          accessibilityLabel={
            skipping
              ? `Confirmar que não foi possível: ${a11yName}`
              : `Registrar que não foi possível: ${a11yName}`
          }
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
  statusPill: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteInput: {
    minHeight: 56,
    borderRadius: radii.cardSm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fonts.interMedium,
    fontSize: 13.5,
    lineHeight: 19.5,
    color: colors.ink,
    textAlignVertical: 'top',
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
