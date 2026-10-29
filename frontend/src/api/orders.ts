import { api } from './client';
import type { Cart, Order } from './types';

export const ordersApi = {
  cart: () => api<Cart>('/api/orders/cart'),
  addToCart: (productId: number, quantity: number) =>
    api<{ product_id: number; quantity: number }>('/api/orders/cart', {
      method: 'POST',
      body: { productId, quantity },
    }),
  setQuantity: (productId: number, quantity: number) =>
    api<{ product_id: number; quantity: number }>(`/api/orders/cart/${productId}`, {
      method: 'PATCH',
      body: { quantity },
    }),
  removeFromCart: (productId: number) =>
    api<void>(`/api/orders/cart/${productId}`, { method: 'DELETE' }),
  checkout: () => api<Order>('/api/orders/checkout', { method: 'POST' }),
  list: () => api<Order[]>('/api/orders'),
  get: (id: number) => api<Order>(`/api/orders/${id}`),
};
