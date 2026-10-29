// Toute la configuration vient des variables d'environnement.
import type { SignOptions } from 'jsonwebtoken';

/** Limitation du nombre de requêtes par adresse IP (protection contre le brute force et les abus). */
export interface RateLimitConfig {
  /** durée de la fenêtre de comptage, en millisecondes */
  windowMs: number;
  /** requêtes maximum par IP et par fenêtre, sur l'ensemble des routes */
  max: number;
  /** requêtes maximum par IP et par fenêtre sur /auth/register et /auth/login (plus strict) */
  authMax: number;
}

export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: SignOptions['expiresIn'];
  bcryptRounds: number;
  rateLimit: RateLimitConfig;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
  return value;
}

/** Lit un entier strictement positif ; une valeur invalide fait échouer le démarrage plutôt que d'être ignorée. */
function positiveInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} doit être un entier strictement positif (reçu : ${raw})`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.AUTH_PORT ?? 3001),
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    jwtExpiresIn: (env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'],
    bcryptRounds: 10,
    rateLimit: {
      windowMs: positiveInt(env, 'RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
      max: positiveInt(env, 'RATE_LIMIT_MAX', 100),
      authMax: positiveInt(env, 'AUTH_RATE_LIMIT_MAX', 10),
    },
    adminEmail: required(env, 'ADMIN_EMAIL'),
    adminPassword: required(env, 'ADMIN_PASSWORD'),
    adminName: env.ADMIN_NAME ?? 'Administrateur',
  };
}
