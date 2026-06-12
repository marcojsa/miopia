// Dashboard de evolução por filho: EE (D) e comprimento axial (mm) POR OLHO,
// cards "desde a última consulta" / "desde o início", histórico de consultas.
// ANVISA RDC 657/2022: o app SÓ EXIBE — tinta neutra, zero cores/setas/médias/percentis;
// a única interpretação é o campo `status` + `doctor_note` DIGITADOS pela médica.
// Abre OFFLINE (cache TanStack persistido).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: query de measurements por childId + gráfico neutro (toggle Grau | Comprimento do olho).
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function ChildProgressScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();

  return (
    <View>
      <Text>Evolução</Text>
      <Text>Filho: {childId}</Text>
      {/* Estrutura mínima:
          - cards por olho (EE e axial): desde a última consulta / desde o início
          - gráfico com toggle Grau | Comprimento do olho (tinta neutra)
          - card "Avaliação da Dra." (status + doctor_note, datado, CRM/RQE)
          - bottom sheet explicando comprimento axial para leigo */}
    </View>
  );
}
