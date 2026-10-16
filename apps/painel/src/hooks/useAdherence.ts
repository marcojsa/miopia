import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Registros que a família marcou no app (Feito / Não foi possível), por dose.
// Staff só lê (adh_staff_read). log_date já é a data lógica da noite (corte
// das 04h aplicado no aparelho da família).
export interface AdherenceRow {
  treatment_id: string;
  log_date: string;
  dose: number;
  status: 'feito' | 'pulado';
  note: string | null;
  created_at: string;
}

export function useAdherenceLogs(childId: string | undefined, since: string) {
  return useQuery({
    queryKey: ['adherence', childId, since],
    enabled: !!childId,
    queryFn: async (): Promise<AdherenceRow[]> => {
      const { data, error } = await supabase
        .from('adherence_logs')
        .select('treatment_id, log_date, dose, status, note, created_at')
        .eq('child_id', childId!)
        .gte('log_date', since)
        .order('log_date', { ascending: true });
      if (error) throw error;
      return (data as AdherenceRow[]) ?? [];
    },
  });
}

// Último registro feito pela família, em qualquer data (pode ser anterior à janela).
export function useLastAdherence(childId: string | undefined) {
  return useQuery({
    queryKey: ['adherence-ultimo', childId],
    enabled: !!childId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('adherence_logs')
        .select('created_at')
        .eq('child_id', childId!)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.created_at ?? null;
    },
  });
}
