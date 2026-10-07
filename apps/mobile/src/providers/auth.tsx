// Sessão Supabase via contexto: hidrata do AsyncStorage e acompanha
// onAuthStateChange. Consumido pelo guard de auth em (app)/_layout.
//
// OFFLINE: a sessão gravada é lida direto do storage, sem esperar rede. Se o token
// venceu e a renovação falha por rede, o supabase-js devolve sessão nula mas MANTÉM
// a gravada; nesse caso seguimos com ela (o cache abre offline) e o auto-refresh
// emite TOKEN_REFRESHED quando a rede voltar. Só SIGNED_OUT (ou storage vazio)
// derruba a sessão.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { LAST_USER_KEY, authStorageKey, clearLocalUserData } from '../lib/session';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  /** true enquanto a sessão persistida ainda não foi lida do AsyncStorage. */
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, isLoading: true });

async function readStoredSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(authStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    return parsed?.access_token && parsed.user ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Sessão derrubada pelo servidor antes de o provider escutar (cold start com refresh
 * token revogado): o supabase-js apaga a sessão gravada sem emitir SIGNED_OUT para
 * nós. Sem sessão no storage e com um usuário anterior no aparelho, limpa os dados.
 * Offline o storage ainda tem a sessão, então nada é apagado.
 */
async function clearIfSignedOutElsewhere(): Promise<void> {
  try {
    if (!(await AsyncStorage.getItem(LAST_USER_KEY))) return;
    if (await readStoredSession()) return;
    await clearLocalUserData();
  } catch {
    // Storage indisponível: segue sem a limpeza.
  }
}

/** Troca de conta no aparelho (inclusive após um logout que falhou): limpa os dados locais. */
async function guardAccountSwitch(userId: string): Promise<void> {
  try {
    const last = await AsyncStorage.getItem(LAST_USER_KEY);
    if (last === userId) return;
    if (last) await clearLocalUserData();
    await AsyncStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // Storage indisponível: segue sem a checagem.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Incrementa a cada SIGNED_OUT: leituras iniciadas antes dele não ressuscitam a sessão.
    let generation = 0;

    const adopt = async (next: Session | null, gen: number): Promise<void> => {
      if (next) await guardAccountSwitch(next.user.id);
      if (!mounted || gen !== generation) return;
      setSession(next);
      setIsLoading(false);
    };

    // Nula do supabase-js com a sessão ainda gravada = renovação falhou por rede.
    let clientAnswered = false;
    const adoptOrKeepStored = async (next: Session | null): Promise<void> => {
      clientAnswered = true;
      const gen = generation;
      const resolved = next ?? (await readStoredSession());
      if (!resolved) await clearIfSignedOutElsewhere();
      await adopt(resolved, gen);
    };

    const initialGen = generation;
    void readStoredSession().then((stored) => {
      if (stored && !clientAnswered) void adopt(stored, initialGen);
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => adoptOrKeepStored(data.session))
      .catch(() => adoptOrKeepStored(null));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        generation += 1;
        setSession(null);
        setIsLoading(false);
        // Sessão encerrada aqui ou derrubada pelo servidor: nada da família fica no aparelho.
        void clearLocalUserData();
        return;
      }
      void adoptOrKeepStored(newSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ session, isLoading }}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  return useContext(AuthContext);
}
