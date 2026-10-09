// Reconciliação DECLARATIVA dos lembretes locais (design-mobile §multi-filho).
// - Triggers repetitivos: diário quando a prescrição é todo dia; um semanal por dia
//   quando days_of_week é restrito (pior caso iOS: 2 filhos x 3 tipos x 7 = 42 de 64).
// - Identifier determinístico `${childId}:${tipo}[:dia]` (colírio/lente:
//   `${childId}:${tipo}:${treatmentId}:${dose}[:dia]`) => cancelar/reagendar é idempotente.
// - iOS guarda no máximo 64 agendadas: acima de 60, prioriza (capSchedule) e avisa.
// - TODA mudança (novo filho, horário, pausa, troca de regime) passa por
//   syncSchedulesForFamily(): compara desejado vs pendente e aplica só o delta.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ChildScheduleInput } from '../../types/domain';
import { localDateString } from '../date';
import { REMINDER_CHANNEL_ID } from './channels';
import { CHECKIN_CATEGORY_ID } from './categories';
import { buildDesired, capSchedule, IOS_SCHEDULE_LIMIT, type DesiredSchedule } from './schedulePlan';

export { notifId, parseNotifId } from './schedulePlan';

/** Extrai hora/minuto de um trigger pendente (shape difere entre Android e iOS). */
function triggerTime(trigger: unknown): { hour: number; minute: number } | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const t = trigger as Record<string, unknown>;
  if (typeof t.hour === 'number' && typeof t.minute === 'number') {
    return { hour: t.hour, minute: t.minute };
  }
  // iOS: UNCalendarNotificationTrigger -> { dateComponents: { hour, minute, ... } }
  const dc = t.dateComponents as Record<string, unknown> | undefined;
  if (dc && typeof dc.hour === 'number' && typeof dc.minute === 'number') {
    return { hour: dc.hour, minute: dc.minute };
  }
  return null;
}

function alreadyScheduled(
  pending: Notifications.NotificationRequest[],
  id: string,
  d: DesiredSchedule
): boolean {
  const p = pending.find((n) => n.identifier === id);
  if (!p) return false;
  const time = triggerTime(p.trigger);
  if (!time || time.hour !== d.hour || time.minute !== d.minute) return false;
  if (p.content.title !== d.title || p.content.body !== d.body) return false;
  const category = d.withCheckinActions ? CHECKIN_CATEGORY_ID : null;
  if ((p.content.categoryIdentifier ?? null) !== category) return false;
  if (p.content.data?.treatmentId !== d.treatmentId) return false;
  if ((p.content.data?.dose ?? 1) !== d.dose) return false;
  return true;
}

/**
 * CHAMADA ÚNICA de reconciliação: no app start, ao salvar regime/horário,
 * ao pausar/retomar e ao adicionar/remover filho.
 * Fonte do estado desejado: cache TanStack (funciona offline).
 */
export async function syncSchedulesForFamily(children: ChildScheduleInput[]): Promise<void> {
  if (Platform.OS === 'web') return; // sem notificações no navegador (só testes)
  let desired = buildDesired(children, localDateString());
  if (Platform.OS === 'ios') {
    const capped = capSchedule(desired, IOS_SCHEDULE_LIMIT);
    if (capped.dropped.length > 0) {
      console.warn(
        `[lembretes] ${desired.size} lembretes passam do limite do iOS; ${capped.dropped.length} ficaram de fora:`,
        capped.dropped
      );
    }
    desired = capped.kept;
  }

  // Estado ATUAL no SO
  const pending = await Notifications.getAllScheduledNotificationsAsync();

  // Cancela órfãs (regime removido, filho pausado/arquivado)
  for (const p of pending) {
    if (!desired.has(p.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    }
  }

  // (Re)agenda novas/alteradas — id determinístico torna a operação idempotente
  for (const [id, d] of desired) {
    if (alreadyScheduled(pending, id, d)) continue;
    await Notifications.cancelScheduledNotificationAsync(id); // no-op se não existe

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: d.title,
        body: d.body,
        // Botões Feito / Pular hoje só nos lembretes que registram o cuidado.
        ...(d.withCheckinActions ? { categoryIdentifier: CHECKIN_CATEGORY_ID } : {}),
        data: {
          childId: d.childId,
          type: d.type,
          treatmentId: d.treatmentId,
          dose: d.dose,
          scheduledHour: d.hour,
          scheduledMinute: d.minute,
        },
        // iOS: agrupa as notificações por criança na central
        // (passado ao UNMutableNotificationContent; fora do tipo de input do expo-notifications)
        ...(Platform.OS === 'ios' ? { threadIdentifier: d.childId } : {}),
      },
      // Repetitivo = 1 slot iOS permanente; alarme INEXATO no Android
      // (sem SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM — risco de rejeição no Play).
      // Android: channelId vai NO TRIGGER.
      trigger:
        d.weekday === null
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: d.hour,
              minute: d.minute,
              channelId: REMINDER_CHANNEL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: d.weekday + 1, // expo: 1 = domingo
              hour: d.hour,
              minute: d.minute,
              channelId: REMINDER_CHANNEL_ID,
            },
    });
  }
}

/** Cancela TODOS os lembretes locais (logout / troca de conta). */
export async function cancelAllSchedules(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
