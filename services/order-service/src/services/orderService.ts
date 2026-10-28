import type { CatalogClient } from '../clients/catalogClient';
import { HttpError } from '../errors';
import type { CartRepository, Order, OrderItem, OrderRepository } from '../repositories/types';
import { toCents } from './cartService';

/** Forme JSON renvoyée aux clients (snake_case, comme les autres services). */
export function toOrderJson(order: Order) {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    created_at: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      price_at_purchase: i.priceAtPurchase,
    })),
  };
}

export class OrderService {
  constructor(
    private readonly carts: CartRepository,
    private readonly orders: OrderRepository,
    private readonly catalog: CatalogClient,
  ) {}

  /**
   * Paiement simulé : aucun vrai paiement, la commande passe directement à PAID.
   * Prix et stock sont relus dans le catalogue au moment du paiement (jamais ceux du client).
   */
  async checkout(userId: number, token: string): Promise<Order> {
    const cart = await this.carts.list(userId);
    if (cart.length === 0) throw new HttpError(400, 'Le panier est vide');

    const items: OrderItem[] = [];
    const problems: string[] = [];
    let totalCents = 0;

    for (const line of cart) {
      const product = await this.catalog.getProduct(line.productId, token);
      if (!product) {
        problems.push(`Le produit ${line.productId} n'est plus disponible`);
        continue;
      }
      if (line.quantity > product.stock) {
        problems.push(`Stock insuffisant pour « ${product.name} » (disponible : ${product.stock})`);
        continue;
      }
      totalCents += toCents(product.price) * line.quantity;
      items.push({ productId: line.productId, quantity: line.quantity, priceAtPurchase: product.price });
    }

    // Rien n'est créé si au moins une ligne pose problème.
    if (problems.length > 0) throw new HttpError(409, problems.join(' ; '));

    return this.orders.createFromCart(userId, 'PAID', totalCents / 100, items);
  }

  list(userId: number): Promise<Order[]> {
    return this.orders.listByUser(userId);
  }

  async get(userId: number, orderId: number): Promise<Order> {
    // 404 (et non 403) pour ne pas révéler l'existence des commandes des autres.
    const order = await this.orders.findByIdForUser(orderId, userId);
    if (!order) throw new HttpError(404, 'Commande introuvable');
    return order;
  }
}
