import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { errorMessage } from '../api/client';
import { ordersApi } from '../api/orders';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { ProductImage } from '../components/ProductCard';
import { formatPrice } from '../format';
import { useApi } from '../hooks/useApi';

export function ProductDetail() {
  const id = Number(useParams().id);
  const { data: product, error, loading } = useApi(() => catalogApi.product(id), [id]);

  const [quantity, setQuantity] = useState(1);
  const [actionError, setActionError] = useState<string>();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addToCart() {
    setActionError(undefined);
    setAdded(false);
    setBusy(true);
    try {
      await ordersApi.addToCart(id, quantity);
      setAdded(true);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !product) {
    return (
      <>
        <ErrorMessage message={error ?? 'Produit introuvable'} />
        <Link to="/catalog">← Retour au catalogue</Link>
      </>
    );
  }

  return (
    <>
      <p>
        <Link to="/catalog">← Retour au catalogue</Link>
      </p>
      <div className="detail">
        <ProductImage product={product} />
        <div>
          <h1>{product.name}</h1>
          <p className="price big">{formatPrice(product.price)}</p>
          <p>{product.description}</p>
          <p className={product.stock > 0 ? 'muted' : 'danger'}>
            {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
          </p>

          <div className="actions">
            <input
              type="number"
              min={1}
              max={Math.max(1, product.stock)}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              aria-label="Quantité"
              className="qty-input"
              disabled={product.stock === 0}
            />
            <button className="btn btn-primary" onClick={addToCart} disabled={busy || product.stock === 0}>
              {busy ? 'Ajout…' : 'Ajouter au panier'}
            </button>
          </div>

          <ErrorMessage message={actionError} />
          {added && (
            <SuccessMessage message="Produit ajouté au panier." />
          )}
          {added && <Link to="/cart">Voir le panier →</Link>}
        </div>
      </div>
    </>
  );
}
