// Barrel dos hooks de dados. Import recomendado: import { useChildren } from '@/hooks';
export { queryKeys } from './keys';
export { useChildren } from './useChildren';
export { useIsStaff } from './useIsStaff';
export { useTreatments, useTreatmentHistory } from './useTreatments';
export {
  useTodayAdherence,
  useAdherenceLogs,
  ALL_HISTORY,
  useCheckinMutation,
  type CheckinInput,
} from './useAdherence';
export { useMeasurements } from './useMeasurements';
export { useHasMeasurements } from './useHasMeasurements';
export { useContents } from './useContents';
export { useReminderPrefs } from './useReminderPrefs';
export {
  ROUTINE_ERROR,
  useChildRoutine,
  useChildRoutines,
  type SaveRoutineInput,
  type UseChildRoutineResult,
} from './useChildRoutine';
export { useReminderSync, syncFamilyReminders } from './useReminderSync';
export {
  useNotificationPermission,
  type NotificationPermissionState,
} from './useNotificationPermission';
export { useConsentPending, type ConsentPendingResult } from './useConsentPending';
export {
  usePausedDates,
  usePausedChildIds,
  getPausedState,
  setChildPaused,
  markTodayPausedIfNeeded,
  type PausedState,
} from './usePausedDates';
