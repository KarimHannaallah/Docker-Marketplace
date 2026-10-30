import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { RateLimitConfig } from '../config';

export interface RateLimiters {
  /** limite appliquée à toutes les routes d'un router */
  general: RequestHandler;
  /** limite plus stricte pour /register et /login */
  strict: RequestHandler;
}

// catalog et order appellent GET /auth/verify à chaque requête : ces appels internes ne sont pas comptés.
// on les reconnaît à l'absence de X-Forwarded-For, que nginx ajoute aux requêtes des clients.
function isInternalVerifyCall(req: Request): boolean {
  return req.path === '/verify' && req.headers['x-forwarded-for'] === undefined;
}

export function createRateLimiters(config: RateLimitConfig): RateLimiters {
  const common = {
    windowMs: config.windowMs,
    standardHeaders: 'draft-7' as const, // en-têtes RateLimit et Retry-After
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, réessayez plus tard' }, // même format d'erreur que le reste de l'API
  };

  return {
    general: rateLimit({ ...common, limit: config.max, skip: isInternalVerifyCall }),
    strict: rateLimit({ ...common, limit: config.authMax }),
  };
}
