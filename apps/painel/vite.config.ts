import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // As VITE_* são embutidas no bundle: um build sem elas publicaria um painel
  // que não abre. loadEnv lê o .env e também as variáveis do host (CI, Vercel).
  if (command === 'build') {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error(
        '[painel] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env ou variáveis do host) antes do build.',
      );
    }
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
