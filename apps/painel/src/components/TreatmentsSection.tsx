// Tratamentos (prescrição) de uma criança: lista + criar + encerrar.
import { useState, type FormEvent } from 'react';

import { useCreateTreatment, useEndTreatment, useTreatments } from '@/hooks/useTreatments';
import type { TreatmentType } from '@/types/database';
import { TREATMENT_TYPE_LABELS, WEEKDAY_LABELS, fmtDate, todayISO } from '@/lib/labels';

const TREATMENT_TYPES: TreatmentType[] = ['atropina', 'ortho_k', 'oculos_lentes'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function TreatmentsSection({ childId }: { childId: string }) {
  const { data: treatments, isLoading, error } = useTreatments(childId);
  const createTreatment = useCreateTreatment(childId);
  const endTreatment = useEndTreatment(childId);

  const [type, setType] = useState<TreatmentType>('atropina');
  const [instructions, setInstructions] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [startsOn, setStartsOn] = useState(todayISO());
  const [formError, setFormError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createTreatment.mutateAsync({
        type,
        instructions,
        // <input type="time"> dá 'HH:MM'; o banco aceita time, normalizamos vazio→null.
        suggested_time: suggestedTime || null,
        days_of_week: days.length > 0 ? days : ALL_DAYS,
        starts_on: startsOn,
        active: true,
      });
      setInstructions('');
      setSuggestedTime('');
      setDays(ALL_DAYS);
      setType('atropina');
    } catch (err) {
      // Constraint uq_treatment_active: já existe um tratamento ativo desse tipo.
      const message = err instanceof Error ? err.message : 'Erro ao criar tratamento.';
      setFormError(
        /duplicate|unique|23505/i.test(message)
          ? `Já existe um tratamento ativo de ${TREATMENT_TYPE_LABELS[type]} para esta criança. Encerre o atual antes de criar outro.`
          : message,
      );
    }
  }

  return (
    <section>
      <h3>Tratamentos</h3>

      {isLoading ? <p>Carregando...</p> : null}
      {error ? <p className="error">Erro: {(error as Error).message}</p> : null}

      {treatments && treatments.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Instruções</th>
              <th>Horário sugerido</th>
              <th>Dias</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((t) => (
              <tr key={t.id}>
                <td>{TREATMENT_TYPE_LABELS[t.type]}</td>
                <td>{t.instructions ?? '—'}</td>
                <td>{t.suggested_time ? t.suggested_time.slice(0, 5) : '—'}</td>
                <td>{t.days_of_week.map((d) => WEEKDAY_LABELS[d]).join(', ')}</td>
                <td>{fmtDate(t.starts_on)}</td>
                <td>{fmtDate(t.ends_on)}</td>
                <td>{t.active ? 'Ativo' : 'Encerrado'}</td>
                <td>
                  {t.active ? (
                    <button
                      type="button"
                      disabled={endTreatment.isPending}
                      onClick={() => void endTreatment.mutateAsync(t.id)}
                    >
                      Encerrar
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Nenhum tratamento cadastrado.</p>
      )}

      <h4>Novo tratamento</h4>
      <form onSubmit={handleCreate}>
        <label>
          Tipo
          <br />
          <select value={type} onChange={(e) => setType(e.target.value as TreatmentType)}>
            {TREATMENT_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {TREATMENT_TYPE_LABELS[tt]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Instruções (ex.: "1 gota em cada olho ao deitar")
          <br />
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        <label>
          Horário sugerido
          <br />
          <input
            type="time"
            value={suggestedTime}
            onChange={(e) => setSuggestedTime(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Dias da semana</legend>
          {ALL_DAYS.map((day) => (
            <label key={day} style={{ display: 'inline-block', marginRight: '0.75rem' }}>
              <input
                type="checkbox"
                checked={days.includes(day)}
                onChange={() => toggleDay(day)}
              />{' '}
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </fieldset>
        <label>
          Início
          <br />
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </label>
        {formError ? <p className="error">{formError}</p> : null}
        <button type="submit" disabled={createTreatment.isPending}>
          {createTreatment.isPending ? 'Salvando...' : 'Adicionar tratamento'}
        </button>
      </form>
    </section>
  );
}
