// Rotina da criança (a que horas acorda e dorme) — preferência do responsável
// logado (RLS escopa). Dela saem os horários do colírio de várias doses e da
// lente de contato. Sem linha no banco, vale 07:00–21:00.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { routineError, routineFor, type Routine } from '@/lib/doseSchedule';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import type { Child, ChildRoutine, ReminderPref, Treatment } from '@/types/domain';
import { queryKeys } from './keys';
import { syncFamilyReminders } from './useReminderSync';

const HOUR = 60 * 60 * 1000;

/** `name` dos erros cuja mensagem (pt-BR) pode ir direto para a tela. */
export const ROUTINE_ERROR = 'RotinaInvalida';

function routineFailure(message: string): Error {
  const error = new Error(message);
  error.name = ROUTINE_ERROR;
  return error;
}

/** Rotinas de todos os filhos (uma linha por filho que já teve a rotina salva). */
export function useChildRoutines(): UseQueryResult<ChildRoutine[]> {
  return useQuery({
    queryKey: queryKeys.childRoutines,
    staleTime: HOUR,
    queryFn: async (): Promise<ChildRoutine[]> => {
      const { data, error } = await supabase
        .from('child_routines')
        .select('guardian_user_id, child_id, wake_time, bed_time');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SaveRoutineInput {
  wake: string; // 'HH:MM'
  bed: string; // 'HH:MM'
}

export interface UseChildRoutineResult {
  /** Rotina efetiva (padrão 07:00–21:00 sem linha salva). */
  routine: Routine;
  isLoading: boolean;
  save: UseMutationResult<void, Error, SaveRoutineInput>;
}

/** Rotina de UM filho + salvar (upsert, cache, reagendar lembretes). */
export function useChildRoutine(childId: string): UseChildRoutineResult {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const routinesQuery = useChildRoutines();
  const routine = routineFor(routinesQuery.data ?? [], childId);

  const save = useMutation({
    mutationFn: async ({ wake, bed }: SaveRoutineInput): Promise<void> => {
      const invalid = routineError(wake, bed);
      if (invalid) throw routineFailure(invalid);
      const userId = session?.user.id;
      if (!userId) throw routineFailure('Sua sessão expirou. Entre de novo para salvar.');

      const row: ChildRoutine = {
        guardian_user_id: userId,
        child_id: childId,
        wake_time: `${wake}:00`,
        bed_time: `${bed}:00`,
      };
      const { error } = await supabase
        .from('child_routines')
        .upsert(row, { onConflict: 'guardian_user_id,child_id' });
      if (error) throw error;

      const routines = [
        ...(queryClient.getQueryData<ChildRoutine[]>(queryKeys.childRoutines) ?? []).filter(
          (r) => r.child_id !== childId
        ),
        row,
      ];
      queryClient.setQueryData<ChildRoutine[]>(queryKeys.childRoutines, routines);

      // Reagenda com a rotina nova (o colírio e a lente mudam de horário).
      const children = queryClient.getQueryData<Child[]>(queryKeys.children);
      const treatments = queryClient.getQueryData<Treatment[]>(queryKeys.treatments(undefined));
      const prefs = queryClient.getQueryData<ReminderPref[]>(queryKeys.reminderPrefs);
      if (children && treatments && prefs) {
        await syncFamilyReminders(children, treatments, prefs, routines);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.childRoutines });
    },
  });

  return { routine, isLoading: routinesQuery.isLoading, save };
}
