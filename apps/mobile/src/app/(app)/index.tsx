// ABA HOJE (home): check-ins pendentes do dia de TODOS os filhos + meta semanal
// ("5 de 7 noites" — display de adesão, sem interpretação clínica: ANVISA).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: hooks de features/today (tratamentos ativos + adherence_logs do dia lógico).
import { Text, View } from 'react-native';

export default function TodayScreen() {
  return (
    <View>
      <Text>Hoje</Text>
      {/* Estrutura mínima:
          - lista de cards de check-in por filho/tratamento (Feito | Pular hoje)
          - meta semanal por filho ("5 de 7 noites")
          - celebração dinâmica (texto fixo das notificações fica fora do app) */}
      <Text>Nenhum check-in carregado ainda.</Text>
    </View>
  );
}
