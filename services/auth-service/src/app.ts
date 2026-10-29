import express from 'express';
import type { RateLimitConfig } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';
import { createRateLimiters } from './middleware/rateLimit';
import { adminRoutes } from './routes/adminRoutes';
import { authRoutes } from './routes/authRoutes';
import type { AuthService } from './services/authService';

/** Construit l'application Express à partir d'un service (injecté, donc testable). */
export function createApp(service: AuthService, rateLimit: RateLimitConfig): express.Express {
  const app = express();

  // Le service est derrière UN proxy (nginx) : l'adresse du client vient de X-Forwarded-For, que nginx renseigne.
  // Sans cela, toutes les requêtes auraient l'adresse de nginx et partageraient la même limite.
  // La valeur 1 (un seul proxy de confiance) empêche un client de falsifier son IP en envoyant lui-même
  // un en-tête X-Forwarded-For : Express ne retient que l'adresse ajoutée par nginx.
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
