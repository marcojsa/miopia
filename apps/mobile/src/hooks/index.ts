// Barrel dos hooks de dados. Import recomendado: import { useChildren } from '@/hooks';
export { queryKeys } from './keys';
export { useChildren } from './useChildren';
export { useIsStaff } from './useIsStaff';
export { useTreatments } from './useTreatments';
export {
  useTodayAdherence,
  useAdherenceLogs,
  ALL_HISTORY,
  useCheckinMutation,
  type CheckinInput,
} from './useAdherence';
export { useMeasurements } from './useMeasurements';
export { useReminderPrefs } from './useReminderPrefs';
export { useReminderSync, syncFamilyReminders } from './useReminderSync';
export {
  useNotificationPermission,
  type NotificationPermissionState,
} from './useNotificationPermission';
export { useConsentPending, type ConsentPendingResult } from './useConsentPending';
export {
  usePausedDates,
  getPausedState,
  setChildPaused,
  markTodayPausedIfNeeded,
  type PausedState,
} from './usePausedDates';
