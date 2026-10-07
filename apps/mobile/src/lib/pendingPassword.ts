// Convite aberto pelo link mas sem senha criada. Gravado no aparelho: fechar o
// app na tela "Crie sua senha" não pode deixar a pessoa entrar sem senha.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_PASSWORD_KEY = 'auth:pending-password';

/** Id da conta cuja sessão foi aberta pelo link do convite e ainda não criou a senha. */
export async function readPendingPassword(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_PASSWORD_KEY);
  } catch {
    return null;
  }
}

export async function markPendingPassword(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_PASSWORD_KEY, userId);
  } catch {
    // Storage indisponível: vale só a marca em memória da tela.
  }
}

export async function clearPendingPassword(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_PASSWORD_KEY);
  } catch {
    // Storage indisponível: nada gravado para apagar.
  }
}
