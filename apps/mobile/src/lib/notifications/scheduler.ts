// Reconciliação DECLARATIVA dos lembretes locais (design-mobile §multi-filho).
// - Triggers diários repetitivos (1 slot iOS permanente; pior caso 9 de 64).
// - Identifier determinístico `${childId}:${tipo}` => cancelar/reagendar é idempotente.
// - TODA mudança (novo filho, horário, pausa, troca de regime) passa por
//   syncSchedulesForFamily(): compara desejado vs pendente e aplica só o delta.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ChildScheduleInput, ReminderType } from '../../types/domain';
import { REMINDER_CHANNEL_ID } from './channels';
import { CHECKIN_CATEGORY_ID } from './categories';

export function notifId(childId: string, type: ReminderType): string {
  return `${childId}:${type}`;
}

export function parseNotifId(id: string): { childId: string; type: ReminderType } | null {
  const sep = id.lastIndexOf(':');
  if (sep <= 0) return null;
  const childId = id.slice(0, sep);
  const type = id.slice(sep + 1);
  if (type !== 'atropina' && type !== 'orthok_on' && type !== 'orthok_off') return null;
  return { childId, type };
}

// Conteúdo ESTÁTICO de propósito (trigger repetitivo não muda texto);
// celebração dinâmica fica na tela Hoje.
const COPY: Record<ReminderType, (firstName: string) => { title: string; body: string }> = {
  atropina: (n) => ({
    title: `Hora do colírio — ${n}`,
    body: 'Pingar a atropina antes de dormir. Toque em Feito quando aplicar.',
  }),
  orthok_on: (n) => ({
    title: `Hora da lente — ${n}`,
    body: 'Colocar a lente de ortho-k antes de dormir.',
  }),
  orthok_off: (n) => ({
    title: `Retirar a lente — ${n}`,
    body: 'Bom dia! Hora de retirar a lente de ortho-k.',
  }),
};

interface DesiredSchedule {
  childId: string;
  treatmentId: string;
  type: ReminderType;
  title: string;
  body: string;
  hour: number;
  minute: number;
}

function buildDesired(children: ChildScheduleInput[]): Map<string, DesiredSchedule> {
  const desired = new Map<string, DesiredSchedule>();
  for (const c of children) {
    if (c.remindersPaused) continue; // férias/doença: zero lembretes deste filho

    if (c.atropina) {
      desired.set(notifId(c.childId, 'atropina'), {
        childId: c.childId,
        treatmentId: c.atropina.treatmentId,
        type: 'atropina',
        ...COPY.atropina(c.firstName),
        ...c.atropina.time,
      });
    }
    if (c.orthok) {
      desired.set(notifId(c.childId, 'orthok_on'), {
        childId: c.childId,
        treatmentId: c.orthok.treatmentId,
        type: 'orthok_on',
        ...COPY.orthok_on(c.firstName),
        ...c.orthok.onTime,
      });
      desired.set(notifId(c.childId, 'orthok_off'), {
        childId: c.childId,
        treatmentId: c.orthok.treatmentId,
        type: 'orthok_off',
        ...COPY.orthok_off(c.firstName),
        ...c.orthok.offTime,
      });
    }
  }
  return desired;
}

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
  if (p.content.data?.treatmentId !== d.treatmentId) return false;
  return true;
}

/**
 * CHAMADA ÚNICA de reconciliação: no app start, ao salvar regime/horário,
 * ao pausar/retomar e ao adicionar/remover filho.
 * Fonte do estado desejado: cache TanStack (funciona offline).
 */
export async function syncSchedulesForFamily(children: ChildScheduleInput[]): Promise<void> {
  const desired = buildDesired(children);

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
        categoryIdentifier: CHECKIN_CATEGORY_ID, // botões Feito / Pular hoje
        data: {
          childId: d.childId,
          type: d.type,
          treatmentId: d.treatmentId,
          scheduledHour: d.hour,
          scheduledMinute: d.minute,
        },
        // iOS: agrupa as notificações por criança na central
        // (passado ao UNMutableNotificationContent; fora do tipo de input do expo-notifications)
        ...(Platform.OS === 'ios' ? { threadIdentifier: d.childId } : {}),
      },
      trigger: {
        // DAILY repetitivo = 1 slot iOS permanente; alarme INEXATO no Android
        // (sem SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM — risco de rejeição no Play).
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: d.hour,
        minute: d.minute,
        channelId: REMINDER_CHANNEL_ID, // Android: channelId vai NO TRIGGER
      },
    });
  }
}

/** Cancela TODOS os lembretes locais (logout / troca de conta). */
export async function cancelAllSchedules(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
