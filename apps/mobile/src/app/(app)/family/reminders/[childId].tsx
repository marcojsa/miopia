// Editar horários de lembrete por filho (atropina ~20h30; ortho-k colocar ~21h30 /
// retirar ~07h00). Grava em reminder_prefs (preferência do RESPONSÁVEL, separada da
// prescrição) e reconcilia via syncSchedulesForFamily().
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: time pickers + upsert em reminder_prefs + chamada ao scheduler.
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function RemindersScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();

  return (
    <View>
      <Text>Horários dos lembretes</Text>
      <Text>Filho: {childId}</Text>
      {/* Estrutura mínima: um seletor de horário por lembrete do regime ativo */}
    </View>
  );
}
