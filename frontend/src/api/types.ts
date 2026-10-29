// Formes JSON renvoyées par les backends.
export type Role = 'STANDARD' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  category_id: number | null;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string | null;
  category_id: number | null;
}

export interface CartLine {
  product_id: number;
  quantity: number;
  /** null si le produit n'est plus au catalogue */
  product: Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'image_url'> | null;
  line_total: number;
}

export interface Cart {
  items: CartLine[];
  total: number;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
  price_at_purchase: number;
}

export interface Order {
  id: number;
  status: 'PENDING' | 'PAID' | 'CANCELED';
  total: number;
  created_at: string;
  items: OrderItem[];
}
