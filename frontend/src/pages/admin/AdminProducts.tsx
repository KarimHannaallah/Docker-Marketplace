import { useState, type FormEvent } from 'react';
import { catalogApi } from '../../api/catalog';
import { errorMessage } from '../../api/client';
import type { Product } from '../../api/types';
import { ErrorMessage, Loading, SuccessMessage } from '../../components/Feedback';
import { formatPrice } from '../../format';
import { useApi } from '../../hooks/useApi';

const PAGE_SIZE = 10;

// Valeurs du formulaire en texte (les <input> manipulent des chaînes), converties à l'envoi.
interface FormState {
  name: string;
  description: string;
  price: string;
  stock: string;
  image_url: string;
  category_id: string;
}

const EMPTY_FORM: FormState = { name: '', description: '', price: '', stock: '0', image_url: '', category_id: '' };

const toForm = (p: Product): FormState => ({
  name: p.name,
  description: p.description,
  price: String(p.price),
  stock: String(p.stock),
  image_url: p.image_url ?? '',
  category_id: p.category_id === null ? '' : String(p.category_id),
});

export function AdminProducts() {
  const [page, setPage] = useState(1);
  const products = useApi(() => catalogApi.products({ page, pageSize: PAGE_SIZE }), [page]);
  const categories = useApi(() => catalogApi.categories(), []);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const set = (field: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  // Exécute une action admin en affichant succès ou erreur.
  async function run(action: () => Promise<unknown>, success: string) {
    setError(undefined);
    setMessage(undefined);
    try {
      await action();
      setMessage(success);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      name: form.name.trim(),
      description: form.description,
      price: Number(form.price),
      stock: Number(form.stock),
      image_url: form.image_url.trim() || null,
      category_id: form.category_id ? Number(form.category_id) : null,
    };
    const ok = await run(
      () => (editingId === null ? catalogApi.createProduct(input) : catalogApi.updateProduct(editingId, input)),
      editingId === null ? 'Produit créé.' : 'Produit mis à jour.',
    );
    if (ok) {
      resetForm();
      products.reload();
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Retirer « ${product.name} » du catalogue ?`)) return;
    if (await run(() => catalogApi.deleteProduct(product.id), 'Produit retiré du catalogue.')) {
      if (editingId === product.id) resetForm();
      products.reload();
    }
  }

  async function handleAddCategory(event: FormEvent) {
    event.preventDefault();
    if (await run(() => catalogApi.createCategory(newCategory.trim()), 'Catégorie créée.')) {
      setNewCategory('');
      categories.reload();
    }
  }

  const totalPages = products.data ? Math.max(1, Math.ceil(products.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <ErrorMessage message={error} />
      <SuccessMessage message={message} />

      <div className="admin-grid">
        <form className="card card-body form" onSubmit={handleSubmit}>
          <h3>{editingId === null ? 'Nouveau produit' : `Modifier le produit #${editingId}`}</h3>
          <label>
            Nom
            <input value={form.name} onChange={set('name')} required maxLength={200} />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={set('description')} rows={3} />
          </label>
          <div className="row">
            <label>
              Prix (€)
              <input type="number" min={0} step="0.01" value={form.price} onChange={set('price')} required />
            </label>
            <label>
              Stock
              <input type="number" min={0} step={1} value={form.stock} onChange={set('stock')} required />
            </label>
          </div>
          <label>
            Catégorie
            <select value={form.category_id} onChange={set('category_id')}>
              <option value="">— Aucune —</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            URL de l'image
            <input type="url" value={form.image_url} onChange={set('image_url')} placeholder="https://…" />
          </label>
          <div className="actions">
            <button className="btn btn-primary">{editingId === null ? 'Créer' : 'Enregistrer'}</button>
            {editingId !== null && (
              <button type="button" className="btn" onClick={resetForm}>
                Annuler
              </button>
            )}
          </div>
        </form>

        <form className="card card-body form" onSubmit={handleAddCategory}>
          <h3>Nouvelle catégorie</h3>
          <label>
            Nom
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required maxLength={100} />
          </label>
          <button className="btn">Ajouter la catégorie</button>
        </form>
      </div>

      <h3>Produits actifs</h3>
      {products.loading && <Loading />}
      <ErrorMessage message={products.error} />
      {products.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th className="num">Prix</th>
                  <th className="num">Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="num">{formatPrice(p.price)}</td>
                    <td className="num">{p.stock}</td>
                    <td className="num nowrap">
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          setEditingId(p.id);
                          setForm(toForm(p));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Modifier
                      </button>{' '}
                      <button className="btn btn-danger btn-small" onClick={() => handleDelete(p)}>
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédent
              </button>
              <span className="muted">
                Page {page} / {totalPages}
              </span>
              <button className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
