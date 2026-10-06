// Exclusão de conta in-app (exigência Apple + LGPD) com confirmação dupla:
// digitar EXCLUIR e confirmar no alerta. Chama a Edge Function delete-account e
// sai do aparelho; a Welcome mostra o aviso de conta excluída. Usado em Conta e
// privacidade e no consentimento (quem não autoriza também precisa poder excluir).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { AppText, Card } from '@/components/ui';
import { LAST_USER_KEY, signOutDoAparelho } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/stores/ui';
import { colors, radii, spacing } from '@/theme/tokens';

const CONFIRM_WORD = 'EXCLUIR';

export const AVISO_CONTA_EXCLUIDA =
  'Sua conta foi excluída. Seus dados de acesso e os registros de cuidado deste app foram apagados. As medições das consultas permanecem no prontuário da clínica.';

export function DeleteAccountCard() {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmMatches = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const runDeletion = async (): Promise<void> => {
    setDeleting(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('delete-account');
      if (fnError) throw fnError;
      useUiStore.setState({ welcomeNotice: AVISO_CONTA_EXCLUIDA });
      const userId = await AsyncStorage.getItem(LAST_USER_KEY).catch(() => null);
      // Conta apagada no servidor: sai deste aparelho e apaga os dados locais
      // (cache, lembretes, fila de check-ins), mesmo se o servidor não responder.
      // O guard redireciona à Welcome ao detectar a sessão nula.
      await signOutDoAparelho();
      // A pausa de férias sobrevive ao logout (chaves por usuário); conta excluída, não.
      if (userId) {
        try {
          const keys = await AsyncStorage.getAllKeys();
          await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(`pause:${userId}:`)));
        } catch {
          // Storage indisponível: a conta já foi excluída no servidor.
        }
      }
    } catch {
      setError(
        'Não foi possível concluir a exclusão agora. Verifique sua internet e tente de novo, ou fale com a clínica.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletion = (): void => {
    if (deleting || !confirmMatches) return;
    Alert.alert(
      'Excluir sua conta?',
      'Esta ação não pode ser desfeita. Sua conta de acesso e os registros de cuidado deste app serão apagados. As medições das consultas permanecem no prontuário da clínica (exigência do CFM).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: () => {
            void runDeletion();
          },
        },
      ]
    );
  };

  return (
    <Card style={styles.dangerCard}>
      <AppText variant="body" color={colors.ink} style={styles.dangerIntro}>
        Ao excluir, apagamos sua conta de acesso e os registros de cuidado feitos por você neste
        app.
      </AppText>
      <AppText variant="meta" color={colors.ink2} style={styles.dangerKeep}>
        O que permanece: as medições e a evolução das consultas pertencem ao prontuário da clínica
        e são mantidas por exigência do Conselho Federal de Medicina (CFM). A exclusão da conta não
        apaga o prontuário.
      </AppText>

      {error ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <AppText variant="meta" color={colors.ink}>
            {error}
          </AppText>
        </View>
      ) : null}

      <AuthTextField
        label={`Para confirmar, digite ${CONFIRM_WORD}`}
        value={confirmText}
        onChangeText={(text) => {
          setConfirmText(text);
          if (error) setError(null);
        }}
        placeholder={CONFIRM_WORD}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!deleting}
        containerStyle={styles.confirmField}
        accessibilityLabel={`Digite ${CONFIRM_WORD} para confirmar a exclusão`}
      />

      <Pressable
        onPress={confirmDeletion}
        disabled={!confirmMatches || deleting}
        accessibilityRole="button"
        accessibilityLabel="Excluir minha conta"
        accessibilityState={{ disabled: !confirmMatches || deleting }}
        style={({ pressed }) => [
          styles.deleteButton,
          !confirmMatches || deleting ? styles.deleteButtonDisabled : null,
          pressed && confirmMatches && !deleting ? styles.pressed : null,
        ]}
      >
        {deleting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <AppText variant="cardTitle" color={colors.white} style={styles.deleteLabel}>
            Excluir minha conta
          </AppText>
        )}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  dangerCard: {
    borderWidth: 1.5,
    borderColor: colors.coral,
  },
  dangerIntro: {
    marginBottom: spacing.sm,
  },
  dangerKeep: {
    marginBottom: spacing.md,
  },
  banner: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: radii.cardSm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  confirmField: {
    marginBottom: spacing.md,
  },
  deleteButton: {
    backgroundColor: colors.coral,
    borderRadius: radii.button,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteLabel: {
    fontSize: 15,
  },
});
