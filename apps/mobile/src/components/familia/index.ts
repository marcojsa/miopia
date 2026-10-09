// Barrel dos componentes/auxiliares da aba Família.
export { SettingsRow, type SettingsRowProps } from './SettingsRow';
export {
  ageInYears,
  ageLabel,
  regimeLabel,
  regimeSummary,
  reminderTimeLabel,
  scheduledDoses,
  isDailyLens,
  lensTimesFor,
  treatmentLabel,
  type DoseSlot,
  formatTimePtBR,
  parseHM,
  toReminderTimeString,
  formatReminderTime,
  effectiveTime,
  fallbackTimeFor,
  buildFamilySchedule,
  ORTHOK_OFF_TIME,
} from './familiaHelpers';
