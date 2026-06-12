// "Lembretes atrasando?" — troubleshooting de battery killers Android (Xiaomi/MIUI,
// Samsung, Oppo): abre as configurações de otimização de bateria + instruções por OEM.
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: Linking/expo-intent-launcher para abrir settings de bateria; instruções por fabricante.
import { Text, View } from 'react-native';

export default function NotificationsHelpScreen() {
  return (
    <View>
      <Text>Lembretes atrasando?</Text>
      <Text>
        Em alguns aparelhos Android, a economia de bateria pode atrasar ou silenciar os
        lembretes. Aqui você encontrará as instruções para o seu aparelho.
      </Text>
      {/* Estrutura mínima: botão "abrir configurações de bateria" + passos por OEM */}
    </View>
  );
}
