// Deep link da recuperação de senha (miopia://recuperar-senha#access_token=...&type=recovery).
import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen';

export default function RecuperarSenhaScreen() {
  return <SetPasswordScreen mode="recuperacao" />;
}
