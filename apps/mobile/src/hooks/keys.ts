// Query keys padronizadas — use SEMPRE estes helpers (invalidação por prefixo:
// invalidateQueries({ queryKey: ['adherence'] }) pega 'today' e por-criança).
export const queryKeys = {
  children: ['children'] as const,
  /** Sem childId usa o sentinela 'all' (todos os tratamentos ativos da família). */
  treatments: (childId?: string) => ['treatments', childId ?? 'all'] as const,
  adherenceToday: ['adherence', 'today'] as const,
  adherenceByChild: (childId: string) => ['adherence', childId] as const,
  measurements: (childId: string) => ['measurements', childId] as const,
  reminderPrefs: ['reminder-prefs'] as const,
  /** Estado local de pausa (AsyncStorage, não servidor). */
  paused: (childId: string) => ['reminders', 'paused', childId] as const,
  /** Pendência de consentimento LGPD (gate de entrada). Reavalia se mudam as crianças. */
  consentPending: (userId: string | null, childIds: string[]) =>
    ['consent-pending', userId ?? 'anon', ...childIds] as const,
};
