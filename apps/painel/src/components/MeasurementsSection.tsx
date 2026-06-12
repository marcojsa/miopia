// Histórico de medições de uma criança. Apenas EXIBE os dados (ANVISA):
// nenhuma cor semafórica, seta, média, percentil ou faixa-alvo. A única
// interpretação é o campo `status` (digitado pela médica) e o doctor_note.
import { Link } from 'react-router-dom';

import { useMeasurements } from '@/hooks/useMeasurements';
import { CLINICAL_STATUS_LABELS, fmtDate, fmtNumber } from '@/lib/labels';

export function MeasurementsSection({ childId }: { childId: string }) {
  const { data: measurements, isLoading, error } = useMeasurements(childId);

  return (
    <section>
      <h3>Medições</h3>
      <p>
        <Link to={`/criancas/${childId}/nova-medicao`}>Registrar nova medição</Link>
      </p>

      {isLoading ? <p>Carregando...</p> : null}
      {error ? <p className="error">Erro: {(error as Error).message}</p> : null}

      {measurements && measurements.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>OD esf.</th>
              <th>OD cil.</th>
              <th>OD EE</th>
              <th>OD axial (mm)</th>
              <th>OE esf.</th>
              <th>OE cil.</th>
              <th>OE EE</th>
              <th>OE axial (mm)</th>
              <th>Avaliação (médica)</th>
              <th>Recado</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.measured_on)}</td>
                <td>{fmtNumber(m.od_sphere)}</td>
                <td>{fmtNumber(m.od_cylinder)}</td>
                <td>{fmtNumber(m.od_se)}</td>
                <td>{fmtNumber(m.od_axial_mm)}</td>
                <td>{fmtNumber(m.oe_sphere)}</td>
                <td>{fmtNumber(m.oe_cylinder)}</td>
                <td>{fmtNumber(m.oe_se)}</td>
                <td>{fmtNumber(m.oe_axial_mm)}</td>
                <td>{CLINICAL_STATUS_LABELS[m.status]}</td>
                <td>{m.doctor_note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Nenhuma medição registrada.</p>
      )}
      <p className="muted">
        EE = equivalente esférico (esfera + cilindro/2), calculado pelo banco.
        Apenas exibido.
      </p>
    </section>
  );
}
