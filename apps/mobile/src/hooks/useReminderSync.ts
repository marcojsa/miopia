// Reconcilia os lembretes locais com o estado atual da família: ao entrar no app,
// quando filhos/tratamentos/horários mudam (ex.: a clínica encerrou ou trocou um
// regime) e a cada volta ao foreground. Id determinístico + diff no scheduler
// tornam a chamada repetida barata.
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { buildFamilySchedule } from '@/components/familia/familiaHelpers';
import { getNotificationPermission } from '@/lib/notifications/permission';
import { syncSchedulesForFamily } from '@/lib/notifications/scheduler';
import type { Child, ReminderPref, Treatment } from '@/types/domain';
import { useChildren } from './useChildren';
import { getPausedState } from './usePausedDates';
import { useReminderPrefs } from './useReminderPrefs';
import { useTreatments } from './useTreatments';

let chain: Promise<void> = Promise.resolve();

/**
 * Agenda os lembretes de TODOS os filhos (respeitando a pausa de cada um).
 * Sem permissão de notificação não agenda: o aparelho descartaria em silêncio.
 * Execuções são enfileiradas para duas reconciliações não se cruzarem.
 */
export function syncFamilyReminders(
  children: Child[],
  treatments: Treatment[],
  prefs: ReminderPref[]
): Promise<void> {
  chain = chain
    .then(async () => {
      const permission = await getNotificationPermission();
      if (permission.status !== 'granted') return;
      const paused = new Set<string>();
      await Promise.all(
        children.map(async (c) => {
          if ((await getPausedState(c.id)).paused) paused.add(c.id);
        })
      );
      await syncSchedulesForFamily(buildFamilySchedule(children, treatments, prefs, paused));
    })
    .catch(() => {
      // Falha local (storage/SO): a próxima mudança ou volta ao app tenta de novo.
    });
  return chain;
}

export function useReminderSync(): void {
  const children = useChildren().data;
  const treatments = useTreatments().data;
  const prefs = useReminderPrefs().data;

  useEffect(() => {
    if (!children || !treatments || !prefs) return;
    void syncFamilyReminders(children, treatments, prefs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncFamilyReminders(children, treatments, prefs);
    });
    return () => sub.remove();
  }, [children, treatments, prefs]);
}
