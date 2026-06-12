// Detalhe do filho: regime (atropina/ortho-k), horários e toggle "pausar lembretes"
// (férias/doença, com data de retorno opcional) — toda mudança passa por
// syncSchedulesForFamily() (reconciliação declarativa).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: query do tratamento ativo + toggle de pausa chamando o scheduler.
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function ChildDetailScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();

  return (
    <View>
      <Text>Filho</Text>
      <Text>Filho: {childId}</Text>
      {/* Estrutura mínima:
          - regime atual (tratamentos ativos)
          - toggle pausar lembretes (férias/doença)
          - link editar horários -> /family/reminders/[childId] */}
    </View>
  );
}
