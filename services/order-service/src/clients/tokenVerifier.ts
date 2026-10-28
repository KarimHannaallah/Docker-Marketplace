// Vérification de la révocation d'un token auprès d'auth-service. Injectable pour les tests.
import { HttpError } from '../errors';

export interface RevocationChecker {
  /** Lance une HttpError 401 si le token est révoqué (ou invalide pour auth-service). */
  assertNotRevoked(token: string): Promise<void>;
}

export class HttpRevocationChecker implements RevocationChecker {
  constructor(private readonly authServiceUrl: string) {}

  async assertNotRevoked(token: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.authServiceUrl}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new HttpError(503, "Service d'authentification indisponible");
    }
    if (response.status !== 200) throw new HttpError(401, 'Token révoqué ou invalide');
  }
}
