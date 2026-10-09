// Tratamentos (prescrição) de uma criança: lista + criar + encerrar.
import { useState, type FormEvent } from 'react';

import { useCreateTreatment, useEndTreatment, useTreatments } from '@/hooks/useTreatments';
import type { Treatment, TreatmentType } from '@/types/database';
import { errorCode, toPtBr } from '@/lib/errors';
import {
  TREATMENT_TYPE_LABELS,
  WEEKDAY_LABELS,
  fmtDate,
  fmtTimesPerDay,
  todayISO,
} from '@/lib/labels';

const TREATMENT_TYPES: TreatmentType[] = [
  'atropina',
  'ortho_k',
  'oculos_lentes',
  'colirio',
  'lente_contato',
];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TIMES_PER_DAY = [1, 2, 3, 4, 5, 6];

export function TreatmentsSection({ childId, birthDate }: { childId: string; birthDate: string }) {
  const { data: treatments, isLoading, error } = useTreatments(childId);
  const createTreatment = useCreateTreatment(childId);
  const endTreatment = useEndTreatment(childId);

  const [type, setType] = useState<TreatmentType>('atropina');
  const [name, setName] = useState('');
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [startsOn, setStartsOn] = useState(todayISO());
  const [formError, setFormError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  const isColirio = type === 'colirio';
  const isLente = type === 'lente_contato';
  // Colírio de várias doses e lente: os horários saem da rotina da família.
  const timesFromRoutine = (isColirio && timesPerDay > 1) || isLente;

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
    if (isColirio && !name.trim()) {
      setFormError('Informe o nome do colírio.');
      return;
    }
    try {
      await createTreatment.mutateAsync({
        type,
        name: isColirio ? name : null,
        times_per_day: isColirio ? timesPerDay : 1,
        instructions,
        // <input type="time"> dá 'HH:MM'; o banco aceita time, normalizamos vazio→null.
        suggested_time: timesFromRoutine ? null : suggestedTime || null,
        days_of_week: days,
        starts_on: startsOn,
        active: true,
      });
      setName('');
      setTimesPerDay(1);
      setInstructions('');
      setSuggestedTime('');
      setDays(ALL_DAYS);
      setStartsOn(todayISO());
      setType('atropina');
    } catch (err) {
      // uq_treatment_active (mesmo tipo) ou uq_treatment_active_colirio (mesmo nome).
      if (errorCode(err) !== '23505') {
        setFormError(toPtBr(err, 'Erro ao criar tratamento.'));
      } else if (isColirio) {
        setFormError(
          `Já existe um colírio ativo chamado "${name.trim()}" para esta criança. Encerre o atual antes de cadastrar outro com o mesmo nome.`,
        );
      } else {
        setFormError(
          `Já existe um tratamento ativo de ${TREATMENT_TYPE_LABELS[type]} para esta criança. Encerre o atual antes de criar outro.`,
        );
      }
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
              <th>Frequência</th>
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
                <td>
                  {TREATMENT_TYPE_LABELS[t.type]}
                  {t.name ? ` — ${t.name}` : ''}
                </td>
                <td>{fmtTimesPerDay(t.times_per_day)}</td>
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
      ) : null}
      {treatments && treatments.length === 0 ? (
        <p className="muted">Nenhum tratamento cadastrado.</p>
      ) : null}
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
        {isColirio ? (
          <>
            <label>
              Nome do colírio
              <br />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="muted">
              Para trocar o regime de um colírio, encerre o atual e cadastre o novo com o mesmo
              nome: os registros e o lembrete da família passam para o novo.
            </p>
            <label>
              Vezes por dia
              <br />
              <select
                value={timesPerDay}
                onChange={(e) => setTimesPerDay(Number(e.target.value))}
              >
                {TIMES_PER_DAY.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <label>
          {isLente
            ? 'Regra de uso (ex.: usar o dia todo; no máximo 8 horas)'
            : 'Instruções (ex.: "1 gota em cada olho ao deitar")'}
          <br />
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        {timesFromRoutine ? (
          <p className="muted">
            Os horários são distribuídos pelo app entre a hora de acordar e a de dormir que a
            família informa.
          </p>
        ) : (
          <label>
            Horário sugerido
            <br />
            <input
              type="time"
              value={suggestedTime}
              onChange={(e) => setSuggestedTime(e.target.value)}
            />
          </label>
        )}
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
