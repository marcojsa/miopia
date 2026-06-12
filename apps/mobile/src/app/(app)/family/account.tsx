// Conta: exportar dados e EXCLUIR CONTA in-app (exigência Apple + LGPD).
// Deleção executa a matriz APAGA/ANONIMIZA/RETÉM via Edge Function delete-account
// (medições pertencem ao prontuário da clínica — explícito no termo).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: chamada à Edge Function delete-account + confirmação destrutiva + logout.
import { Text, View } from 'react-native';

export default function AccountScreen() {
  return (
    <View>
      <Text>Conta</Text>
      {/* Estrutura mínima:
          - dados do responsável logado
          - exportar meus dados
          - excluir minha conta (fluxo bloqueante de confirmação) */}
    </View>
  );
}
