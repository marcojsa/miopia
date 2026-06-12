// Categoria de check-in com ações na PRÓPRIA notificação (1 toque, sem abrir o app).
// opensAppToForeground: false tem quirks por plataforma — item nº 1 a validar em
// dev build físico na semana 1 (fallback: ação abre sheet no app).
import * as Notifications from 'expo-notifications';

export const CHECKIN_CATEGORY_ID = 'checkin';
export const ACTION_DONE = 'done';
export const ACTION_SKIP = 'skip';

export async function registerCheckinCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY_ID, [
    {
      identifier: ACTION_DONE,
      buttonTitle: 'Feito',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SKIP,
      buttonTitle: 'Pular hoje',
      options: { opensAppToForeground: false },
    },
  ]);
}
