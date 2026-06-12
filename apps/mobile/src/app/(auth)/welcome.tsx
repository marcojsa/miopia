// Boas-vindas: marca da clínica + proposta de valor. Placeholder estrutural.
// TODO: visual pós-aprovação dos mockups.
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View>
      <Text>Bem-vindo</Text>
      <Text>Acompanhe o tratamento de controle da miopia do seu filho.</Text>
      {/* Estrutura mínima: acesso é por convite da clínica (sem auto-cadastro) */}
      <Link href="/(auth)/sign-in">
        <Text>Já recebi meu convite — entrar</Text>
      </Link>
    </View>
  );
}
