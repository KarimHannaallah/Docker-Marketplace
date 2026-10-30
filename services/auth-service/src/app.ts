import express from 'express';
import type { RateLimitConfig } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';
import { createRateLimiters } from './middleware/rateLimit';
import { adminRoutes } from './routes/adminRoutes';
import { authRoutes } from './routes/authRoutes';
import type { AuthService } from './services/authService';

/** Application Express ; le service est injecté pour pouvoir le remplacer dans les tests. */
export function createApp(service: AuthService, rateLimit: RateLimitConfig): express.Express {
  const app = express();

  // derrière nginx (un seul proxy) : l'IP du client vient de X-Forwarded-For.
  // avec 1 proxy de confiance, seule l'adresse ajoutée par nginx est retenue (non falsifiable).
  app.set('trust proxy', 1);

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth-service' });
  });

  const limiters = createRateLimiters(rateLimit);
  app.use('/auth', authRoutes(service, limiters));
  app.use('/admin', adminRoutes(service, limiters));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
