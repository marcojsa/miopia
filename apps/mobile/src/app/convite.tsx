// Deep link do convite da clínica (miopia://convite#access_token=...&type=invite).
import { SetPasswordScreen } from '@/components/auth/SetPasswordScreen';

export default function ConviteScreen() {
  return <SetPasswordScreen mode="convite" />;
}
