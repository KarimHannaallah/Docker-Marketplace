import type { Pool } from 'pg';
import type { Order, OrderItem, OrderRepository, OrderStatus } from './types';

interface OrderRow {
  id: number;
  user_id: number;
  status: OrderStatus;
  total: string; // NUMERIC est renvoyé en chaîne par pg
  created_at: Date;
}

interface ItemRow {
  order_id: number;
  product_id: number;
  quantity: number;
  price_at_purchase: string;
}

const toItem = (r: ItemRow): OrderItem => ({
  productId: r.product_id,
  quantity: r.quantity,
  priceAtPurchase: Number(r.price_at_purchase),
});

const toOrder = (r: OrderRow, items: OrderItem[]): Order => ({
  id: r.id,
  userId: r.user_id,
  status: r.status,
  total: Number(r.total),
  createdAt: r.created_at,
  items,
});

export class PgOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async createFromCart(
    userId: number,
    status: OrderStatus,
    total: number,
    items: OrderItem[],
  ): Promise<Order> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OrderRow>(
        'INSERT INTO orders.orders (user_id, status, total) VALUES ($1, $2, $3) RETURNING *',
        [userId, status, total],
      );
      for (const item of items) {
        await client.query(
          `INSERT INTO orders.order_items (order_id, product_id, quantity, price_at_purchase)
           VALUES ($1, $2, $3, $4)`,
          [rows[0].id, item.productId, item.quantity, item.priceAtPurchase],
        );
      }
      await client.query('DELETE FROM orders.cart_items WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return toOrder(rows[0], items);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listByUser(userId: number): Promise<Order[]> {
    const { rows } = await this.pool.query<OrderRow>(
      'SELECT * FROM orders.orders WHERE user_id = $1 ORDER BY id DESC',
      [userId],
    );
    return Promise.all(rows.map(async (row) => toOrder(row, await this.itemsOf(row.id))));
  }

  async findByIdForUser(orderId: number, userId: number): Promise<Order | null> {
    const { rows } = await this.pool.query<OrderRow>(
      'SELECT * FROM orders.orders WHERE id = $1 AND user_id = $2',
      [orderId, userId],
    );
    return rows[0] ? toOrder(rows[0], await this.itemsOf(rows[0].id)) : null;
  }

  private async itemsOf(orderId: number): Promise<OrderItem[]> {
    const { rows } = await this.pool.query<ItemRow>(
      'SELECT * FROM orders.order_items WHERE order_id = $1 ORDER BY id',
      [orderId],
    );
    return rows.map(toItem);
  }
}
