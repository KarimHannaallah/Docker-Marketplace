import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import type { RateLimiters } from '../middleware/rateLimit';
import type { AuthService } from '../services/authService';
import { parseLogin, parseRegister } from '../validation';

export function authRoutes(service: AuthService, limiters: RateLimiters): Router {
  const router = Router();
  const requireAuth = authenticate(service);

  // Limite générale sur toutes les routes de ce router (déclarée AVANT les routes).
  router.use(limiters.general);

  // Limite stricte en plus sur les deux routes sensibles au brute force et à la création de comptes en masse.
  router.post('/register', limiters.strict, async (req, res) => {
    const { name, email, password } = parseRegister(req.body);
    res.status(201).json(await service.register(name, email, password));
  });

  router.post('/login', limiters.strict, async (req, res) => {
    const { email, password } = parseLogin(req.body);
    res.json(await service.login(email, password));
  });

  router.post('/logout', requireAuth, async (req, res) => {
    await service.logout(req.auth!);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json(await service.getProfile(req.auth!));
  });

  router.delete('/me', requireAuth, async (req, res) => {
    await service.deleteOwnAccount(req.auth!);
    res.status(204).end();
  });

  // Appelé par les autres services pour vérifier que le token n'est pas révoqué.
  router.get('/verify', requireAuth, (req, res) => {
    res.json({ sub: String(req.auth!.userId), role: req.auth!.role });
  });

  return router;
}
