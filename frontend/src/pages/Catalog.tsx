import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { ErrorMessage, Loading } from '../components/Feedback';
import { ProductCard } from '../components/ProductCard';
import { useApi } from '../hooks/useApi';

const PAGE_SIZE = 12;

export function Catalog() {
  // Filtres et page dans l'URL : lien partageable, bouton « retour » fonctionnel.
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);

  const categories = useApi(() => catalogApi.categories(), []);
  const products = useApi(
    () => catalogApi.products({ category, search, page, pageSize: PAGE_SIZE }),
    [category, search, page],
  );

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    update({ search: searchInput.trim(), page: '' });
  }

  const totalPages = products.data ? Math.max(1, Math.ceil(products.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <h1>Catalogue</h1>

      <form className="toolbar" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Rechercher un produit…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Rechercher"
        />
        <button className="btn">Rechercher</button>
      </form>

      <div className="chips" role="group" aria-label="Catégories">
        <button
          type="button"
          className={`chip ${category === '' ? 'chip-active' : ''}`}
          onClick={() => update({ category: '', page: '' })}
        >
          Tout
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip ${category === c.slug ? 'chip-active' : ''}`}
            onClick={() => update({ category: c.slug, page: '' })}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ErrorMessage message={products.error ?? categories.error} />
      {products.loading && <Loading />}

      {products.data && (
        <>
          {products.data.items.length === 0 ? (
            <p className="muted center">Aucun produit ne correspond à votre recherche.</p>
          ) : (
            <div className="grid products">
              {products.data.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Précédent
              </button>
              <span className="muted">
                Page {page} / {totalPages}
              </span>
              <button className="btn" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
