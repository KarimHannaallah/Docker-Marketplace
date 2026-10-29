import { api } from './client';
import type { Category, Product, ProductInput, ProductPage } from './types';

export interface ProductQuery {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const catalogApi = {
  categories: () => api<Category[]>('/api/catalog/categories'),
  products: ({ category, search, page = 1, pageSize = 12 }: ProductQuery = {}) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    return api<ProductPage>(`/api/catalog/products?${params}`);
  },
  product: (id: number) => api<Product>(`/api/catalog/products/${id}`),

  // Administration (ADMIN seulement)
  createProduct: (input: ProductInput) =>
    api<Product>('/api/catalog/products', { method: 'POST', body: input }),
  updateProduct: (id: number, input: ProductInput) =>
    api<Product>(`/api/catalog/products/${id}`, { method: 'PUT', body: input }),
  deleteProduct: (id: number) => api<void>(`/api/catalog/products/${id}`, { method: 'DELETE' }),
  createCategory: (name: string) =>
    api<Category>('/api/catalog/categories', { method: 'POST', body: { name } }),
};
