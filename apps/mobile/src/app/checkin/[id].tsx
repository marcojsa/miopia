// Sheet/modal de check-in rápido — destino do TAP NO CORPO da notificação
// (fallback dos botões) e de deep links. id = `${childId}:${tipo}` (parseNotifId).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: resolver treatmentId via cache (treatments do filho) e wirar botões
//       Feito/Pular em enqueueCheckin + flushOutbox (mesma rota do handler).
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { parseNotifId } from '@/lib/notifications/scheduler';

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsed = id ? parseNotifId(id) : null;

  if (!parsed) {
    return (
      <View>
        <Text>Check-in</Text>
        <Text>Lembrete não reconhecido.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>Check-in</Text>
      <Text>
        Filho: {parsed.childId} — lembrete: {parsed.type}
      </Text>
      {/* Estrutura mínima: botões Feito / Pular hoje gravando no outbox */}
    </View>
  );
}
