import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    // On quitte d'abord la page (potentiellement protégée) : sinon la garde de route
    // redirigerait vers /login dès que l'utilisateur est effacé.
    navigate('/');
    await logout();
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            Marketplace
          </Link>
          <nav className="nav" aria-label="Navigation principale">
            {user ? (
              <>
                <NavLink to="/catalog">Catalogue</NavLink>
                <NavLink to="/cart">Panier</NavLink>
                <NavLink to="/orders">Commandes</NavLink>
                <NavLink to="/profile">Profil</NavLink>
                {user.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
                <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Connexion</NavLink>
                <NavLink to="/register" className="btn btn-primary">
                  Inscription
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container muted">Projet scolaire « Dév avec Docker » — mini-marketplace</div>
      </footer>
    </>
  );
}
