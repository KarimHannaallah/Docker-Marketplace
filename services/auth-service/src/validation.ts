// Validation simple des entrées, sans librairie externe.
import { HttpError } from './errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseRegister(body: unknown): { name: string; email: string; password: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = asString(b.name).trim();
  const email = asString(b.email).trim().toLowerCase();
  const password = asString(b.password);

  if (name.length < 1 || name.length > 100) throw new HttpError(400, 'Nom invalide (1 à 100 caractères)');
  if (!EMAIL_RE.test(email) || email.length > 255) throw new HttpError(400, 'Email invalide');
  // 72 octets : limite de bcrypt
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    throw new HttpError(400, 'Mot de passe invalide (8 à 72 caractères)');
  }
  return { name, email, password };
}

export function parseLogin(body: unknown): { email: string; password: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = asString(b.email).trim().toLowerCase();
  const password = asString(b.password);
  if (!email || !password) throw new HttpError(400, 'Email et mot de passe requis');
  return { email, password };
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide');
  return id;
}
