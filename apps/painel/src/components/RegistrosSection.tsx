// Registros da família nos últimos 14 dias: o que foi marcado no app, dia a
// dia e dose a dose. Apenas EXIBE (ANVISA): sem cor semafórica, sem meta, sem
// julgamento. Uma linha por dose de cada tratamento, uma coluna por dia.
import { useAdherenceLogs, useLastAdherence, type AdherenceRow } from '@/hooks/useAdherence';
import { useTreatments } from '@/hooks/useTreatments';
import { toPtBr } from '@/lib/errors';
import { TREATMENT_TYPE_LABELS, WEEKDAY_LABELS } from '@/lib/labels';
import type { Treatment } from '@/types/database';

const DIAS = 14;
// Mesmo corte do app da família: registro feito até as 04h conta como a noite anterior.
const CORTE_NOITE_H = 4;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Os 14 dias lógicos até hoje, do mais antigo para o mais recente. */
function diasDaJanela(): string[] {
  const hoje = new Date(Date.now() - CORTE_NOITE_H * 3600 * 1000);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (DIAS - 1 - i));
    return ymd(d);
  });
}

/** O tratamento vale nesse dia? (Fim é exclusivo, como no app.) */
function valeNoDia(t: Treatment, dia: string): boolean {
  if (dia < t.starts_on) return false;
  if (t.ends_on && dia >= t.ends_on) return false;
  return t.days_of_week.includes(parseYmd(dia).getDay());
}

function nomeDoTratamento(t: Treatment): string {
  const tipo = TREATMENT_TYPE_LABELS[t.type];
  return t.type === 'colirio' && t.name ? `${tipo}: ${t.name}` : tipo;
}

function fmtDiaMes(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function fmtUltimo(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

export function RegistrosSection({ childId }: { childId: string }) {
  const dias = diasDaJanela();
  const inicio = dias[0];
  const hoje = dias[dias.length - 1];
  const { data: treatments } = useTreatments(childId);
  const { data: logs, isLoading, error } = useAdherenceLogs(childId, inicio);
  const { data: ultimo } = useLastAdherence(childId);

  const porChave = new Map<string, AdherenceRow>();
  for (const l of logs ?? []) porChave.set(`${l.treatment_id}|${l.log_date}|${l.dose}`, l);
  const comRegistro = new Set((logs ?? []).map((l) => l.treatment_id));

  // Entra quem valeu em algum dia da janela ou tem registro nela.
  const visiveis = (treatments ?? [])
    .filter(
      (t) =>
        t.starts_on <= hoje &&
        (comRegistro.has(t.id) || dias.some((dia) => valeNoDia(t, dia))),
    )
    .sort((a, b) => Number(b.active) - Number(a.active) || nomeDoTratamento(a).localeCompare(nomeDoTratamento(b)));

  const linhas = visiveis.flatMap((t) =>
    Array.from({ length: Math.max(1, t.times_per_day) }, (_, i) => ({ t, dose: i + 1 })),
  );

  const motivos = (logs ?? [])
    .filter((l) => l.status === 'pulado' && l.note?.trim())
    .map((l) => {
      const t = visiveis.find((x) => x.id === l.treatment_id);
      return { ...l, nome: t ? nomeDoTratamento(t) : 'Tratamento', doses: t?.times_per_day ?? 1 };
    });

  return (
    <section className="registros">
      <h3>Registros da família, últimos {DIAS} dias</h3>
      <p className="muted">
        {ultimo ? `Último registro: ${fmtUltimo(ultimo)}.` : 'A família ainda não registrou nada no app.'}
      </p>

      {isLoading ? <p>Carregando...</p> : null}
      {error ? <p className="error">Erro: {toPtBr(error)}</p> : null}

      {!isLoading && !error && linhas.length === 0 ? (
        <p className="muted">Nenhum tratamento valendo nestes dias.</p>
      ) : null}

      {linhas.length > 0 ? (
        <div className="registros-tabela">
          <table>
            <thead>
              <tr>
                <th scope="col">Tratamento</th>
                {dias.map((dia) => (
                  <th key={dia} scope="col" className="dia">
                    {WEEKDAY_LABELS[parseYmd(dia).getDay()]}
                    <br />
                    {fmtDiaMes(dia)}
                  </th>
                ))}
                <th scope="col">Feito</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ t, dose }) => {
                let feitos = 0;
                let valendo = 0;
                const celulas = dias.map((dia) => {
                  const log = porChave.get(`${t.id}|${dia}|${dose}`);
                  const vale = valeNoDia(t, dia);
                  if (vale && dia !== hoje) valendo += 1;
                  if (log?.status === 'feito') {
                    if (vale && dia !== hoje) feitos += 1;
                    return (
                      <td key={dia} className="dia" title={`${fmtDiaMes(dia)}: feito`}>
                        ✓
                      </td>
                    );
                  }
                  if (log?.status === 'pulado') {
                    const motivo = log.note?.trim();
                    return (
                      <td
                        key={dia}
                        className="dia"
                        title={`${fmtDiaMes(dia)}: não foi possível${motivo ? ` (${motivo})` : ''}`}
                      >
                        ✕{motivo ? '*' : ''}
                      </td>
                    );
                  }
                  return (
                    <td key={dia} className="dia vazio" title={vale ? `${fmtDiaMes(dia)}: sem registro` : undefined}>
                      {vale ? '—' : ''}
                    </td>
                  );
                });
                return (
                  <tr key={`${t.id}-${dose}`}>
                    <th scope="row">
                      {nomeDoTratamento(t)}
                      {t.times_per_day > 1 || !t.active ? (
                        <small>
                          {[t.times_per_day > 1 ? `${dose}ª dose` : null, !t.active ? 'encerrado' : null]
                            .filter(Boolean)
                            .join(', ')}
                        </small>
                      ) : null}
                    </th>
                    {celulas}
                    <td className="total">
                      {feitos} de {valendo}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {linhas.length > 0 ? (
        <p className="muted legenda">
          ✓ feito · ✕ não foi possível · * com motivo escrito · — sem registro · em branco: o
          tratamento não valia no dia. A coluna Feito conta os dias até ontem; hoje ainda está
          em andamento.
        </p>
      ) : null}

      {motivos.length > 0 ? (
        <div className="registros-motivos">
          <p>
            <strong>Motivos escritos pela família</strong>
          </p>
          <ul>
            {motivos.map((m) => (
              <li key={`${m.treatment_id}-${m.log_date}-${m.dose}`}>
                {fmtDiaMes(m.log_date)}, {m.nome}
                {m.doses > 1 ? `, ${m.dose}ª dose` : ''}: “{m.note!.trim()}”
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="muted legenda">Registrado pela família no app. Não é avaliação clínica.</p>
    </section>
  );
}
