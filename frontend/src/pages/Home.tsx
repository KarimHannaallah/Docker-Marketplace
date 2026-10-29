import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function Home() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <h1>Le marketplace simple et rapide</h1>
        <p className="lead">
          Parcourez le catalogue, remplissez votre panier et passez commande en quelques clics.
        </p>
        <div className="actions center-actions">
          {user ? (
            <Link to="/catalog" className="btn btn-primary">
              Voir le catalogue
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary">
                Créer un compte
              </Link>
              <Link to="/login" className="btn">
                Se connecter
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid features">
        <div className="card card-body">
          <h3>Catalogue</h3>
          <p className="muted">Des produits classés par catégorie, avec recherche.</p>
        </div>
        <div className="card card-body">
          <h3>Panier persistant</h3>
          <p className="muted">Votre panier est enregistré, retrouvez-le à chaque connexion.</p>
        </div>
        <div className="card card-body">
          <h3>Paiement simulé</h3>
          <p className="muted">Validez votre commande et consultez son historique.</p>
        </div>
      </section>
      {!user && <p className="muted center">Connectez-vous pour accéder au catalogue.</p>}
    </>
  );
}
