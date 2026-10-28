// Doublures de test : repositories en mémoire, faux catalogue, faux contrôle de révocation.
import type { CatalogClient, CatalogProduct } from '../src/clients/catalogClient';
import type { RevocationChecker } from '../src/clients/tokenVerifier';
import { HttpError } from '../src/errors';
import type {
  CartItem,
  CartRepository,
  Order,
  OrderItem,
  OrderRepository,
  OrderStatus,
} from '../src/repositories/types';

export class InMemoryCartRepository implements CartRepository {
  items: CartItem[] = [];
  private nextId = 1;

  async list(userId: number) {
    return this.items.filter((i) => i.userId === userId);
  }

  async find(userId: number, productId: number) {
    return this.items.find((i) => i.userId === userId && i.productId === productId) ?? null;
  }

  async addOrIncrement(userId: number, productId: number, quantity: number) {
    const existing = await this.find(userId, productId);
    if (existing) {
      existing.quantity += quantity;
      return existing;
    }
    const item = { id: this.nextId++, userId, productId, quantity };
    this.items.push(item);
    return item;
  }

  async setQuantity(userId: number, productId: number, quantity: number) {
    const existing = await this.find(userId, productId);
    if (existing) existing.quantity = quantity;
    return existing;
  }

  async remove(userId: number, productId: number) {
    const before = this.items.length;
    this.items = this.items.filter((i) => !(i.userId === userId && i.productId === productId));
    return this.items.length < before;
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  orders: Order[] = [];
  private nextId = 1;

  // Partage le panier pour reproduire « créer la commande + vider le panier ».
  constructor(private readonly carts: InMemoryCartRepository) {}

  async createFromCart(userId: number, status: OrderStatus, total: number, items: OrderItem[]) {
    const order: Order = { id: this.nextId++, userId, status, total, createdAt: new Date(), items };
    this.orders.push(order);
    this.carts.items = this.carts.items.filter((i) => i.userId !== userId);
    return order;
  }

  async listByUser(userId: number) {
    return this.orders.filter((o) => o.userId === userId).reverse();
  }

  async findByIdForUser(orderId: number, userId: number) {
    return this.orders.find((o) => o.id === orderId && o.userId === userId) ?? null;
  }
}

export class FakeCatalog implements CatalogClient {
  products = new Map<number, CatalogProduct>();
  calls: { id: number; token: string }[] = [];

  constructor(products: CatalogProduct[]) {
    products.forEach((p) => this.products.set(p.id, p));
  }

  async getProduct(id: number, token: string) {
    this.calls.push({ id, token });
    return this.products.get(id) ?? null;
  }
}

export class FakeRevocation implements RevocationChecker {
  revoked = new Set<string>();

  async assertNotRevoked(token: string) {
    if (this.revoked.has(token)) throw new HttpError(401, 'Token révoqué ou invalide');
  }
}
