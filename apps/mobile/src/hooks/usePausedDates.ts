// Modo férias/pausa — PERSISTÊNCIA LOCAL (AsyncStorage) no MVP.
// Não existe tabela de pausa no servidor ainda; se a família trocar de
// aparelho, o histórico de nuvens não migra (aceito no piloto; v2 leva ao
// Supabase junto com a "pausa clínica" do painel).
//
// Modelo (chaves por usuário: sobrevivem ao sair e entrar de novo com a mesma
// conta, e outra conta no aparelho não as lê; o logout só cancela os lembretes):
// - 'pause:<userId>:paused:<childId>'        -> 'true' | 'false' (pausa de férias ATIVA?)
// - 'pause:<userId>:paused-dates:<childId>'  -> JSON string[] de datas lógicas
//   'YYYY-MM-DD' que passaram em pausa (viram NUVEM no céu — computeSky).
// - 'pause:<userId>:paused-since:<childId>'  -> data lógica em que a pausa ATIVA começou.
// As chaves antigas 'reminders:paused*:<childId>' são migradas na primeira leitura.
//
// Toda noite de [since, hoje] conta como pausada, mesmo que o app não seja
// aberto nas férias: getPausedState expande o intervalo e setChildPaused(false)
// grava o intervalo em paused-dates, menos a noite de hoje. Quem pausa também deve refletir
// nos lembretes via syncSchedulesForFamily({ remindersPaused: true }).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { localDateString } from '@/lib/date';
import { datesBetween } from '@/lib/gamification';
import { queryClient } from '@/lib/queryClient';
import { LAST_USER_KEY } from '@/lib/session';
import { queryKeys } from './keys';

interface PauseKeys {
  paused: string;
  dates: string;
  since: string;
}

const legacyKeys = (childId: string): PauseKeys => ({
  paused: `reminders:paused:${childId}`,
  dates: `reminders:paused-dates:${childId}`,
  since: `reminders:paused-since:${childId}`,
});

/** Chaves do usuário logado (gravado em LAST_USER_KEY pelo AuthProvider ao adotar a sessão). */
async function pauseKeys(childId: string): Promise<PauseKeys> {
  const userId = (await AsyncStorage.getItem(LAST_USER_KEY)) ?? 'anon';
  const keys: PauseKeys = {
    paused: `pause:${userId}:paused:${childId}`,
    dates: `pause:${userId}:paused-dates:${childId}`,
    since: `pause:${userId}:paused-since:${childId}`,
  };
  const legacy = legacyKeys(childId);
  const old = await AsyncStorage.multiGet([legacy.paused, legacy.dates, legacy.since]);
  if (old.some(([, v]) => v !== null)) {
    const [p, d, s] = old.map(([, v]) => v);
    const pairs: [string, string][] = [];
    if (p !== null && p !== undefined) pairs.push([keys.paused, p]);
    if (d !== null && d !== undefined) pairs.push([keys.dates, d]);
    if (s !== null && s !== undefined) pairs.push([keys.since, s]);
    await AsyncStorage.multiSet(pairs);
    await AsyncStorage.multiRemove([legacy.paused, legacy.dates, legacy.since]);
  }
  return keys;
}

export interface PausedState {
  /** Pausa de férias ativa para o filho (booleano único, sem data de fim no MVP). */
  paused: boolean;
  /** Datas lógicas 'YYYY-MM-DD' que passaram em pausa (nuvens do céu). */
  pausedDates: string[];
}

/** Lê o estado de pausa direto do AsyncStorage (fora de componentes). */
export async function getPausedState(childId: string): Promise<PausedState> {
  const keys = await pauseKeys(childId);
  const [pausedRaw, datesRaw, sinceRaw] = await Promise.all([
    AsyncStorage.getItem(keys.paused),
    AsyncStorage.getItem(keys.dates),
    AsyncStorage.getItem(keys.since),
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

/** Filhos com pausa de férias ativa (mesmas queries de usePausedDates, compartilham o cache). */
export function usePausedChildIds(childIds: string[]): Set<string> {
  const today = localDateString();
  const pausedKey = useQueries({
    queries: childIds.map((childId) => ({
      queryKey: [...queryKeys.paused(childId), today],
      staleTime: Infinity,
      queryFn: () => getPausedState(childId),
    })),
  })
    .map((r, i) => (r.data?.paused === true ? childIds[i] : null))
    .filter((id): id is string => id !== null)
    .join(',');
  return useMemo(() => new Set(pausedKey ? pausedKey.split(',') : []), [pausedKey]);
}

async function appendPausedDate(childId: string, date: string): Promise<boolean> {
  const { pausedDates } = await getPausedState(childId);
  if (pausedDates.includes(date)) return false;
  const keys = await pauseKeys(childId);
  await AsyncStorage.setItem(keys.dates, JSON.stringify([...pausedDates, date]));
  return true;
}

/**
 * Liga/desliga a pausa de férias do filho. Ao LIGAR, já registra a data
 * lógica de hoje como pausada (a noite de hoje vira nuvem). Lembre de chamar
 * syncSchedulesForFamily() depois, com remindersPaused refletindo este valor.
 */
export async function setChildPaused(childId: string, paused: boolean): Promise<void> {
  const today = localDateString();
  const keys = await pauseKeys(childId);
  if (paused) {
    const since = await AsyncStorage.getItem(keys.since);
    if (!since) await AsyncStorage.setItem(keys.since, today);
    await AsyncStorage.setItem(keys.paused, 'true');
    await appendPausedDate(childId, today);
  } else {
    // Fecha a pausa: grava as noites de [since, ontem] antes de desligar. A noite
    // de hoje ainda pode ser cuidada: quem retoma volta a vê-la pendente.
    const { pausedDates } = await getPausedState(childId);
    await AsyncStorage.setItem(keys.dates, JSON.stringify(pausedDates.filter((d) => d !== today)));
    await AsyncStorage.setItem(keys.paused, 'false');
    await AsyncStorage.removeItem(keys.since);
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
  const keys = await pauseKeys(childId);
  const since = await AsyncStorage.getItem(keys.since);
  if (!since) await AsyncStorage.setItem(keys.since, today);
  const added = await appendPausedDate(childId, today);
  if (added) void queryClient.invalidateQueries({ queryKey: queryKeys.paused(childId) });
}
