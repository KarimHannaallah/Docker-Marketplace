import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="center">
      <h1>Page introuvable</h1>
      <p className="muted">Cette page n'existe pas.</p>
      <Link to="/" className="btn">
        Retour à l'accueil
      </Link>
    </div>
  );
}
