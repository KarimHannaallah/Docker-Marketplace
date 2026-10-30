// Contrats des repositories : le service ne connaît que ces interfaces,
// ce qui permet d'injecter des implémentations en mémoire dans les tests.
export interface CartItem {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELED';

export interface OrderItem {
  productId: number;
  quantity: number;
  priceAtPurchase: number;
}

export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  items: OrderItem[];
}

export interface CartRepository {
  list(userId: number): Promise<CartItem[]>;
  find(userId: number, productId: number): Promise<CartItem | null>;
  /** Ajoute la ligne, ou incrémente la quantité si le produit est déjà dans le panier. */
  addOrIncrement(userId: number, productId: number, quantity: number): Promise<CartItem>;
  /** Retourne null si le produit n'est pas dans le panier. */
  setQuantity(userId: number, productId: number, quantity: number): Promise<CartItem | null>;
  remove(userId: number, productId: number): Promise<boolean>;
}

export interface OrderRepository {
  /** Crée la commande et ses lignes et vide le panier dans une seule transaction. */
  createFromCart(userId: number, status: OrderStatus, total: number, items: OrderItem[]): Promise<Order>;
  listByUser(userId: number): Promise<Order[]>;
  /** Ne retourne que les commandes de cet utilisateur. */
  findByIdForUser(orderId: number, userId: number): Promise<Order | null>;
}
