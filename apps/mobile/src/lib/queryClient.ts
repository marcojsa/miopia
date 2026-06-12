// TanStack Query com cache PERSISTIDO em AsyncStorage:
// medições mudam 2-3x/ano — dashboard abre instantâneo e offline (design-mobile §estado).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

const HOUR = 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default conservador (medições/status da médica). Regimes/horários usam
      // staleTime menor (1h) definido no próprio hook da feature.
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
};
