import express from 'express';
import type { RequestHandler } from 'express';
import { errorHandler, notFound } from './middleware/errorHandler';
import { orderRoutes } from './routes/orderRoutes';
import type { CartService } from './services/cartService';
import type { OrderService } from './services/orderService';

/** Construit l'application à partir de dépendances injectées (donc testable). */
export function createApp(
  requireAuth: RequestHandler,
  cartService: CartService,
  orderService: OrderService,
): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'order-service' });
  });
  app.use('/orders', orderRoutes(requireAuth, cartService, orderService));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
