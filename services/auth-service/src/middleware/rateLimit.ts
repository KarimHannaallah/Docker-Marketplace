import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { RateLimitConfig } from '../config';

export interface RateLimiters {
  /** limite générale, appliquée à toutes les routes d'un router */
  general: RequestHandler;
  /** limite stricte, pour les routes sensibles au brute force (/register et /login) */
  strict: RequestHandler;
}

/**
 * catalog-service et order-service appellent GET /auth/verify à CHAQUE requête authentifiée pour vérifier la
 * révocation du token. Ces appels viennent tous de la même adresse (celle du service) : les compter dans la limite
 * par IP bloquerait toute l'application après quelques dizaines de requêtes.
 *
 * On les reconnaît à l'absence de l'en-tête X-Forwarded-For : nginx l'ajoute à TOUTES les requêtes venant des
 * clients, alors qu'un appel interne entre services ne passe pas par nginx. Un client externe ne peut pas se faire
 * passer pour un appel interne : la route reste donc limitée quand elle est appelée depuis l'extérieur.
 */
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
