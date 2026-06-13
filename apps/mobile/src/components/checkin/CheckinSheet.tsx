// Sheet de check-in aberto pelo TAP no corpo da notificação (fallback de 1 toque
// a mais que os botões Feito/Pular da notificação). Espelha o TaskCard da Hoje:
// ícone do tipo, título, instrução da médica, "Feito" (verde, USO EXCLUSIVO) e
// "Não foi possível hoje" (fantasma). Ao escolher "Não foi possível", abre um
// campo curto opcional para o motivo (placeholder em pt-BR).
//
// REGRAS DURAS: nenhum dado clínico aqui — o check-in é RELATO de adesão da
// família, não medida (ANVISA RDC 657/2022). Verde só no botão Feito.
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { CheckIcon, DropIcon, LensIcon, SunriseIcon } from '@/components/icons';
import { AppText, Button, Card } from '@/components/ui';
import { colors, fonts, radii, spacing } from '@/theme/tokens';
import type { ReminderType } from '@/types/domain';

export interface CheckinSheetProps {
  /** Tipo do lembrete que abriu a sheet (decide ícone e copy). */
  type: ReminderType;
  /** Título por tipo (ex.: "Hora da gotinha da Alice"). */
  title: string;
  /** Instrução curta (prescrição da médica ou texto padrão por tipo). */
  instruction: string;
  /** true enquanto o check-in está sincronizando (bloqueia os botões). */
  busy?: boolean;
  /** Registra a noite como feita. */
  onDone: () => void;
  /** Registra que não foi possível (com motivo opcional). */
  onSkip: (note: string | null) => void;
}

function SheetIcon({ type }: { type: ReminderType }) {
  if (type === 'orthok_on') return <LensIcon size={26} color={colors.purple} />;
  if (type === 'orthok_off') return <SunriseIcon size={24} />;
  return <DropIcon size={26} color={colors.purple} />;
}

export function CheckinSheet({
  type,
  title,
  instruction,
  busy = false,
  onDone,
  onSkip,
}: CheckinSheetProps) {
  // Fluxo do "Não foi possível": 1º toque revela o campo de motivo; 2º confirma.
  const [skipping, setSkipping] = useState(false);
  const [note, setNote] = useState('');
  const noteRef = useRef<TextInput>(null);

  const handleSkipPress = (): void => {
    if (!skipping) {
      setSkipping(true);
      // foca o campo de motivo assim que ele aparece
      requestAnimationFrame(() => noteRef.current?.focus());
      return;
    }
    const trimmed = note.trim();
    onSkip(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <SheetIcon type={type} />
        </View>
        <View style={styles.headerText}>
          <AppText variant="cardTitle" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="meta" style={styles.instruction}>
            {instruction}
          </AppText>
        </View>
      </View>

      {skipping ? (
        <View style={styles.noteWrap}>
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
            returnKeyType="done"
            accessibilityLabel="Motivo (opcional)"
          />
        </View>
      ) : null}

      <View style={styles.buttons}>
        {skipping ? null : (
          <Button
            label="Feito"
            variant="done"
            icon={<CheckIcon size={17} color={colors.white} />}
            loading={busy}
            onPress={onDone}
            style={styles.done}
            accessibilityLabel={`Marcar como feito: ${title}`}
          />
        )}
        <Button
          label={skipping ? 'Confirmar' : 'Não foi possível hoje'}
          variant="ghost"
          loading={busy && skipping}
          disabled={busy && !skipping}
          onPress={handleSkipPress}
          style={styles.skip}
          accessibilityLabel={
            skipping ? 'Confirmar que não foi possível' : `Registrar que não foi possível: ${title}`
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radii.iconBox,
    backgroundColor: colors.purple100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  instruction: {
    marginTop: 2,
  },
  noteWrap: {
    gap: spacing.xs,
  },
  noteInput: {
    minHeight: 64,
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
    gap: spacing.sm,
  },
  done: {},
  skip: {},
});
