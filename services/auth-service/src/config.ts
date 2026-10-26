// Toute la configuration vient des variables d'environnement.
import type { SignOptions } from 'jsonwebtoken';

export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: SignOptions['expiresIn'];
  bcryptRounds: number;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.AUTH_PORT ?? 3001),
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    jwtExpiresIn: (env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'],
    bcryptRounds: 10,
    adminEmail: required(env, 'ADMIN_EMAIL'),
    adminPassword: required(env, 'ADMIN_PASSWORD'),
    adminName: env.ADMIN_NAME ?? 'Administrateur',
  };
}
