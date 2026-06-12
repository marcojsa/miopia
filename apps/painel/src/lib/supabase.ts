// Cliente Supabase do painel da clínica.
//
// Lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY de import.meta.env (embutidos
// no bundle pelo Vite). A autorização real é feita pelas policies de RLS no
// banco — a anon key só permite o que a RLS permite ao usuário autenticado.
//
// Tipado com o Database gerado (`npm run db:types`): o supabase-js infere
// linha/insert/update de cada .from('tabela') direto do schema real.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@miopia/shared';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Sem as envs o painel não conecta — falhar cedo e claro em dev.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. Copie .env.example para .env.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Painel roda em navegador desktop: persistir sessão e renovar token.
    persistSession: true,
    autoRefreshToken: true,
    // É um login por e-mail+senha, não um fluxo OAuth com hash na URL.
    detectSessionInUrl: false,
  },
});
