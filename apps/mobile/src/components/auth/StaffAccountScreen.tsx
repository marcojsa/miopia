// Conta da equipe da clínica entrou no app do responsável: o app não serve a ela
// (veria as crianças de todas as famílias e cairia no consentimento LGPD como se
// fosse responsável legal). Avisa e oferece sair.
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LumiOwl } from '@/components/lumi/LumiOwl';
import { Button, EmptyState, Screen } from '@/components/ui';
import { signOutDoAparelho } from '@/lib/session';
import { spacing } from '@/theme/tokens';

export function StaffAccountScreen() {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutDoAparelho();
    } catch {
      Alert.alert('Não foi possível sair agora', 'Tente novamente em instantes.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <EmptyState
          icon={<LumiOwl size={88} />}
          title="Esta conta é da equipe da clínica"
          message="Este app é para os responsáveis acompanharem o cuidado dos filhos. Para ver e cadastrar pacientes, use o painel da clínica."
        />
        <Button
          label="Sair desta conta"
          variant="ghost"
          loading={signingOut}
          onPress={() => {
            void handleSignOut();
          }}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  button: {
    marginTop: spacing.lg,
  },
});
