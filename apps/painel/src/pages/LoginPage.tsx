// Login da equipe (e-mail + senha). Auto-cadastro é DESATIVADO no produto:
// contas de staff são criadas manualmente no SQL editor / por admin.
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { session, staff, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Já logado como staff: vai direto para o destino pretendido (ou famílias).
  if (!isLoading && session && staff) {
    const dest = (location.state as LocationState | null)?.from?.pathname ?? '/familias';
    return <Navigate to={dest} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/familias', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível entrar. Verifique os dados.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Painel da clínica</h1>
      <p className="muted">Oftalmologia Alto de Pinheiros — acesso da equipe.</p>

      <form onSubmit={handleSubmit}>
        <label>
          E-mail
          <br />
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Senha
          <br />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
