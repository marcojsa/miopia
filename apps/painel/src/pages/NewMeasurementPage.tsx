// NovaMedição — a tela mais importante do painel.
//
// Fluxo:
//   1. Formulário POR OLHO (OD/OE): esfera, cilindro, comprimento axial.
//      Validação de FORMATO/FAIXA: dioptrias múltiplas de 0,25; axial 15..35 mm.
//   2. Select de status (enum clinical_status, default 'sem_avaliacao') +
//      doctor_note (textarea).
//   3. CONFIRMAÇÃO DUPLA: ao submeter, mostramos um RESUMO dos valores
//      digitados (por olho) e exigimos um segundo "Confirmar" antes do insert.
//
// ANVISA RDC 657/2022: o painel apenas registra dados e a interpretação humana
// (status). NÃO calcula risco, NÃO emite juízo. O EE (od_se/oe_se) é GENERATED
// no banco — NÃO é enviado no insert. recorded_by = auth.uid() do staff logado.
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useChild } from '@/hooks/useChildren';
import { useCreateMeasurement } from '@/hooks/useMeasurements';
import {
  validateEye,
  type EyeParsed,
  type EyeValues,
} from '@/lib/measurementValidation';
import type { ClinicalStatus } from '@/types/database';
import { CLINICAL_STATUS_LABELS, fmtDate, fmtNumber, todayISO } from '@/lib/labels';

const STATUSES: ClinicalStatus[] = ['sem_avaliacao', 'controle_adequado', 'atencao'];

const EMPTY_EYE: EyeValues = { sphere: '', cylinder: '', axial: '' };

export function NewMeasurementPage() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { data: child } = useChild(childId);
  const createMeasurement = useCreateMeasurement(childId ?? '');

  const [measuredOn, setMeasuredOn] = useState(todayISO());
  const [od, setOd] = useState<EyeValues>(EMPTY_EYE);
  const [oe, setOe] = useState<EyeValues>(EMPTY_EYE);
  const [status, setStatus] = useState<ClinicalStatus>('sem_avaliacao');
  const [doctorNote, setDoctorNote] = useState('');

  // Etapa de confirmação dupla: null = editando; objeto = resumo a confirmar.
  const [pending, setPending] = useState<{
    odParsed: EyeParsed;
    oeParsed: EyeParsed;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const odField = useMemo(() => validateEye('Olho direito (OD)', od), [od]);
  const oeField = useMemo(() => validateEye('Olho esquerdo (OE)', oe), [oe]);

  if (!childId) {
    return (
      <main>
        <p className="error">Criança não informada.</p>
      </main>
    );
  }

  // Etapa 1 → mostra o resumo (não grava ainda).
  function handleReview(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const allErrors = [...odField.errors, ...oeField.errors];
    if (!measuredOn) allErrors.push('Informe a data da medição.');
    setErrors(allErrors);
    if (allErrors.length > 0) {
      setPending(null);
      return;
    }
    setPending({ odParsed: odField.parsed, oeParsed: oeField.parsed });
  }

  // Etapa 2 → segundo "Confirmar": grava de fato.
  async function handleConfirm() {
    if (!pending) return;
    setSubmitError(null);
    try {
      await createMeasurement.mutateAsync({
        measured_on: measuredOn,
        od_sphere: pending.odParsed.sphere,
        od_cylinder: pending.odParsed.cylinder,
        od_axial_mm: pending.odParsed.axial,
        oe_sphere: pending.oeParsed.sphere,
        oe_cylinder: pending.oeParsed.cylinder,
        oe_axial_mm: pending.oeParsed.axial,
        status,
        doctor_note: doctorNote.trim() || null,
      });
      // Volta para o detalhe da família da criança.
      navigate(child ? `/familias/${child.family_id}` : '/familias', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar a medição.';
      setSubmitError(
        /duplicate|unique|23505/i.test(message)
          ? 'Já existe uma medição para esta criança nesta data. Use outra data ou edite a existente.'
          : message,
      );
    }
  }

  return (
    <main>
      <h1>Nova medição</h1>
      <p className="muted">
        Criança: {child ? child.first_name : '...'}
        {child ? ` (nasc. ${fmtDate(child.birth_date)})` : ''}
      </p>

      <form onSubmit={handleReview}>
        <label>
          Data da medição
          <br />
          <input
            type="date"
            required
            max={todayISO()}
            value={measuredOn}
            disabled={pending !== null}
            onChange={(e) => setMeasuredOn(e.target.value)}
          />
        </label>

        <fieldset>
          <legend>Olho direito (OD)</legend>
          <EyeInputs values={od} disabled={pending !== null} onChange={setOd} />
        </fieldset>

        <fieldset>
          <legend>Olho esquerdo (OE)</legend>
          <EyeInputs values={oe} disabled={pending !== null} onChange={setOe} />
        </fieldset>

        <label>
          Avaliação da médica (status)
          <br />
          <select
            value={status}
            disabled={pending !== null}
            onChange={(e) => setStatus(e.target.value as ClinicalStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CLINICAL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Recado para a família (opcional)
          <br />
          <textarea
            rows={3}
            value={doctorNote}
            disabled={pending !== null}
            onChange={(e) => setDoctorNote(e.target.value)}
          />
        </label>

        {errors.length > 0 ? (
          <ul className="errors">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        {pending === null ? (
          <button type="submit">Revisar e confirmar</button>
        ) : null}
      </form>

      {pending !== null ? (
        <section style={{ border: '2px solid #333', padding: '1rem', marginTop: '1rem' }}>
          <h2>Confira antes de salvar</h2>
          <p className="muted">
            Verifique cada valor. Os dados são registrados como digitados; o
            painel não os interpreta.
          </p>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Esfera</th>
                <th>Cilindro</th>
                <th>Axial (mm)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Olho direito (OD)</th>
                <td>{fmtNumber(pending.odParsed.sphere)}</td>
                <td>{fmtNumber(pending.odParsed.cylinder)}</td>
                <td>{fmtNumber(pending.odParsed.axial)}</td>
              </tr>
              <tr>
                <th>Olho esquerdo (OE)</th>
                <td>{fmtNumber(pending.oeParsed.sphere)}</td>
                <td>{fmtNumber(pending.oeParsed.cylinder)}</td>
                <td>{fmtNumber(pending.oeParsed.axial)}</td>
              </tr>
            </tbody>
          </table>
          <p>
            Data: {fmtDate(measuredOn)} · Avaliação: {CLINICAL_STATUS_LABELS[status]}
          </p>
          {doctorNote.trim() ? <p>Recado: {doctorNote.trim()}</p> : null}

          {submitError ? <p className="error">{submitError}</p> : null}

          <button type="button" disabled={createMeasurement.isPending} onClick={() => void handleConfirm()}>
            {createMeasurement.isPending ? 'Salvando...' : 'Confirmar e salvar'}
          </button>{' '}
          <button
            type="button"
            disabled={createMeasurement.isPending}
            onClick={() => setPending(null)}
          >
            Voltar e editar
          </button>
        </section>
      ) : null}
    </main>
  );
}

function EyeInputs({
  values,
  disabled,
  onChange,
}: {
  values: EyeValues;
  disabled: boolean;
  onChange: (next: EyeValues) => void;
}) {
  return (
    <>
      <label>
        Esfera (dioptrias, passo 0,25)
        <br />
        <input
          type="number"
          step="0.25"
          inputMode="decimal"
          disabled={disabled}
          value={values.sphere}
          onChange={(e) => onChange({ ...values, sphere: e.target.value })}
        />
      </label>
      <label>
        Cilindro (dioptrias, passo 0,25)
        <br />
        <input
          type="number"
          step="0.25"
          inputMode="decimal"
          disabled={disabled}
          value={values.cylinder}
          onChange={(e) => onChange({ ...values, cylinder: e.target.value })}
        />
      </label>
      <label>
        Comprimento axial (mm, 15 a 35)
        <br />
        <input
          type="number"
          step="0.01"
          min={15}
          max={35}
          inputMode="decimal"
          disabled={disabled}
          value={values.axial}
          onChange={(e) => onChange({ ...values, axial: e.target.value })}
        />
      </label>
    </>
  );
}
