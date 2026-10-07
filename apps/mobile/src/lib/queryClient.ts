// TanStack Query com cache PERSISTIDO em AsyncStorage:
// medições mudam 2-3x/ano — dashboard abre instantâneo e offline (design-mobile §estado).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';

const HOUR = 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default conservador. Filhos, medições, tratamentos e adesão usam staleTime
      // curto no próprio hook: o que a clínica muda precisa chegar ao reabrir o app.
      staleTime: 12 * HOUR,
      gcTime: 7 * 24 * HOUR, // precisa ser >= maxAge do persister
      retry: 2,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'miopia.query-cache',
  throttleTime: 1000,
});

// Usado pelo PersistQueryClientProvider no _layout raiz.
export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 7 * 24 * HOUR,
  // Incrementar para invalidar todo o cache persistido em mudança de shape dos dados.
  buster: 'v1',
  // Pausa de férias (['reminders', ...]) já mora no AsyncStorage com chave por
  // usuário: persistir a query só deixaria ids de filhos para trás após o logout.
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      defaultShouldDehydrateQuery(query) && query.queryKey[0] !== 'reminders',
  },
};
