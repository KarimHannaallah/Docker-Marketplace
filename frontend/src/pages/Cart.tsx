import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { ordersApi } from '../api/orders';
import { ErrorMessage, Loading } from '../components/Feedback';
import { ProductImage } from '../components/ProductCard';
import { formatPrice } from '../format';
import { useApi } from '../hooks/useApi';

export function Cart() {
  const { data: cart, error, loading, reload } = useApi(() => ordersApi.cart(), []);
  const [actionError, setActionError] = useState<string>();

  // Exécute une action sur le panier puis recharge les données depuis le serveur.
  async function run(action: () => Promise<unknown>) {
    setActionError(undefined);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    }
    reload();
  }

  if (loading) return <Loading />;
  if (error || !cart) return <ErrorMessage message={error} />;

  return (
    <>
      <h1>Mon panier</h1>
      <ErrorMessage message={actionError} />

      {cart.items.length === 0 ? (
        <div className="center">
          <p className="muted">Votre panier est vide.</p>
          <Link to="/catalog" className="btn btn-primary">
            Parcourir le catalogue
          </Link>
        </div>
      ) : (
        <>
          <ul className="list">
            {cart.items.map((line) => (
              <li key={line.product_id} className="card cart-line">
                {line.product ? (
                  <>
                    <ProductImage product={line.product} />
                    <div className="grow">
                      <Link to={`/catalog/${line.product_id}`}>
                        <strong>{line.product.name}</strong>
                      </Link>
                      <p className="muted small">{formatPrice(line.product.price)} l'unité</p>
                    </div>
                    <div className="qty">
                      <button
                        className="btn"
                        aria-label="Diminuer la quantité"
                        disabled={line.quantity <= 1}
                        onClick={() => run(() => ordersApi.setQuantity(line.product_id, line.quantity - 1))}
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        className="btn"
                        aria-label="Augmenter la quantité"
                        onClick={() => run(() => ordersApi.setQuantity(line.product_id, line.quantity + 1))}
                      >
                        +
                      </button>
                    </div>
                    <strong className="line-total">{formatPrice(line.line_total)}</strong>
                  </>
                ) : (
                  <div className="grow">
                    <strong>Produit #{line.product_id}</strong>
                    <p className="danger small">Ce produit n'est plus disponible : retirez-le pour commander.</p>
                  </div>
                )}
                <button
                  className="btn btn-ghost"
                  aria-label="Retirer du panier"
                  onClick={() => run(() => ordersApi.removeFromCart(line.product_id))}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>

          <div className="summary">
            <p>
              Total : <strong className="big">{formatPrice(cart.total)}</strong>
            </p>
            <Link to="/checkout" className="btn btn-primary">
              Passer au paiement
            </Link>
          </div>
        </>
      )}
    </>
  );
}
