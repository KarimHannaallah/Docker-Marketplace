import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import type { RateLimiters } from '../middleware/rateLimit';
import type { AuthService } from '../services/authService';
import { parseId } from '../validation';

export function adminRoutes(service: AuthService, limiters: RateLimiters): Router {
  const router = Router();
  // La limite passe AVANT l'authentification : une requête sans token compte aussi (sinon on pourrait
  // solliciter la base sans limite en envoyant des tokens invalides).
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
