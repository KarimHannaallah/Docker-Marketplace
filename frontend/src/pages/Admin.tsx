import { useState } from 'react';
import { AdminProducts } from './admin/AdminProducts';
import { AdminUsers } from './admin/AdminUsers';

export function Admin() {
  const [tab, setTab] = useState<'users' | 'products'>('users');

  return (
    <>
      <h1>Administration</h1>
      <div className="chips" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'users'}
          className={`chip ${tab === 'users' ? 'chip-active' : ''}`}
          onClick={() => setTab('users')}
        >
          Utilisateurs
        </button>
        <button
          role="tab"
          aria-selected={tab === 'products'}
          className={`chip ${tab === 'products' ? 'chip-active' : ''}`}
          onClick={() => setTab('products')}
        >
          Produits
        </button>
      </div>
      {tab === 'users' ? <AdminUsers /> : <AdminProducts />}
    </>
  );
}
