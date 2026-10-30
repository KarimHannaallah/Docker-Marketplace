// Validation simple des entrées, sans librairie externe.
import { HttpError } from './errors';

const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_BYTES = 72; // limite de bcrypt

// regex avec des longueurs maximales (local ≤ 64, domaine ≤ 190, suffixe ≤ 63) :
// le temps de traitement reste borné quelle que soit l'entrée.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseRegister(body: unknown): { name: string; email: string; password: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = asString(b.name).trim();
  const rawEmail = asString(b.email);
  const password = asString(b.password);

  if (name.length < 1 || name.length > 100) throw new HttpError(400, 'Nom invalide (1 à 100 caractères)');
  // longueur vérifiée avant la regex, et même avant trim/toLowerCase
  if (rawEmail.length > MAX_EMAIL_LENGTH) throw new HttpError(400, 'Email invalide');
  const email = rawEmail.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) throw new HttpError(400, 'Email invalide');
  if (password.length < 8 || password.length > MAX_PASSWORD_BYTES || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    throw new HttpError(400, 'Mot de passe invalide (8 à 72 caractères)');
  }
  return { name, email, password };
}

export function parseLogin(body: unknown): { email: string; password: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawEmail = asString(b.email);
  const password = asString(b.password);
  // aucun compte n'a un email ou un mot de passe plus long : on rejette avant la base et bcrypt
  if (rawEmail.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_BYTES) {
    throw new HttpError(400, 'Email ou mot de passe invalide');
  }
  const email = rawEmail.trim().toLowerCase();
  if (!email || !password) throw new HttpError(400, 'Email et mot de passe requis');
  return { email, password };
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide');
  return id;
}
