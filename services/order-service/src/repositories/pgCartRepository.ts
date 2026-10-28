import type { Pool } from 'pg';
import type { CartItem, CartRepository } from './types';

interface CartRow {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
}

const toItem = (r: CartRow): CartItem => ({
  id: r.id,
  userId: r.user_id,
  productId: r.product_id,
  quantity: r.quantity,
});

export class PgCartRepository implements CartRepository {
  constructor(private readonly pool: Pool) {}

  async list(userId: number): Promise<CartItem[]> {
    const { rows } = await this.pool.query<CartRow>(
      'SELECT * FROM orders.cart_items WHERE user_id = $1 ORDER BY id',
      [userId],
    );
    return rows.map(toItem);
  }

  async find(userId: number, productId: number): Promise<CartItem | null> {
    const { rows } = await this.pool.query<CartRow>(
      'SELECT * FROM orders.cart_items WHERE user_id = $1 AND product_id = $2',
      [userId, productId],
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  async addOrIncrement(userId: number, productId: number, quantity: number): Promise<CartItem> {
    // La contrainte unique (user_id, product_id) permet un "upsert" atomique.
    const { rows } = await this.pool.query<CartRow>(
      `INSERT INTO orders.cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = orders.cart_items.quantity + EXCLUDED.quantity, updated_at = now()
       RETURNING *`,
      [userId, productId, quantity],
    );
    return toItem(rows[0]);
  }

  async setQuantity(userId: number, productId: number, quantity: number): Promise<CartItem | null> {
    const { rows } = await this.pool.query<CartRow>(
      `UPDATE orders.cart_items SET quantity = $3, updated_at = now()
       WHERE user_id = $1 AND product_id = $2 RETURNING *`,
      [userId, productId, quantity],
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  async remove(userId: number, productId: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM orders.cart_items WHERE user_id = $1 AND product_id = $2',
      [userId, productId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
