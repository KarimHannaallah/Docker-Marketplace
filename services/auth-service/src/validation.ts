// Validation simple des entrées, sans librairie externe.
import { HttpError } from './errors';

const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_BYTES = 72; // limite de bcrypt

// Expression BORNÉE : chaque partie a une longueur maximale (local ≤ 64, domaine ≤ 190, suffixe ≤ 63).
// Avec des quantificateurs non bornés (+), une chaîne très longue et bien choisie ferait travailler la regex
// pendant très longtemps (ReDoS) ; ici le travail est borné quelle que soit l'entrée.
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
  // La longueur est vérifiée AVANT la regex (et même avant trim/toLowerCase) : une entrée géante est rejetée sans traitement.
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
  // Aucun compte ne peut avoir un email ou un mot de passe plus long que ces limites (voir parseRegister) :
  // on rejette tout de suite les entrées géantes au lieu de les passer à la base ou à bcrypt.
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
