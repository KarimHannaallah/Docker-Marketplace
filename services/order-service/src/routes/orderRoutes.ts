import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { CartService } from '../services/cartService';
import { type OrderService, toOrderJson } from '../services/orderService';
import { parsePositiveInt, parseAddToCart, parseQuantity } from '../validation';

export function orderRoutes(
  requireAuth: RequestHandler,
  cartService: CartService,
  orderService: OrderService,
): Router {
  const router = Router();
  router.use(requireAuth); // toutes les routes exigent un JWT valide

  // --- Panier (déclaré avant /:id pour que "cart" ne soit pas pris pour un id) ---

  router.get('/cart', async (req, res) => {
    const { userId, token } = req.auth!;
    res.json(await cartService.getCart(userId, token));
  });

  router.post('/cart', async (req, res) => {
    const { userId, token } = req.auth!;
    const { productId, quantity } = parseAddToCart(req.body);
    const item = await cartService.add(userId, token, productId, quantity);
    res.status(201).json({ product_id: item.productId, quantity: item.quantity });
  });

  router.patch('/cart/:productId', async (req, res) => {
    const { userId, token } = req.auth!;
    const productId = parsePositiveInt(req.params.productId, 'productId');
    const quantity = parseQuantity(req.body?.quantity);
    const item = await cartService.setQuantity(userId, token, productId, quantity);
    res.json({ product_id: item.productId, quantity: item.quantity });
  });

  router.delete('/cart/:productId', async (req, res) => {
    const productId = parsePositiveInt(req.params.productId, 'productId');
    await cartService.remove(req.auth!.userId, productId);
    res.status(204).end();
  });

  // --- Commandes ---

  router.post('/checkout', async (req, res) => {
    const { userId, token } = req.auth!;
    res.status(201).json(toOrderJson(await orderService.checkout(userId, token)));
  });

  router.get('/', async (req, res) => {
    res.json((await orderService.list(req.auth!.userId)).map(toOrderJson));
  });

  router.get('/:id', async (req, res) => {
    const id = parsePositiveInt(req.params.id, 'Identifiant');
    res.json(toOrderJson(await orderService.get(req.auth!.userId, id)));
  });

  return router;
}
