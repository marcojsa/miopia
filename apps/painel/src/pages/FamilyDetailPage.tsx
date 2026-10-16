// Detalhe da família: lista de crianças + criar criança. Para cada criança,
// seções de tratamentos e medições. A criança pode vir do Klingo (agenda do
// dia ou CPF), sem redigitar nome e nascimento.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  findChildByChartRef,
  findSimilarChildren,
  useChildren,
  useCreateChild,
  type ExistingChild,
} from '@/hooks/useChildren';
import { useFamily } from '@/hooks/useFamilies';
import { TreatmentsSection } from '@/components/TreatmentsSection';
import { MeasurementsSection } from '@/components/MeasurementsSection';
import { RegistrosSection } from '@/components/RegistrosSection';
import { fmtIdade, KlingoBusca, type KlingoEscolha } from '@/components/KlingoBusca';
import type { ConvitePreenchido } from '@/pages/InvitesPage';
import { errorCode, toPtBr } from '@/lib/errors';
import { fmtDate, todayISO } from '@/lib/labels';

// Nascimento mais antigo aceito: 25 anos antes de hoje (pega ano digitado errado).
function minBirthISO(): string {
  const today = todayISO();
  return `${Number(today.slice(0, 4)) - 25}${today.slice(4)}`;
}

interface CriancaCriada {
  nome: string;
  responsavelNome: string | null;
  responsavelEmail: string | null;
}

function rotuloConvite({ responsavelNome, responsavelEmail }: CriancaCriada): string {
  if (responsavelNome && responsavelEmail) return `Convidar ${responsavelNome} (${responsavelEmail})`;
  if (responsavelEmail) return `Convidar responsável (${responsavelEmail})`;
  if (responsavelNome) return `Convidar ${responsavelNome}`;
  return 'Convidar responsável';
}

function NewChildForm({ familyId }: { familyId: string }) {
  const navigate = useNavigate();
  const createChild = useCreateChild(familyId);
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatarKey, setAvatarKey] = useState('');
  const [chartRef, setChartRef] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [klingoAberto, setKlingoAberto] = useState(false);
  // Paciente escolhido no Klingo. Fica só na memória desta página: o e-mail
  // do responsável vai para o convite (se a secretária enviar) e para nenhum
  // outro lugar.
  const [origem, setOrigem] = useState<KlingoEscolha | null>(null);
  const [duplicada, setDuplicada] = useState<ExistingChild | null>(null);
  const [parecidas, setParecidas] = useState<ExistingChild[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [criada, setCriada] = useState<CriancaCriada | null>(null);

  function limparCampos() {
    setFirstName('');
    setBirthDate('');
    setAvatarKey('');
    setChartRef('');
    setOrigem(null);
    setParecidas([]);
  }

  async function handleEscolher(escolha: KlingoEscolha) {
    setFormError(null);
    setCriada(null);
    setDuplicada(null);
    setParecidas([]);
    const ref = escolha.paciente_ref ? `klingo:${escolha.paciente_ref}` : '';
    setConferindo(true);
    try {
      if (ref) {
        const existente = await findChildByChartRef(ref);
        if (existente) {
          limparCampos();
          setDuplicada(existente);
          setKlingoAberto(false);
          return;
        }
      }
      setFirstName(escolha.primeiro_nome);
      setBirthDate(escolha.nascimento ?? '');
      setChartRef(ref);
      setOrigem(escolha);
      setKlingoAberto(false);
      if (escolha.nascimento) {
        const iguais = await findSimilarChildren(escolha.primeiro_nome, escolha.nascimento);
        setParecidas(iguais);
      }
    } catch (err) {
      setFormError(toPtBr(err, 'Não foi possível conferir se a criança já está cadastrada.'));
    } finally {
      setConferindo(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setDuplicada(null);
    if (birthDate && (birthDate < minBirthISO() || birthDate > todayISO())) {
      setFormError('Confira a data de nascimento: ela precisa estar entre os últimos 25 anos e hoje.');
      return;
    }
    const ref = chartRef.trim();
    setConferindo(true);
    try {
      // Mesmo prontuário em qualquer família = mesma criança: não duplica.
      if (ref) {
        const existente = await findChildByChartRef(ref);
        if (existente) {
          setDuplicada(existente);
          return;
        }
      }
      await createChild.mutateAsync({
        first_name: firstName,
        birth_date: birthDate,
        avatar_key: avatarKey || null,
        chart_ref: ref || null,
      });
      setCriada(
        origem
          ? {
              nome: firstName.trim(),
              responsavelNome: origem.responsavel_nome,
              responsavelEmail: origem.responsavel_email,
            }
          : null,
      );
      limparCampos();
    } catch (err) {
      setFormError(toPtBr(err, 'Erro ao criar criança.'));
    } finally {
      setConferindo(false);
    }
  }

  function irParaConvite(dados: CriancaCriada) {
    // Estado da navegação (memória do navegador), não query string: o e-mail
    // não fica em URL, em log de servidor nem em armazenamento.
    const convite: ConvitePreenchido = {
      familyId,
      email: dados.responsavelEmail ?? '',
      displayName: dados.responsavelNome ?? '',
    };
    navigate('/convites', { state: { convite } });
  }

  const ocupado = conferindo || createChild.isPending;

  return (
    <section className="nova-crianca">
      <h3>Nova criança</h3>
      {!klingoAberto ? (
        <div className="klingo-chamada">
          <button
            type="button"
            className="primario"
            disabled={ocupado}
            onClick={() => {
              setKlingoAberto(true);
              setDuplicada(null);
              setCriada(null);
            }}
          >
            Buscar na agenda do Klingo
          </button>
          <span className="muted">para não digitar nome e nascimento</span>
        </div>
      ) : (
        <KlingoBusca onEscolher={handleEscolher} onFechar={() => setKlingoAberto(false)} />
      )}

      {conferindo && !createChild.isPending ? (
        <p className="muted">Conferindo se a criança já está cadastrada...</p>
      ) : null}

      {duplicada ? (
        <div className="aviso" role="alert">
          {duplicada.family_id === familyId ? (
            <p>
              Esta criança já está cadastrada nesta família
              {duplicada.archived_at ? ' (arquivada)' : ''}.
            </p>
          ) : (
            <p>
              Esta criança já está cadastrada na família{' '}
              <Link to={`/familias/${duplicada.family_id}`}>{duplicada.family_label}</Link>
              {duplicada.archived_at ? ' (arquivada)' : ''}.
            </p>
          )}
        </div>
      ) : null}

      {origem ? (
        <div className="klingo-origem">
          <p>
            <strong>Do Klingo:</strong> {origem.nome}
            {origem.idade !== null ? `, ${fmtIdade(origem.idade)}` : ''}
            {origem.nascimento ? `, nasc. ${fmtDate(origem.nascimento)}` : ''}.
          </p>
          {origem.responsavel_nome || origem.responsavel_email ? (
            <p>
              Responsável:{' '}
              {[origem.responsavel_nome, origem.responsavel_email].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {origem.sem_cpf ? (
            <p className="muted">
              Sem CPF no Klingo: os dados do responsável não vieram. Complete à mão no convite.
            </p>
          ) : !origem.responsavel_nome ? (
            <p className="muted">
              O Klingo não tem o nome da mãe: no convite, o nome do responsável fica para digitar.
            </p>
          ) : null}
          {origem.idade !== null && origem.idade >= 18 ? (
            <p className="aviso">
              Pelo nascimento, esta pessoa tem {fmtIdade(origem.idade)}. Confira se a ficha é da
              criança, e não do responsável.
            </p>
          ) : null}
          {origem.provisorio ? (
            <p className="muted">Pré-cadastro no Klingo: o cadastro completo ainda não foi feito lá.</p>
          ) : null}
          <p className="muted">Confira o primeiro nome e a data abaixo antes de adicionar.</p>
          <button type="button" onClick={limparCampos}>
            Limpar e digitar à mão
          </button>
        </div>
      ) : null}

      {parecidas.length > 0 ? (
        <div className="aviso">
          <p>Atenção: já existe criança com o mesmo nome e a mesma data de nascimento:</p>
          <ul>
            {parecidas.map((c) => (
              <li key={c.id}>
                {c.first_name}, nasc. {fmtDate(c.birth_date)}, na família{' '}
                {c.family_id === familyId ? (
                  'atual'
                ) : (
                  <Link to={`/familias/${c.family_id}`}>{c.family_label}</Link>
                )}
                {c.archived_at ? ' (arquivada)' : ''}
              </li>
            ))}
          </ul>
          <p>Confira se não é a mesma criança antes de adicionar.</p>
        </div>
      ) : null}

      <form onSubmit={handleCreate}>
        <label>
          Primeiro nome
          <br />
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
        <label>
          Data de nascimento
          <br />
          <input
            type="date"
            required
            min={minBirthISO()}
            max={todayISO()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>
        <label>
          Avatar (opcional — chave de avatar pré-definido)
          <br />
          <input type="text" value={avatarKey} onChange={(e) => setAvatarKey(e.target.value)} />
        </label>
        <label>
          Prontuário (opcional — uso interno, nunca exibido no app da família)
          <br />
          <input type="text" value={chartRef} onChange={(e) => setChartRef(e.target.value)} />
        </label>
        {formError ? <p className="error">{formError}</p> : null}
        <button type="submit" disabled={ocupado}>
          {createChild.isPending ? 'Salvando...' : 'Adicionar criança'}
        </button>
      </form>

      {criada ? (
        <div className="sucesso" role="status">
          <p>
            Criança cadastrada: <strong>{criada.nome}</strong>. Próximo passo: convidar o
            responsável para o app.
          </p>
          <button type="button" className="primario" onClick={() => irParaConvite(criada)}>
            {rotuloConvite(criada)}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { data: family, isLoading: familyLoading, error: familyError } = useFamily(familyId);
  const { data: children, isLoading, error } = useChildren(familyId);

  if (!familyId) {
    return (
      <main>
        <p className="error">Família não informada.</p>
      </main>
    );
  }

  if (!family) {
    return (
      <main>
        <p>
          <Link to="/familias">&larr; Famílias</Link>
        </p>
        {familyLoading && !familyError ? (
          <p>Carregando...</p>
        ) : familyError && errorCode(familyError) !== '22P02' ? (
          <p className="error">Erro ao carregar: {toPtBr(familyError)}</p>
        ) : (
          <p className="error">Família não encontrada.</p>
        )}
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link to="/familias">&larr; Famílias</Link>
      </p>
      <h1>{family.label}</h1>

      <NewChildForm key={familyId} familyId={familyId} />

      <h2>Crianças</h2>
      {isLoading ? <p>Carregando...</p> : null}
      {error ? <p className="error">Erro ao carregar: {toPtBr(error)}</p> : null}
      {children && children.length === 0 ? (
        <p className="muted">Nenhuma criança cadastrada nesta família.</p>
      ) : null}

      {children?.map((child) => (
        <article key={child.id} className="crianca">
          <h2>
            {child.first_name}{' '}
            <span className="muted">(nasc. {fmtDate(child.birth_date)})</span>
            {child.archived_at ? <span className="muted"> — arquivada</span> : null}
          </h2>
          <TreatmentsSection childId={child.id} birthDate={child.birth_date} />
          <RegistrosSection childId={child.id} />
          <MeasurementsSection childId={child.id} />
        </article>
      ))}
    </main>
  );
}
