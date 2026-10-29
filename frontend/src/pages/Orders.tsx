import { Link } from 'react-router-dom';
import { ordersApi } from '../api/orders';
import { ErrorMessage, Loading } from '../components/Feedback';
import { STATUS_LABELS, formatDate, formatPrice } from '../format';
import { useApi } from '../hooks/useApi';

export function Orders() {
  const { data: orders, error, loading } = useApi(() => ordersApi.list(), []);

  if (loading) return <Loading />;
  if (error || !orders) return <ErrorMessage message={error} />;

  return (
    <>
      <h1>Mes commandes</h1>
      {orders.length === 0 ? (
        <div className="center">
          <p className="muted">Vous n'avez pas encore passé de commande.</p>
          <Link to="/catalog" className="btn btn-primary">
            Parcourir le catalogue
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Statut</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>
                    <span className={`badge badge-${o.status.toLowerCase()}`}>{STATUS_LABELS[o.status]}</span>
                  </td>
                  <td className="num">{formatPrice(o.total)}</td>
                  <td className="num">
                    <Link to={`/orders/${o.id}`}>Détail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
