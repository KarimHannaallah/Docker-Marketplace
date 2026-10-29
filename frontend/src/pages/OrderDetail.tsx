import { Link, useLocation, useParams } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { ordersApi } from '../api/orders';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { STATUS_LABELS, formatDate, formatPrice } from '../format';
import { useApi } from '../hooks/useApi';

// Sert aussi de page de confirmation : après le paiement on arrive ici avec state.justPaid.
export function OrderDetail() {
  const id = Number(useParams().id);
  const justPaid = Boolean((useLocation().state as { justPaid?: boolean } | null)?.justPaid);

  const { data, error, loading } = useApi(async () => {
    const order = await ordersApi.get(id);
    // Les lignes ne contiennent que l'id produit : on récupère les noms au mieux
    // (un produit désactivé n'est plus renvoyé par le catalogue).
    const names = await Promise.all(
      order.items.map((i) =>
        catalogApi
          .product(i.product_id)
          .then((p) => p.name)
          .catch(() => `Produit #${i.product_id}`),
      ),
    );
    return { order, names };
  }, [id]);

  if (loading) return <Loading />;
  if (error || !data) {
    return (
      <>
        <ErrorMessage message={error ?? 'Commande introuvable'} />
        <Link to="/orders">← Mes commandes</Link>
      </>
    );
  }
  const { order, names } = data;

  return (
    <>
      {justPaid && <SuccessMessage message={`Merci ! Votre commande #${order.id} est confirmée.`} />}
      <h1>Commande #{order.id}</h1>
      <p className="muted">
        Passée le {formatDate(order.created_at)} —{' '}
        <span className={`badge badge-${order.status.toLowerCase()}`}>{STATUS_LABELS[order.status]}</span>
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th className="num">Quantité</th>
              <th className="num">Prix unitaire</th>
              <th className="num">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.product_id}>
                <td>{names[index]}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatPrice(item.price_at_purchase)}</td>
                <td className="num">{formatPrice(item.price_at_purchase * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Total</th>
              <th className="num">{formatPrice(order.total)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <p>
        <Link to="/orders">← Mes commandes</Link> · <Link to="/catalog">Continuer mes achats</Link>
      </p>
    </>
  );
}
