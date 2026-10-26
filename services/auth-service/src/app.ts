import express from 'express';
import { errorHandler, notFound } from './middleware/errorHandler';
import { adminRoutes } from './routes/adminRoutes';
import { authRoutes } from './routes/authRoutes';
import type { AuthService } from './services/authService';

/** Construit l'application Express à partir d'un service (injecté, donc testable). */
export function createApp(service: AuthService): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth-service' });
  });
  app.use('/auth', authRoutes(service));
  app.use('/admin', adminRoutes(service));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
