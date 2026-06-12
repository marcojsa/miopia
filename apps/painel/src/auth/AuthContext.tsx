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

import { supabase } from '@/lib/supabase';
import type { Staff } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  /** Perfil de staff do usuário logado, ou null se não for staff ativo. */
  staff: Staff | null;
  /** true enquanto a sessão e o perfil de staff ainda estão sendo resolvidos. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve a linha de staff do usuário. Retorna null se não houver
  // (não-staff ou inativo) — o guard usa isso para bloquear.
  const resolveStaff = useCallback(async (userId: string): Promise<Staff | null> => {
    const { data, error } = await supabase
      .from('staff')
      .select('user_id, role, display_name, active, created_at')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] falha ao resolver staff:', error.message);
      return null;
    }
    return (data as Staff | null) ?? null;
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        setStaff(await resolveStaff(data.session.user.id));
      }
      if (mounted) setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession) {
          setStaff(await resolveStaff(newSession.user.id));
        } else {
          setStaff(null);
        }
        if (mounted) setIsLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [resolveStaff]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    // O onAuthStateChange dispara em seguida e resolve a sessão + staff.
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setStaff(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, staff, isLoading, signIn, signOut }),
    [session, staff, isLoading, signIn, signOut],
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
