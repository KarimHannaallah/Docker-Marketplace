import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../components/Feedback';
import { useAuth } from './useAuth';

/** Toute page imbriquée ici exige d'être connecté, sinon redirection vers /login. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** À imbriquer dans ProtectedRoute : réservé aux ADMIN, les autres retournent à l'accueil. */
export function AdminRoute() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}
