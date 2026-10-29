import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { ordersApi } from '../api/orders';
import { ErrorMessage, Loading } from '../components/Feedback';
import { formatPrice } from '../format';
import { useApi } from '../hooks/useApi';

// Paiement SIMULÉ : le formulaire carte est purement décoratif, rien n'est envoyé au serveur.
// Le clic sur « Payer » appelle POST /api/orders/checkout qui crée la commande en statut PAID.
export function Checkout() {
  const navigate = useNavigate();
  const { data: cart, error, loading } = useApi(() => ordersApi.cart(), []);
  const [payError, setPayError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    setPayError(undefined);
    setBusy(true);
    try {
      const order = await ordersApi.checkout();
      navigate(`/orders/${order.id}`, { replace: true, state: { justPaid: true } });
    } catch (err) {
      setPayError(errorMessage(err));
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !cart) return <ErrorMessage message={error} />;

  if (cart.items.length === 0) {
    return (
      <div className="center">
        <p className="muted">Votre panier est vide, il n'y a rien à payer.</p>
        <Link to="/catalog" className="btn btn-primary">
          Parcourir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1>Paiement</h1>
      <div className="checkout">
        <form className="card card-body form" onSubmit={handlePay}>
          <p className="alert alert-info">Paiement simulé : aucune donnée bancaire n'est envoyée ni enregistrée.</p>
          <ErrorMessage message={payError} />
          <label>
            Titulaire de la carte
            <input placeholder="Jean Dupont" autoComplete="off" />
          </label>
          <label>
            Numéro de carte
            <input placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="off" />
          </label>
          <div className="row">
            <label>
              Expiration
              <input placeholder="MM/AA" autoComplete="off" />
            </label>
            <label>
              CVC
              <input placeholder="123" inputMode="numeric" autoComplete="off" />
            </label>
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Paiement en cours…' : `Payer ${formatPrice(cart.total)}`}
          </button>
        </form>

        <aside className="card card-body">
          <h3>Récapitulatif</h3>
          <ul className="plain">
            {cart.items.map((line) => (
              <li key={line.product_id} className="between">
                <span>
                  {line.quantity} × {line.product?.name ?? `Produit #${line.product_id}`}
                </span>
                <span>{formatPrice(line.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="between total-row">
            <strong>Total</strong>
            <strong>{formatPrice(cart.total)}</strong>
          </p>
          <Link to="/cart" className="small">
            Modifier le panier
          </Link>
        </aside>
      </div>
    </>
  );
}
