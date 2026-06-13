// Barrel dos hooks de dados. Import recomendado: import { useChildren } from '@/hooks';
export { queryKeys } from './keys';
export { useChildren } from './useChildren';
export { useTreatments } from './useTreatments';
export {
  useTodayAdherence,
  useAdherenceLogs,
  useCheckinMutation,
  type CheckinInput,
} from './useAdherence';
export { useMeasurements } from './useMeasurements';
export { useReminderPrefs } from './useReminderPrefs';
export { useConsentPending, type ConsentPendingResult } from './useConsentPending';
export {
  usePausedDates,
  getPausedState,
  setChildPaused,
  markTodayPausedIfNeeded,
  type PausedState,
} from './usePausedDates';
