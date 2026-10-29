import { useState } from 'react';
import { authApi } from '../../api/auth';
import { errorMessage } from '../../api/client';
import type { User } from '../../api/types';
import { ErrorMessage, Loading } from '../../components/Feedback';
import { formatDate } from '../../format';
import { useApi } from '../../hooks/useApi';

export function AdminUsers() {
  const { data: users, error, loading, reload } = useApi(() => authApi.users(), []);
  const [actionError, setActionError] = useState<string>();

  async function handleDelete(user: User) {
    if (!window.confirm(`Supprimer le compte de ${user.name} (${user.email}) ?`)) return;
    setActionError(undefined);
    try {
      await authApi.deleteUser(user.id);
    } catch (err) {
      setActionError(errorMessage(err));
    }
    reload();
  }

  if (loading) return <Loading />;
  if (error || !users) return <ErrorMessage message={error} />;

  return (
    <>
      <ErrorMessage message={actionError} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Inscrit le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : ''}`}>{u.role}</span>
                </td>
                <td>{formatDate(u.created_at)}</td>
                <td className="num">
                  {/* Un ADMIN ne peut jamais être supprimé par un autre admin */}
                  {u.role === 'STANDARD' ? (
                    <button className="btn btn-danger btn-small" onClick={() => handleDelete(u)}>
                      Supprimer
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
