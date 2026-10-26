import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import type { AuthService } from '../services/authService';
import { parseId } from '../validation';

export function adminRoutes(service: AuthService): Router {
  const router = Router();
  router.use(authenticate(service), requireAdmin);

  router.get('/users', async (_req, res) => {
    res.json(await service.listUsers());
  });

  router.delete('/users/:id', async (req, res) => {
    await service.deleteUserAsAdmin(parseId(String(req.params.id)));
    res.status(204).end();
  });

  return router;
}
