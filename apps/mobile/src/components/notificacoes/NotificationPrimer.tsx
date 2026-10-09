// Primer de notificação (onboarding): explica por que os lembretes importam ANTES
// do pedido do sistema. No Android 13+ sem essa permissão nenhum lembrete aparece.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LumiOwl } from '@/components/lumi/LumiOwl';
import { Button, EmptyState, Screen } from '@/components/ui';
import { markPrimerSeen, requestNotificationPermission } from '@/lib/notifications/permission';
import { spacing } from '@/theme/tokens';

export interface NotificationPrimerProps {
  onDone: () => void;
}

export function NotificationPrimer({ onDone }: NotificationPrimerProps) {
  const [asking, setAsking] = useState(false);

  const finish = async (ask: boolean): Promise<void> => {
    if (asking) return;
    setAsking(true);
    try {
      if (ask) await requestNotificationPermission();
      await markPrimerSeen();
    } finally {
      setAsking(false);
      onDone();
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <EmptyState
          icon={<LumiOwl size={88} />}
          title="Ative os lembretes do cuidado"
          message="O Lumi avisa na hora do colírio ou da lente, e você marca Feito direto na notificação. Sem a sua permissão, o aparelho não mostra nenhum lembrete."
        />
        <Button
          label="Ativar lembretes"
          loading={asking}
          onPress={() => {
            void finish(true);
          }}
          style={styles.button}
        />
        <Button
          label="Agora não"
          variant="ghost"
          onPress={() => {
            void finish(false);
          }}
          style={styles.secondary}
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
  secondary: {
    marginTop: spacing.sm,
  },
});
