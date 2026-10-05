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
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useChild } from '@/hooks/useChildren';
import {
  useCreateMeasurement,
  useMeasurements,
  useUpdateMeasurement,
} from '@/hooks/useMeasurements';
import { errorCode, toPtBr } from '@/lib/errors';
import {
  validateEye,
  type EyeParsed,
  type EyeValues,
} from '@/lib/measurementValidation';
import type { ClinicalStatus, Measurement } from '@/types/database';
import { CLINICAL_STATUS_LABELS, fmtDate, fmtNumber, todayISO } from '@/lib/labels';

const STATUSES: ClinicalStatus[] = ['sem_avaliacao', 'controle_adequado', 'atencao'];

const EMPTY_EYE: EyeValues = { sphere: '', cylinder: '', axial: '' };

function toField(value: number | null): string {
  return value === null ? '' : String(value);
}

function eyeFrom(m: Measurement, eye: 'od' | 'oe'): EyeValues {
  return {
    sphere: toField(m[`${eye}_sphere`]),
    cylinder: toField(m[`${eye}_cylinder`]),
    axial: toField(m[`${eye}_axial_mm`]),
  };
}

export function NewMeasurementPage() {
  const { childId, measurementId } = useParams<{ childId: string; measurementId?: string }>();
  const isEdit = !!measurementId;
  const navigate = useNavigate();
  const { data: child } = useChild(childId);
  const createMeasurement = useCreateMeasurement(childId ?? '');
  const updateMeasurement = useUpdateMeasurement(childId ?? '');
  const saving = createMeasurement.isPending || updateMeasurement.isPending;
  const { data: measurements, isLoading: loadingExisting } = useMeasurements(
    isEdit ? childId : undefined,
  );
  const existing = isEdit ? measurements?.find((m) => m.id === measurementId) : undefined;

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

  // Edição: preenche o formulário uma vez com os valores salvos.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!existing || loadedFor.current === existing.id) return;
    loadedFor.current = existing.id;
    setMeasuredOn(existing.measured_on);
    setOd(eyeFrom(existing, 'od'));
    setOe(eyeFrom(existing, 'oe'));
    setStatus(existing.status);
    setDoctorNote(existing.doctor_note ?? '');
  }, [existing]);

  if (!childId) {
    return (
      <main>
        <p className="error">Criança não informada.</p>
      </main>
    );
  }

  if (isEdit && !existing) {
    return (
      <main>
        {loadingExisting ? (
          <p>Carregando...</p>
        ) : (
          <p className="error">Medição não encontrada.</p>
        )}
      </main>
    );
  }

  // Etapa 1 → mostra o resumo (não grava ainda).
  function handleReview(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const allErrors = [...odField.errors, ...oeField.errors];
    if (!measuredOn) allErrors.push('Informe a data da medição.');
    const allEmpty = [odField.parsed, oeField.parsed].every(
      (eye) => eye.sphere === null && eye.cylinder === null && eye.axial === null,
    );
    if (odField.errors.length === 0 && oeField.errors.length === 0 && allEmpty) {
      allErrors.push('Preencha ao menos um valor de refração ou de comprimento axial.');
    }
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
    const values = {
      measured_on: measuredOn,
      od_sphere: pending.odParsed.sphere,
      od_cylinder: pending.odParsed.cylinder,
      od_axial_mm: pending.odParsed.axial,
      oe_sphere: pending.oeParsed.sphere,
      oe_cylinder: pending.oeParsed.cylinder,
      oe_axial_mm: pending.oeParsed.axial,
      status,
      doctor_note: doctorNote.trim() || null,
    };
    try {
      if (existing) {
        await updateMeasurement.mutateAsync({ id: existing.id, values });
      } else {
        await createMeasurement.mutateAsync(values);
      }
      // Volta para o detalhe da família da criança.
      navigate(child ? `/familias/${child.family_id}` : '/familias', { replace: true });
    } catch (err) {
      setSubmitError(
        errorCode(err) === '23505'
          ? 'Já existe uma medição desta criança nesta data. Volte à ficha da família e use "Editar" na linha dessa medição.'
          : toPtBr(err, 'Erro ao salvar a medição.'),
      );
    }
  }

  return (
    <main>
      <h1>{isEdit ? 'Editar medição' : 'Nova medição'}</h1>
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

          <button type="button" disabled={saving} onClick={() => void handleConfirm()}>
            {saving ? 'Salvando...' : 'Confirmar e salvar'}
          </button>{' '}
          <button
            type="button"
            disabled={saving}
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
