// Tratamentos (prescrição) de uma criança: lista + criar + encerrar.
import { useState, type FormEvent } from 'react';

import { useCreateTreatment, useEndTreatment, useTreatments } from '@/hooks/useTreatments';
import type { Treatment, TreatmentType } from '@/types/database';
import { errorCode, toPtBr } from '@/lib/errors';
import { TREATMENT_TYPE_LABELS, WEEKDAY_LABELS, fmtDate, todayISO } from '@/lib/labels';

const TREATMENT_TYPES: TreatmentType[] = ['atropina', 'ortho_k', 'oculos_lentes'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function TreatmentsSection({ childId, birthDate }: { childId: string; birthDate: string }) {
  const { data: treatments, isLoading, error } = useTreatments(childId);
  const createTreatment = useCreateTreatment(childId);
  const endTreatment = useEndTreatment(childId);

  const [type, setType] = useState<TreatmentType>('atropina');
  const [instructions, setInstructions] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [startsOn, setStartsOn] = useState(todayISO());
  const [formError, setFormError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  function handleEnd(treatment: Pick<Treatment, 'id' | 'starts_on'>) {
    if (
      !window.confirm(
        'Encerrar este tratamento? O app da família deixa de mostrá-lo a partir de hoje.',
      )
    ) {
      return;
    }
    setEndError(null);
    setFormError(null);
    endTreatment.mutate(treatment, {
      onError: (err) => setEndError(toPtBr(err, 'Não foi possível encerrar o tratamento.')),
    });
  }

  function toggleDay(day: number) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (days.length === 0) {
      setFormError('Marque ao menos um dia da semana.');
      return;
    }
    if (!startsOn) {
      setFormError('Informe a data de início do tratamento.');
      return;
    }
    if (startsOn < birthDate) {
      setFormError('A data de início é anterior ao nascimento da criança.');
      return;
    }
    try {
      await createTreatment.mutateAsync({
        type,
        instructions,
        // <input type="time"> dá 'HH:MM'; o banco aceita time, normalizamos vazio→null.
        suggested_time: suggestedTime || null,
        days_of_week: days,
        starts_on: startsOn,
        active: true,
      });
      setInstructions('');
      setSuggestedTime('');
      setDays(ALL_DAYS);
      setStartsOn(todayISO());
      setType('atropina');
    } catch (err) {
      // Constraint uq_treatment_active: já existe um tratamento ativo desse tipo.
      setFormError(
        errorCode(err) === '23505'
          ? `Já existe um tratamento ativo de ${TREATMENT_TYPE_LABELS[type]} para esta criança. Encerre o atual antes de criar outro.`
          : toPtBr(err, 'Erro ao criar tratamento.'),
      );
    }
  }

  return (
    <section>
      <h3>Tratamentos</h3>

      {isLoading ? <p>Carregando...</p> : null}
      {error ? <p className="error">Erro: {toPtBr(error)}</p> : null}

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
                      onClick={() => handleEnd(t)}
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
      {endError ? <p className="error">{endError}</p> : null}

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
            required
            min={birthDate}
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
