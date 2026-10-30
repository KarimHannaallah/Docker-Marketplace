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

// une adresse invalide, ou qui n'est pas en http(s), fait échouer le démarrage
function httpUrl(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key] ?? fallback;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} n'est pas une URL valide : ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${key} doit commencer par http:// ou https:// (reçu : ${url.protocol})`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.ORDER_PORT ?? 3002),
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret: required(env, 'JWT_SECRET'),
    authServiceUrl: httpUrl(env, 'AUTH_SERVICE_URL', 'http://auth-service:3001'),
    catalogServiceUrl: httpUrl(env, 'CATALOG_SERVICE_URL', 'http://catalog-service:8000'),
  };
}
