// Toute la configuration vient des variables d'environnement.
export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  authServiceUrl: string;
  catalogServiceUrl: string;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.ORDER_PORT ?? 3002),
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    authServiceUrl: env.AUTH_SERVICE_URL ?? 'http://auth-service:3001',
    catalogServiceUrl: env.CATALOG_SERVICE_URL ?? 'http://catalog-service:8000',
  };
}
