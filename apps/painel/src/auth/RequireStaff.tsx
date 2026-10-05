// Guard de rota: só deixa passar usuário autenticado E que seja staff ativo.
//
//  - sem sessão            → redireciona para /login;
//  - sessão mas não-staff  → tela de bloqueio explícita (com logout), porque a
//                            conta existe (pode ser um responsável tentando
//                            entrar no painel) mas não tem perfil de clínica.
//  - falha de rede        → "Sem conexão" com tentar de novo (não é falta de perfil);
//  - resolvendo            → estado de carregamento.
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';

export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, staff, staffError, isLoading, signOut, retryStaff } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p>Carregando...</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (staffError && !staff) {
    return (
      <main>
        <h1>Sem conexão</h1>
        <p>
          Não foi possível conectar ao servidor para confirmar o seu acesso.
          Verifique a conexão e tente novamente.
        </p>
        <button type="button" onClick={retryStaff}>
          Tentar de novo
        </button>{' '}
        <button type="button" onClick={() => void signOut()}>
          Sair
        </button>
      </main>
    );
  }

  if (!staff) {
    return (
      <main>
        <h1>Acesso restrito</h1>
        <p>
          Esta conta está autenticada, mas não tem perfil de equipe da clínica.
          O painel é exclusivo para a equipe (médica, secretaria ou
          administração).
        </p>
        <button type="button" onClick={() => void signOut()}>
          Sair
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
