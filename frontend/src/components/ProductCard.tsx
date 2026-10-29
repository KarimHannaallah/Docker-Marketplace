import { Link } from 'react-router-dom';
import type { Product } from '../api/types';
import { formatPrice } from '../format';

export function ProductImage({ product }: { product: Pick<Product, 'name' | 'image_url'> }) {
  if (!product.image_url) return <div className="product-img placeholder">Pas d'image</div>;
  return <img className="product-img" src={product.image_url} alt={product.name} loading="lazy" />;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/catalog/${product.id}`} className="card product-card">
      <ProductImage product={product} />
      <div className="card-body">
        <h3>{product.name}</h3>
        <p className="price">{formatPrice(product.price)}</p>
        <p className={product.stock > 0 ? 'muted small' : 'danger small'}>
          {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
        </p>
      </div>
    </Link>
  );
}
