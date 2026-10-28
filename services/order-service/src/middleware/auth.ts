import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RevocationChecker } from '../clients/tokenVerifier';
import { HttpError } from '../errors';

export interface AuthContext {
  userId: number;
  role: 'STANDARD' | 'ADMIN';
  token: string; // transmis à catalog-service
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/**
 * 1. vérifie signature et expiration du JWT localement (secret partagé, HS256) ;
 * 2. demande à auth-service si le token a été révoqué (logout).
 */
export function authenticate(jwtSecret: string, revocation: RevocationChecker): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentification requise');

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      if (typeof decoded === 'string') throw new Error('payload invalide');
      payload = decoded;
    } catch {
      throw new HttpError(401, 'Token invalide ou expiré');
    }

    const userId = Number(payload.sub);
    const validRole = payload.role === 'STANDARD' || payload.role === 'ADMIN';
    if (!Number.isInteger(userId) || !validRole) throw new HttpError(401, 'Token invalide');

    await revocation.assertNotRevoked(token);
    req.auth = { userId, role: payload.role, token };
    next();
  };
}
