// Modo férias/pausa — PERSISTÊNCIA LOCAL (AsyncStorage) no MVP.
// Não existe tabela de pausa no servidor ainda; se a família trocar de
// aparelho, o histórico de nuvens não migra (aceito no piloto; v2 leva ao
// Supabase junto com a "pausa clínica" do painel).
//
// Modelo:
// - 'reminders:paused:<childId>'        -> 'true' | 'false' (pausa de férias ATIVA?)
// - 'reminders:paused-dates:<childId>'  -> JSON string[] de datas lógicas
//   'YYYY-MM-DD' que passaram em pausa (viram NUVEM no céu — computeSky).
// - 'reminders:paused-since:<childId>'  -> data lógica em que a pausa ATIVA começou.
//
// Toda noite de [since, hoje] conta como pausada, mesmo que o app não seja
// aberto nas férias: getPausedState expande o intervalo e setChildPaused(false)
// grava o intervalo inteiro em paused-dates. Quem pausa também deve refletir
// nos lembretes via syncSchedulesForFamily({ remindersPaused: true }).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { localDateString } from '@/lib/date';
import { datesBetween } from '@/lib/gamification';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from './keys';

const pausedKey = (childId: string) => `reminders:paused:${childId}`;
const pausedDatesKey = (childId: string) => `reminders:paused-dates:${childId}`;
const pausedSinceKey = (childId: string) => `reminders:paused-since:${childId}`;

export interface PausedState {
  /** Pausa de férias ativa para o filho (booleano único, sem data de fim no MVP). */
  paused: boolean;
  /** Datas lógicas 'YYYY-MM-DD' que passaram em pausa (nuvens do céu). */
  pausedDates: string[];
}

/** Lê o estado de pausa direto do AsyncStorage (fora de componentes). */
export async function getPausedState(childId: string): Promise<PausedState> {
  const [pausedRaw, datesRaw, sinceRaw] = await Promise.all([
    AsyncStorage.getItem(pausedKey(childId)),
    AsyncStorage.getItem(pausedDatesKey(childId)),
    AsyncStorage.getItem(pausedSinceKey(childId)),
  ]);
  let pausedDates: string[] = [];
  try {
    pausedDates = datesRaw ? (JSON.parse(datesRaw) as string[]) : [];
  } catch {
    pausedDates = [];
  }
  const paused = pausedRaw === 'true';
  if (paused && sinceRaw) {
    pausedDates = withRange(pausedDates, sinceRaw, localDateString());
  }
  return { paused, pausedDates };
}

function withRange(dates: string[], since: string, until: string): string[] {
  const all = new Set(dates);
  for (const d of datesBetween(since, until)) all.add(d);
  return [...all].sort();
}

/**
 * Estado de pausa do filho como query (local; staleTime infinito — só muda
 * pelos helpers abaixo, que invalidam a key ['reminders','paused',childId]).
 */
export function usePausedDates(childId: string): UseQueryResult<PausedState> {
  return useQuery({
    // A data entra na key: pausa ativa ganha uma nuvem a cada noite que passa.
    queryKey: [...queryKeys.paused(childId), localDateString()],
    enabled: childId.length > 0,
    staleTime: Infinity,
    queryFn: () => getPausedState(childId),
  });
}

async function appendPausedDate(childId: string, date: string): Promise<boolean> {
  const { pausedDates } = await getPausedState(childId);
  if (pausedDates.includes(date)) return false;
  await AsyncStorage.setItem(pausedDatesKey(childId), JSON.stringify([...pausedDates, date]));
  return true;
}

/**
 * Liga/desliga a pausa de férias do filho. Ao LIGAR, já registra a data
 * lógica de hoje como pausada (a noite de hoje vira nuvem). Lembre de chamar
 * syncSchedulesForFamily() depois, com remindersPaused refletindo este valor.
 */
export async function setChildPaused(childId: string, paused: boolean): Promise<void> {
  const today = localDateString();
  if (paused) {
    const since = await AsyncStorage.getItem(pausedSinceKey(childId));
    if (!since) await AsyncStorage.setItem(pausedSinceKey(childId), today);
    await AsyncStorage.setItem(pausedKey(childId), 'true');
    await appendPausedDate(childId, today);
  } else {
    // Fecha a pausa: grava todas as noites de [since, hoje] antes de desligar.
    const { pausedDates } = await getPausedState(childId);
    await AsyncStorage.setItem(pausedDatesKey(childId), JSON.stringify(pausedDates));
    await AsyncStorage.setItem(pausedKey(childId), 'false');
    await AsyncStorage.removeItem(pausedSinceKey(childId));
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.paused(childId) });
}

/**
 * Se a pausa estiver ativa, registra a data lógica de HOJE como pausada
 * (idempotente). Chame ao abrir a tela Hoje para que cada noite que passa em
 * férias vire nuvem no céu.
 */
export async function markTodayPausedIfNeeded(childId: string): Promise<void> {
  const { paused } = await getPausedState(childId);
  if (!paused) return;
  const today = localDateString();
  // Pausa ligada antes de existir paused-since: o intervalo começa hoje.
  const since = await AsyncStorage.getItem(pausedSinceKey(childId));
  if (!since) await AsyncStorage.setItem(pausedSinceKey(childId), today);
  const added = await appendPausedDate(childId, today);
  if (added) void queryClient.invalidateQueries({ queryKey: queryKeys.paused(childId) });
}
