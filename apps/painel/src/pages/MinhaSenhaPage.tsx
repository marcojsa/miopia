// Minha senha: a pessoa da equipe troca a senha provisória por uma sua.
// Confere a senha atual (novo login com ela) antes de gravar a nova, para que
// um computador esquecido aberto não sirva para trocar a senha de ninguém.
import { useState, type FormEvent } from 'react';

import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { toPtBr } from '@/lib/errors';

const MINIMO = 8;

export function MinhaSenhaPage() {
  const { session } = useAuth();
  const email = session?.user.email ?? '';
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setOk(false);
    if (nova.length < MINIMO) {
      setErro(`A senha nova precisa ter pelo menos ${MINIMO} caracteres.`);
      return;
    }
    if (nova !== confirma) {
      setErro('A confirmação está diferente da senha nova.');
      return;
    }
    if (nova === atual) {
      setErro('A senha nova precisa ser diferente da atual.');
      return;
    }
    setSalvando(true);
    try {
      const conferida = await supabase.auth.signInWithPassword({ email, password: atual });
      if (conferida.error) {
        setErro('A senha atual não confere.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) throw error;
      setOk(true);
      setAtual('');
      setNova('');
      setConfirma('');
    } catch (err) {
      setErro(toPtBr(err, 'Não foi possível trocar a senha.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main>
      <h1>Minha senha</h1>
      <p className="muted">Conta: {email}</p>

      <form onSubmit={handleSubmit}>
        <label>
          Senha atual
          <br />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />
        </label>
        <label>
          Senha nova (pelo menos {MINIMO} caracteres)
          <br />
          <input
            type="password"
            required
            minLength={MINIMO}
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          />
        </label>
        <label>
          Repita a senha nova
          <br />
          <input
            type="password"
            required
            minLength={MINIMO}
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
          />
        </label>

        {erro ? <p className="error">{erro}</p> : null}
        {ok ? <p className="sucesso" role="status">Senha trocada. Use a nova no próximo acesso.</p> : null}

        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Trocar senha'}
        </button>
      </form>
    </main>
  );
}
