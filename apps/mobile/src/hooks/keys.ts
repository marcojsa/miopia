// Query keys padronizadas — use SEMPRE estes helpers (invalidação por prefixo:
// invalidateQueries({ queryKey: ['adherence'] }) pega 'today' e por-criança).
export const queryKeys = {
  children: ['children'] as const,
  /** A conta logada é da equipe da clínica (não do responsável)? */
  isStaff: (userId: string | null) => ['is-staff', userId ?? 'anon'] as const,
  /** Sem childId usa o sentinela 'all' (todos os tratamentos ativos da família). */
  treatments: (childId?: string) => ['treatments', childId ?? 'all'] as const,
  /** Todos os tratamentos da criança, ativos e encerrados (histórico de noites devidas). */
  treatmentHistory: (childId: string) => ['treatments', childId, 'history'] as const,
  /** Check-ins de UMA data lógica (corte 04h): a data entra na key para não servir ontem como hoje. */
  adherenceToday: (date: string) => ['adherence', 'today', date] as const,
  /** Prefixo do histórico da criança; a query completa acrescenta a data inicial. */
  adherenceByChild: (childId: string) => ['adherence', childId] as const,
  measurements: (childId: string) => ['measurements', childId] as const,
  /** A família tem alguma medição lançada? (mostra ou esconde a aba Progresso) */
  anyMeasurement: (userId: string | null) => ['measurements', 'any', userId ?? 'anon'] as const,
  reminderPrefs: ['reminder-prefs'] as const,
  /** Conteúdos publicados do mural da clínica (por usuário: o cache é persistido). */
  contents: (userId: string | null) => ['contents', userId ?? 'anon'] as const,
  /** Rotina (acorda/dorme) de cada filho, do responsável logado. */
  childRoutines: ['child-routines'] as const,
  /** Estado local de pausa (AsyncStorage, não servidor). */
  paused: (childId: string) => ['reminders', 'paused', childId] as const,
  /** Pendência de consentimento LGPD (gate de entrada). Reavalia se mudam as crianças. */
  consentPending: (userId: string | null, childIds: string[]) =>
    ['consent-pending', userId ?? 'anon', ...childIds] as const,
};
