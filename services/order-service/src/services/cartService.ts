import type { CatalogClient, CatalogProduct } from '../clients/catalogClient';
import { HttpError } from '../errors';
import type { CartRepository } from '../repositories/types';

export interface CartLine {
  product_id: number;
  quantity: number;
  /** null si le produit n'existe plus ou a été désactivé dans le catalogue. */
  product: CatalogProduct | null;
  line_total: number;
}

export interface Cart {
  items: CartLine[];
  total: number;
}

/** Calculs en centimes pour éviter les erreurs d'arrondi des flottants. */
export const toCents = (price: number): number => Math.round(price * 100);

export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CatalogClient,
  ) {}

  /** Panier enrichi avec nom, prix et stock actuels (récupérés auprès du catalogue). */
  async getCart(userId: number, token: string): Promise<Cart> {
    const rows = await this.carts.list(userId);
    const items = await Promise.all(
      rows.map(async (row): Promise<CartLine> => {
        const product = await this.catalog.getProduct(row.productId, token);
        const cents = product ? toCents(product.price) * row.quantity : 0;
        return { product_id: row.productId, quantity: row.quantity, product, line_total: cents / 100 };
      }),
    );
    const totalCents = items.reduce((sum, line) => sum + Math.round(line.line_total * 100), 0);
    return { items, total: totalCents / 100 };
  }

  /** Ajoute un produit, ou incrémente sa quantité s'il est déjà dans le panier. */
  async add(userId: number, token: string, productId: number, quantity: number) {
    const product = await this.requireProduct(productId, token);
    const existing = await this.carts.find(userId, productId);
    this.assertStock(product, (existing?.quantity ?? 0) + quantity);
    return this.carts.addOrIncrement(userId, productId, quantity);
  }

  async setQuantity(userId: number, token: string, productId: number, quantity: number) {
    if (!(await this.carts.find(userId, productId))) {
      throw new HttpError(404, "Ce produit n'est pas dans le panier");
    }
    const product = await this.requireProduct(productId, token);
    this.assertStock(product, quantity);
    return (await this.carts.setQuantity(userId, productId, quantity))!;
  }

  async remove(userId: number, productId: number): Promise<void> {
    if (!(await this.carts.remove(userId, productId))) {
      throw new HttpError(404, "Ce produit n'est pas dans le panier");
    }
  }

  private async requireProduct(productId: number, token: string): Promise<CatalogProduct> {
    const product = await this.catalog.getProduct(productId, token);
    if (!product) throw new HttpError(404, 'Produit introuvable');
    return product;
  }

  private assertStock(product: CatalogProduct, wanted: number): void {
    if (wanted > product.stock) {
      throw new HttpError(409, `Stock insuffisant pour « ${product.name} » (disponible : ${product.stock})`);
    }
  }
}
