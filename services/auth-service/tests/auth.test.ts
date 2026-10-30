import request from 'supertest';
import { createApp } from '../src/app';
import type { Config } from '../src/config';
import { AuthService } from '../src/services/authService';
import { InMemoryTokenRepository, InMemoryUserRepository } from './memoryRepositories';

const config: Config = {
  port: 0,
  databaseUrl: 'unused',
  jwtSecret: 'test-secret',
  jwtExpiresIn: '1h',
  bcryptRounds: 4, // rapide pour les tests
  // limites très hautes : la limitation est testée à part, dans rateLimit.test.ts
  rateLimit: { windowMs: 60_000, max: 100_000, authMax: 100_000 },
  adminEmail: 'admin@test.com',
  adminPassword: 'admin-password',
  adminName: 'Admin',
};

let app: ReturnType<typeof createApp>;
let service: AuthService;

beforeEach(async () => {
  service = new AuthService(new InMemoryUserRepository(), new InMemoryTokenRepository(), config);
  await service.ensureAdmin();
  app = createApp(service, config.rateLimit);
});

async function register(email: string, password = 'password123', name = 'Alice') {
  return request(app).post('/auth/register').send({ name, email, password });
}

async function login(email: string, password = 'password123'): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.token;
}

describe('health', () => {
  it('répond ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('register', () => {
  it('crée un compte STANDARD sans exposer le hash', async () => {
    const res = await register('alice@test.com');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Alice', email: 'alice@test.com', role: 'STANDARD' });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);
  });

  it('ignore un rôle ADMIN demandé par le client', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Eve', email: 'eve@test.com', password: 'password123', role: 'ADMIN' });
    expect(res.body.role).toBe('STANDARD');
  });

  it('refuse un email déjà utilisé (409)', async () => {
    await register('alice@test.com');
    expect((await register('ALICE@test.com')).status).toBe(409);
  });

  it('valide les entrées (400)', async () => {
    expect((await register('pas-un-email')).status).toBe(400);
    expect((await register('bob@test.com', 'court')).status).toBe(400);
    expect((await register('bob@test.com', 'password123', '')).status).toBe(400);
  });
});

describe('login', () => {
  it('retourne un token pour des identifiants valides', async () => {
    await register('alice@test.com');
    const res = await request(app).post('/auth/login').send({ email: 'alice@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('alice@test.com');
    expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
  });

  it('refuse un mauvais mot de passe ou un email inconnu (401)', async () => {
    await register('alice@test.com');
    expect((await request(app).post('/auth/login').send({ email: 'alice@test.com', password: 'faux-mdp-12' })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: 'inconnu@test.com', password: 'password123' })).status).toBe(401);
  });

  it('GET /auth/me retourne le profil avec un token valide', async () => {
    await register('alice@test.com');
    const token = await login('alice@test.com');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.com');
  });

  it('refuse les requêtes sans token ou avec un token falsifié (401)', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me').set('Authorization', 'Bearer n-importe-quoi')).status).toBe(401);
  });
});

describe('logout', () => {
  it('révoque le token : il est refusé ensuite', async () => {
    await register('alice@test.com');
    const token = await login('alice@test.com');
    const auth = { Authorization: `Bearer ${token}` };

    expect((await request(app).get('/auth/verify').set(auth)).status).toBe(200);
    expect((await request(app).post('/auth/logout').set(auth)).status).toBe(204);
    expect((await request(app).get('/auth/verify').set(auth)).status).toBe(401);
    expect((await request(app).get('/auth/me').set(auth)).status).toBe(401);
  });

  it('un nouveau login après logout donne un token valide', async () => {
    await register('alice@test.com');
    const first = await login('alice@test.com');
    await request(app).post('/auth/logout').set('Authorization', `Bearer ${first}`);
    const second = await login('alice@test.com');
    expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${second}`)).status).toBe(200);
  });
});

describe('suppression de son propre compte', () => {
  it('supprime le compte et invalide le token', async () => {
    await register('alice@test.com');
    const token = await login('alice@test.com');
    const auth = { Authorization: `Bearer ${token}` };

    expect((await request(app).delete('/auth/me').set(auth)).status).toBe(204);
    expect((await request(app).get('/auth/me').set(auth)).status).toBe(401);
    // le compte n'existe plus : impossible de se reconnecter
    expect((await request(app).post('/auth/login').send({ email: 'alice@test.com', password: 'password123' })).status).toBe(401);
  });
});

describe('droits administrateur', () => {
  async function adminToken() {
    return login('admin@test.com', 'admin-password');
  }

  it('le seed est idempotent', async () => {
    expect(await service.ensureAdmin()).toBe(false);
    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.body.filter((u: { role: string }) => u.role === 'ADMIN')).toHaveLength(1);
  });

  it('401 sans token', async () => {
    expect((await request(app).get('/admin/users')).status).toBe(401);
    expect((await request(app).delete('/admin/users/1')).status).toBe(401);
  });

  it('403 pour un utilisateur STANDARD', async () => {
    await register('alice@test.com');
    const token = await login('alice@test.com');
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).get('/admin/users').set(auth)).status).toBe(403);
    expect((await request(app).delete('/admin/users/1').set(auth)).status).toBe(403);
  });

  it('un ADMIN liste les utilisateurs sans hash', async () => {
    await register('alice@test.com');
    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
  });

  it('204 : un ADMIN supprime un compte STANDARD, dont le token devient invalide', async () => {
    const created = await register('alice@test.com');
    const aliceToken = await login('alice@test.com');

    const res = await request(app)
      .delete(`/admin/users/${created.body.id}`)
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(204);
    expect((await request(app).get('/auth/verify').set('Authorization', `Bearer ${aliceToken}`)).status).toBe(401);
  });

  it('403 : un ADMIN ne peut pas supprimer un ADMIN', async () => {
    const token = await adminToken();
    const users = await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`);
    const adminId = users.body.find((u: { role: string }) => u.role === 'ADMIN').id;
    const res = await request(app).delete(`/admin/users/${adminId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('404 si le compte n\'existe pas, 400 si l\'id est invalide', async () => {
    const auth = { Authorization: `Bearer ${await adminToken()}` };
    expect((await request(app).delete('/admin/users/9999').set(auth)).status).toBe(404);
    expect((await request(app).delete('/admin/users/abc').set(auth)).status).toBe(400);
  });
});
