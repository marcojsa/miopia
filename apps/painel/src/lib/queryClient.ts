import { QueryClient } from '@tanstack/react-query';

// Painel desktop online: defaults conservadores, sem cache persistido
// (diferente do mobile, que persiste em AsyncStorage para abrir offline).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
