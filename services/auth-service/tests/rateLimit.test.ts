import request from 'supertest';
import { createApp } from '../src/app';
import type { Config, RateLimitConfig } from '../src/config';
import { AuthService } from '../src/services/authService';
import { InMemoryTokenRepository, InMemoryUserRepository } from './memoryRepositories';

function baseConfig(rateLimit: RateLimitConfig): Config {
  return {
    port: 0,
    databaseUrl: 'unused',
    jwtSecret: 'test-secret-with-at-least-32-bytes-ok',
    jwtExpiresIn: '1h',
    bcryptRounds: 4,
    rateLimit,
    adminEmail: 'admin@test.com',
    adminPassword: 'admin-password',
    adminName: 'Admin',
  };
}

/** Application neuve (compteurs à zéro) avec les limites données. */
async function makeApp(rateLimit: RateLimitConfig) {
  const config = baseConfig(rateLimit);
  const service = new AuthService(new InMemoryUserRepository(), new InMemoryTokenRepository(), config);
  await service.ensureAdmin();
  return createApp(service, config.rateLimit);
}

const WINDOW = 60_000;
const attemptLogin = (app: Awaited<ReturnType<typeof makeApp>>, ip?: string) => {
  const req = request(app).post('/auth/login');
  if (ip) req.set('X-Forwarded-For', ip);
  return req.send({ email: 'inconnu@test.com', password: 'mauvais-mdp-1' });
};

describe('limite stricte sur /auth/login et /auth/register', () => {
  it('répond 429 après AUTH_RATE_LIMIT_MAX tentatives de login', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1000, authMax: 3 });

    for (let i = 0; i < 3; i++) expect((await attemptLogin(app)).status).toBe(401); // autorisées, identifiants faux
    const blocked = await attemptLogin(app);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Trop de requêtes, réessayez plus tard' });
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['ratelimit']).toBeDefined();
  });

  it('répond 429 après AUTH_RATE_LIMIT_MAX créations de compte', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1000, authMax: 2 });
    const register = (n: number) =>
      request(app).post('/auth/register').send({ name: 'Al', email: `al${n}@test.com`, password: 'password123' });

    expect((await register(1)).status).toBe(201);
    expect((await register(2)).status).toBe(201);
    expect((await register(3)).status).toBe(429);
  });

  it('login et register partagent la même limite stricte', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1000, authMax: 2 });
    await attemptLogin(app);
    await attemptLogin(app);
    const res = await request(app).post('/auth/register').send({ name: 'Al', email: 'al@test.com', password: 'password123' });
    expect(res.status).toBe(429);
  });

  it('ne limite pas les autres routes avec la limite stricte', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1000, authMax: 1 });
    await attemptLogin(app);
    expect((await attemptLogin(app)).status).toBe(429);
    // /auth/me n'est soumise qu'à la limite générale (ici très haute) : 401 sans token, pas 429
    expect((await request(app).get('/auth/me')).status).toBe(401);
  });
});

describe('limite par adresse IP (derrière nginx)', () => {
  it("compte chaque client séparément d'après X-Forwarded-For", async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1000, authMax: 2 });

    await attemptLogin(app, '203.0.113.10');
    await attemptLogin(app, '203.0.113.10');
    expect((await attemptLogin(app, '203.0.113.10')).status).toBe(429); // ce client est bloqué...
    expect((await attemptLogin(app, '203.0.113.20')).status).toBe(401); // ...pas les autres
  });

  it('ignore une fausse adresse envoyée par le client : seule celle ajoutée par le proxy compte', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1000, authMax: 2 });
    // nginx ajoute l'adresse réelle à droite ; le client ne contrôle que la partie gauche.
    const call = (spoofed: string) =>
      request(app).post('/auth/login').set('X-Forwarded-For', `${spoofed}, 198.51.100.7`).send({ email: 'x@test.com', password: 'mauvais-mdp-1' });

    await call('1.1.1.1');
    await call('2.2.2.2');
    expect((await call('3.3.3.3')).status).toBe(429); // changer la fausse adresse ne contourne pas la limite
  });
});

describe('limite générale', () => {
  it('répond 429 sur les routes /auth après RATE_LIMIT_MAX requêtes', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 3, authMax: 1000 });

    for (let i = 0; i < 3; i++) expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me')).status).toBe(429);
  });

  it('répond 429 sur les routes /admin, y compris pour les requêtes sans token', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 2, authMax: 1000 });

    expect((await request(app).get('/admin/users')).status).toBe(401);
    expect((await request(app).get('/admin/users')).status).toBe(401);
    expect((await request(app).get('/admin/users')).status).toBe(429); // la limite passe avant l'authentification
  });

  it("ne limite pas /health", async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 1, authMax: 1 });
    for (let i = 0; i < 5; i++) expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('appels internes à GET /auth/verify', () => {
  async function loginAdmin(app: Awaited<ReturnType<typeof makeApp>>) {
    const res = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'admin-password' });
    return res.body.token as string;
  }

  it('ne sont jamais limités quand ils viennent d\'un autre service (sans X-Forwarded-For)', async () => {
    // catalog-service et order-service appellent /verify à chaque requête utilisateur.
    const app = await makeApp({ windowMs: WINDOW, max: 2, authMax: 1000 });
    const token = await loginAdmin(app);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/auth/verify').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it('restent limités quand ils arrivent par nginx (avec X-Forwarded-For)', async () => {
    const app = await makeApp({ windowMs: WINDOW, max: 2, authMax: 1000 });
    const token = await loginAdmin(app);
    const external = () =>
      request(app).get('/auth/verify').set('X-Forwarded-For', '203.0.113.50').set('Authorization', `Bearer ${token}`);

    expect((await external()).status).toBe(200);
    expect((await external()).status).toBe(200);
    expect((await external()).status).toBe(429);
  });
});
