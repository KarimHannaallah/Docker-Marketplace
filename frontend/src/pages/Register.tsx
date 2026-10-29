import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { ErrorMessage } from '../components/Feedback';

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/catalog" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/catalog', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Créer un compte</h1>
      <form className="card card-body form" onSubmit={handleSubmit}>
        <ErrorMessage message={error} />
        <label>
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
          <span className="muted small">8 caractères minimum</span>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Création…' : "S'inscrire"}
        </button>
      </form>
      <p className="muted center">
        Déjà inscrit ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  );
}
