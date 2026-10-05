// Contexto de autenticação do painel.
//
// Responsabilidades:
//  - login staff por e-mail + senha (supabase.auth.signInWithPassword);
//  - hidratar a sessão persistida e acompanhar onAuthStateChange;
//  - resolver o perfil de STAFF do usuário logado (select em public.staff por
//    user_id, active = true). Quem não é staff fica sem perfil → o guard de
//    rota bloqueia. (A RLS no banco já barra o acesso aos dados; isto é a
//    primeira linha de defesa na UI.)
//  - logout.
//
// O callback de onAuthStateChange é síncrono e não chama o supabase: um await
// da lib ali dentro trava o initializePromise do auth-js (painel preso em
// "Carregando..."). O staff é resolvido num efeito à parte, por user.id.
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase';
import type { Staff } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  /** Perfil de staff do usuário logado, ou null se não for staff ativo. */
  staff: Staff | null;
  /** Falha de rede/servidor ao consultar o perfil (diferente de "não é staff"). */
  staffError: string | null;
  /** true enquanto a sessão e o perfil de staff ainda estão sendo resolvidos. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Nunca lança: sem resposta do servidor, encerra a sessão só neste navegador. */
  signOut: () => Promise<void>;
  retryStaff: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type StaffLookup = { staff: Staff | null; error: string | null };

async function resolveStaff(userId: string): Promise<StaffLookup> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('user_id, role, display_name, active, created_at')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] falha ao resolver staff:', error.message);
      return { staff: null, error: error.message };
    }
    return { staff: (data as Staff | null) ?? null, error: null };
  } catch (err) {
    return { staff: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setStaff(null);
      setStaffError(null);
      setResolvedFor(null);
      return;
    }
    let cancelled = false;
    void resolveStaff(userId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        // Mantém o perfil já resolvido deste usuário: uma oscilação de rede
        // não derruba a tela no meio do trabalho.
        setStaff((prev) => (prev?.user_id === userId ? prev : null));
        setStaffError(result.error);
      } else {
        setStaff(result.staff);
        setStaffError(null);
      }
      setResolvedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, retryTick]);

  const isLoading = !sessionReady || (userId !== null && resolvedFor !== userId);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    // O onAuthStateChange dispara em seguida e resolve a sessão + staff.
  }, []);

  const signOut = useCallback(async () => {
    let failed = false;
    try {
      const { error } = await supabase.auth.signOut();
      failed = !!error;
    } catch {
      failed = true;
    }
    if (failed) {
      // eslint-disable-next-line no-console
      console.warn('[auth] logout no servidor falhou; encerrando a sessão neste navegador.');
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // storage indisponível: o estado em memória abaixo já tira a usuária do painel
      }
    }
    setSession(null);
    setStaff(null);
    setStaffError(null);
  }, []);

  const retryStaff = useCallback(() => setRetryTick((n) => n + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, staff, staffError, isLoading, signIn, signOut, retryStaff }),
    [session, staff, staffError, isLoading, signIn, signOut, retryStaff],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return ctx;
}
