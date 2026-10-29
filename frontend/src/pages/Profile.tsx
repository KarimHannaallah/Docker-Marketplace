import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { ErrorMessage } from '../components/Feedback';
import { formatDate } from '../format';

export function Profile() {
  const { user, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();

  async function handleDelete() {
    if (!window.confirm('Supprimer définitivement votre compte ? Cette action est irréversible.')) return;
    setError(undefined);
    try {
      await deleteAccount();
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleLogout() {
    navigate('/'); // avant logout() : voir Layout.tsx
    await logout();
  }

  if (!user) return null; // ProtectedRoute garantit qu'un utilisateur existe

  return (
    <>
      <h1>Mon profil</h1>
      <div className="card card-body profile">
        <dl>
          <dt>Nom</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Type de compte</dt>
          <dd>{user.role === 'ADMIN' ? 'Administrateur' : 'Standard'}</dd>
          <dt>Inscrit le</dt>
          <dd>{formatDate(user.created_at)}</dd>
        </dl>
        <div className="actions">
          <button className="btn" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="card card-body danger-zone">
        <h3>Zone dangereuse</h3>
        <p className="muted">La suppression de votre compte est définitive.</p>
        <ErrorMessage message={error} />
        <div className="actions">
          <button className="btn btn-danger" onClick={handleDelete}>
            Supprimer mon compte
          </button>
        </div>
      </div>
    </>
  );
}
