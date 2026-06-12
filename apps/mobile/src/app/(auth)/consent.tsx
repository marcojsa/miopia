// Consentimento LGPD (art. 14 §1º): específico, EM DESTAQUE, bloqueante.
// Registra aceite por criança com timestamp + versão do termo (tabela consents).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: carregar consent_terms ativo, exibir texto integral e gravar aceite bloqueante.
import { Text, View } from 'react-native';

export default function ConsentScreen() {
  return (
    <View>
      <Text>Consentimento</Text>
      <Text>
        Para usar o app, precisamos do seu consentimento para tratar os dados de saúde do seu
        filho. O texto completo do termo aparecerá aqui.
      </Text>
      {/* Estrutura mínima: scroll do termo + aceite explícito por criança */}
    </View>
  );
}
