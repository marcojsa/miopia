// Preferências de horário de lembrete do responsável logado (RLS escopa).
// reminder_time: 'HH:MM:SS'. Fonte (junto com useTreatments) do
// ChildScheduleInput passado a syncSchedulesForFamily().
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ReminderPref } from '@/types/domain';
import { queryKeys } from './keys';

const HOUR = 60 * 60 * 1000;

export function useReminderPrefs(): UseQueryResult<ReminderPref[]> {
  return useQuery({
    queryKey: queryKeys.reminderPrefs,
    staleTime: HOUR,
    queryFn: async (): Promise<ReminderPref[]> => {
      const { data, error } = await supabase
        .from('reminder_prefs')
        .select('guardian_user_id, treatment_id, reminder_time, enabled');
      if (error) throw error;
      return data ?? [];
    },
  });
}
