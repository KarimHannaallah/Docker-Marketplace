import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../errors';
import type { AuthContext, AuthService } from '../services/authService';

// On attache le contexte d'authentification à la requête.
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** Exige un header `Authorization: Bearer <token>` valide et non révoqué. */
export function authenticate(service: AuthService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentification requise');
    req.auth = await service.authenticate(token);
    next();
  };
}

/** À placer après `authenticate` : réserve la route aux ADMIN (403 sinon). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'ADMIN') throw new HttpError(403, 'Droits administrateur requis');
  next();
};
