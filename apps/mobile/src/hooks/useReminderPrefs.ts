// Preferências de horário de lembrete do responsável logado (RLS escopa).
// reminder_time: 'HH:MM:SS' (na lente, hora de colocar); remove_time: hora de
// tirar a lente (null nos outros tratamentos). Fonte (junto com useTreatments) do
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
        .select('guardian_user_id, treatment_id, reminder_time, remove_time, enabled');
      if (error) throw error;
      return data ?? [];
    },
  });
}
