import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import type { RateLimiters } from '../middleware/rateLimit';
import type { AuthService } from '../services/authService';
import { parseId } from '../validation';

export function adminRoutes(service: AuthService, limiters: RateLimiters): Router {
  const router = Router();
  // avant authenticate : les requêtes sans token comptent aussi dans la limite
  router.use(limiters.general);
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
