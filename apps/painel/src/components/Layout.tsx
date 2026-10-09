// Casca de navegação do painel: barra superior com a marca, as seções e a conta.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { Owl } from '@/components/Owl';
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
      <header className="topbar">
        <div className="brand">
          <Owl size={34} />
          <div>
            <strong>Lumi</strong>
            <span>Painel da clínica</span>
          </div>
        </div>
        <nav>
          <NavLink to="/familias">Famílias</NavLink>
          <NavLink to="/convites">Convites</NavLink>
          <NavLink to="/mural">Mural</NavLink>
        </nav>
        {staff ? (
          <div className="account">
            <span>
              {staff.display_name}
              <small>{STAFF_ROLE_LABELS[staff.role]}</small>
            </span>
            <button type="button" className="ghost" onClick={() => void handleSignOut()}>
              Sair
            </button>
          </div>
        ) : null}
      </header>
      <Outlet />
    </>
  );
}
