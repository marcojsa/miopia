// Busca no Klingo para o cadastro de criança, em passos: escolher o dia,
// escolher a criança na lista da agenda (ou buscar pelo CPF). Quem escolhe
// é a secretária; nada é digitado além do CPF, quando ela precisa dele.
import { useState, type FormEvent } from 'react';

import {
  buscarFichaKlingo,
  KlingoErro,
  useKlingoAgenda,
  type KlingoMarcacao,
} from '@/hooks/useKlingo';
import { todayISO } from '@/lib/labels';

/** O que a busca entrega ao formulário de criança. */
export interface KlingoEscolha {
  /** Identificador estável do paciente no Klingo (vira chart_ref "klingo:<ref>"). */
  paciente_ref: string | null;
  provisorio: boolean;
  nome: string;
  primeiro_nome: string;
  nascimento: string | null;
  idade: number | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  /** Marcação sem CPF: veio só da agenda, sem dados do responsável. */
  sem_cpf: boolean;
}

function amanhaISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtIdade(idade: number | null): string {
  if (idade === null) return '—';
  if (idade === 0) return 'menos de 1 ano';
  return idade === 1 ? '1 ano' : `${idade} anos`;
}

function mensagem(err: unknown): string {
  return err instanceof Error ? err.message : 'Não foi possível consultar o Klingo. Tente de novo.';
}

function daAgenda(m: KlingoMarcacao): KlingoEscolha {
  return {
    paciente_ref: m.paciente_ref,
    provisorio: m.provisorio,
    nome: m.nome,
    primeiro_nome: m.primeiro_nome,
    nascimento: m.nascimento,
    idade: m.idade,
    responsavel_nome: null,
    responsavel_email: null,
    sem_cpf: true,
  };
}

export function KlingoBusca({
  onEscolher,
  onFechar,
}: {
  onEscolher: (escolha: KlingoEscolha) => void | Promise<void>;
  onFechar: () => void;
}) {
  const hoje = todayISO();
  const amanha = amanhaISO();
  const [dia, setDia] = useState(hoje);
  const [soCriancas, setSoCriancas] = useState(true);
  const [cpf, setCpf] = useState('');
  // Marcação cuja ficha está sendo buscada, ou 'cpf'.
  const [buscando, setBuscando] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const agenda = useKlingoAgenda(dia, true);

  const todas = agenda.data ?? [];
  const totalCriancas = todas.filter((m) => m.crianca).length;
  // Crianças primeiro; dentro de cada grupo, pela hora.
  const visiveis = todas
    .filter((m) => !soCriancas || m.crianca)
    .sort((a, b) => Number(b.crianca) - Number(a.crianca) || a.hora.localeCompare(b.hora));

  function trocarDia(novo: string) {
    if (!novo) return;
    setErroLista(null);
    setDia(novo);
  }

  async function escolherMarcacao(m: KlingoMarcacao) {
    setErroLista(null);
    setErroCpf(null);
    if (!m.tem_cpf) {
      await onEscolher(daAgenda(m));
      return;
    }
    setBuscando(m.ref);
    try {
      const ficha = await buscarFichaKlingo({ acao: 'ficha', data: dia, ref: m.ref });
      await onEscolher({ ...ficha, nascimento: ficha.nascimento ?? m.nascimento, sem_cpf: false });
    } catch (err) {
      if (err instanceof KlingoErro && err.codigo === 'sem_cpf') await onEscolher(daAgenda(m));
      else setErroLista(mensagem(err));
    } finally {
      setBuscando(null);
    }
  }

  async function buscarCpf(event: FormEvent) {
    event.preventDefault();
    setErroLista(null);
    setErroCpf(null);
    const digitos = cpf.replace(/\D/g, '');
    if (digitos.length !== 11) {
      setErroCpf('O CPF precisa ter 11 números.');
      return;
    }
    setBuscando('cpf');
    try {
      const ficha = await buscarFichaKlingo({ acao: 'cpf', cpf: digitos });
      setCpf('');
      await onEscolher({ ...ficha, sem_cpf: false });
    } catch (err) {
      setErroCpf(mensagem(err));
    } finally {
      setBuscando(null);
    }
  }

  return (
    <div className="klingo" role="region" aria-label="Busca na agenda do Klingo">
      <div className="klingo-topo">
        <p className="klingo-passo">1. Escolha o dia</p>
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
      <div className="klingo-dias">
        <button type="button" aria-pressed={dia === hoje} onClick={() => trocarDia(hoje)}>
          Hoje
        </button>
        <button type="button" aria-pressed={dia === amanha} onClick={() => trocarDia(amanha)}>
          Amanhã
        </button>
        <label>
          Outro dia
          <input type="date" min={hoje} value={dia} onChange={(e) => trocarDia(e.target.value)} />
        </label>
      </div>
      <p className="muted">
        A agenda do Klingo mostra só hoje e os próximos dias, e quem já foi atendido pode sair da
        lista. Se não achar a criança, busque pelo CPF lá embaixo.
      </p>

      <p className="klingo-passo">2. Escolha a criança</p>
      <label className="klingo-filtro">
        <input
          type="checkbox"
          checked={soCriancas}
          onChange={(e) => setSoCriancas(e.target.checked)}
        />
        Só crianças (menores de 18 anos)
      </label>

      {agenda.isLoading ? <p>Carregando a agenda do Klingo...</p> : null}
      {agenda.error ? <p className="error">{mensagem(agenda.error)}</p> : null}
      {agenda.data && todas.length === 0 ? (
        <p className="klingo-vazio">Ninguém marcado neste dia.</p>
      ) : null}
      {agenda.data && todas.length > 0 && visiveis.length === 0 ? (
        <p className="klingo-vazio">
          Nenhuma criança marcada neste dia. Desmarque “Só crianças” para ver os adultos.
        </p>
      ) : null}
      {agenda.data && todas.length > 0 ? (
        <p className="muted">
          {todas.length === 1 ? '1 marcação' : `${todas.length} marcações`} neste dia,{' '}
          {totalCriancas === 1 ? '1 criança' : `${totalCriancas} crianças`}.
        </p>
      ) : null}
      {erroLista ? <p className="error">{erroLista}</p> : null}

      {visiveis.length > 0 ? (
        <table className="klingo-lista">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Paciente</th>
              <th>Idade</th>
              <th>Médico</th>
              <th aria-label="Escolher" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((m) => (
              <tr key={m.ref}>
                <td>{m.hora || '—'}</td>
                <td>
                  {m.nome}
                  {!m.tem_cpf ? (
                    <span className="sem-cpf">sem CPF no Klingo: complete à mão</span>
                  ) : null}
                </td>
                <td>{fmtIdade(m.idade)}</td>
                <td>{m.medico || '—'}</td>
                <td>
                  <button
                    type="button"
                    disabled={buscando !== null}
                    onClick={() => void escolherMarcacao(m)}
                  >
                    {buscando === m.ref ? 'Buscando...' : 'Escolher'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <form className="klingo-cpf" onSubmit={buscarCpf}>
        <label>
          Ou buscar por CPF
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />
        </label>
        <button type="submit" disabled={buscando !== null}>
          {buscando === 'cpf' ? 'Buscando...' : 'Buscar CPF'}
        </button>
      </form>
      <p className="muted">O CPF serve só para achar a ficha no Klingo: o Lumi não guarda.</p>
      {erroCpf ? <p className="error">{erroCpf}</p> : null}
    </div>
  );
}
