// Validation simple des entrées.
import { HttpError } from './errors';

const MAX_QUANTITY = 99;

export function parsePositiveInt(value: unknown, label: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n <= 0) {
    throw new HttpError(400, `${label} invalide`);
  }
  return n;
}

export function parseQuantity(value: unknown): number {
  const n = parsePositiveInt(value, 'Quantité');
  if (n > MAX_QUANTITY) throw new HttpError(400, `Quantité maximale : ${MAX_QUANTITY}`);
  return n;
}

export function parseAddToCart(body: unknown): { productId: number; quantity: number } {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    productId: parsePositiveInt(b.productId, 'productId'),
    quantity: b.quantity === undefined ? 1 : parseQuantity(b.quantity),
  };
}
