// Modo férias/pausa — PERSISTÊNCIA LOCAL (AsyncStorage) no MVP.
// Não existe tabela de pausa no servidor ainda; se a família trocar de
// aparelho, o histórico de nuvens não migra (aceito no piloto; v2 leva ao
// Supabase junto com a "pausa clínica" do painel).
//
// Modelo:
// - 'reminders:paused:<childId>'        -> 'true' | 'false' (pausa de férias ATIVA?)
// - 'reminders:paused-dates:<childId>'  -> JSON string[] de datas lógicas
//   'YYYY-MM-DD' que passaram em pausa (viram NUVEM no céu — computeSky).
//
// Quem registra cada dia pausado: chame markTodayPausedIfNeeded(childId) ao
// abrir a tela Hoje (e/ou no sync de lembretes). setChildPaused(true) já
// registra a data de hoje. Quem pausa também deve refletir nos lembretes via
// syncSchedulesForFamily({ remindersPaused: true }).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { localDateString } from '@/lib/date';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from './keys';

const pausedKey = (childId: string) => `reminders:paused:${childId}`;
const pausedDatesKey = (childId: string) => `reminders:paused-dates:${childId}`;

export interface PausedState {
  /** Pausa de férias ativa para o filho (booleano único, sem data de fim no MVP). */
  paused: boolean;
  /** Datas lógicas 'YYYY-MM-DD' que passaram em pausa (nuvens do céu). */
  pausedDates: string[];
}

/** Lê o estado de pausa direto do AsyncStorage (fora de componentes). */
export async function getPausedState(childId: string): Promise<PausedState> {
  const [pausedRaw, datesRaw] = await Promise.all([
    AsyncStorage.getItem(pausedKey(childId)),
    AsyncStorage.getItem(pausedDatesKey(childId)),
  ]);
  let pausedDates: string[] = [];
  try {
    pausedDates = datesRaw ? (JSON.parse(datesRaw) as string[]) : [];
  } catch {
    pausedDates = [];
  }
  return { paused: pausedRaw === 'true', pausedDates };
}

/**
 * Estado de pausa do filho como query (local; staleTime infinito — só muda
 * pelos helpers abaixo, que invalidam a key ['reminders','paused',childId]).
 */
export function usePausedDates(childId: string): UseQueryResult<PausedState> {
  return useQuery({
    queryKey: queryKeys.paused(childId),
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
  await AsyncStorage.setItem(pausedKey(childId), paused ? 'true' : 'false');
  if (paused) await appendPausedDate(childId, localDateString());
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
  const added = await appendPausedDate(childId, localDateString());
  if (added) void queryClient.invalidateQueries({ queryKey: queryKeys.paused(childId) });
}
