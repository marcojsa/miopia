// ABA PROGRESSO: seletor de filho (gráficos são individuais).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: listar filhos da família (children não-arquivados) e navegar para [childId].
import { Text, View } from 'react-native';

export default function ProgressIndexScreen() {
  return (
    <View>
      <Text>Progresso</Text>
      {/* Estrutura mínima: lista de filhos -> /progress/[childId] */}
      <Text>Selecione um filho para ver a evolução.</Text>
    </View>
  );
}
