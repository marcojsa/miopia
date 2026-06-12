// Casca de navegação do painel (placeholder estrutural — sem identidade visual).
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { STAFF_ROLE_LABELS } from '@/lib/labels';

export function Layout() {
  const { staff, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header>
        <nav>
          <Link to="/familias">Famílias</Link>
          {' · '}
          <Link to="/convites">Convites</Link>
        </nav>
        <p className="muted">
          {staff ? (
            <>
              {staff.display_name} ({STAFF_ROLE_LABELS[staff.role]}){' '}
              <button type="button" onClick={() => void handleSignOut()}>
                Sair
              </button>
            </>
          ) : null}
        </p>
      </header>
      <hr />
      <Outlet />
    </>
  );
}
