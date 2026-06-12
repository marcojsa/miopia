// Login: conta pré-criada pela clínica (convite por e-mail + OTP/senha).
// Placeholder estrutural — TODO: visual pós-aprovação dos mockups.
// TODO: fluxo real de OTP via supabase.auth (depende do SMTP Resend — Fase 1).
import { Text, View } from 'react-native';

export default function SignInScreen() {
  return (
    <View>
      <Text>Entrar</Text>
      <Text>Use o e-mail em que você recebeu o convite da clínica.</Text>
      {/* Estrutura mínima: campo de e-mail + envio de código (OTP) entram com os mockups */}
    </View>
  );
}
