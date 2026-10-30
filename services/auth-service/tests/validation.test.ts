import request from 'supertest';
import { createApp } from '../src/app';
import type { Config } from '../src/config';
import { AuthService } from '../src/services/authService';
import { parseLogin, parseRegister } from '../src/validation';
import { InMemoryTokenRepository, InMemoryUserRepository } from './memoryRepositories';

const config: Config = {
  port: 0,
  databaseUrl: 'unused',
  jwtSecret: 'test-secret-with-at-least-32-bytes-ok',
  jwtExpiresIn: '1h',
  bcryptRounds: 4,
  rateLimit: { windowMs: 60_000, max: 100_000, authMax: 100_000 },
  adminEmail: 'admin@test.com',
  adminPassword: 'admin-password',
  adminName: 'Admin',
};

const app = createApp(new AuthService(new InMemoryUserRepository(), new InMemoryTokenRepository(), config), config.rateLimit);
const registerWith = (email: string) =>
  request(app).post('/auth/register').send({ name: 'Al', email, password: 'password123' });

// réponse quasi immédiate : bien en dessous d'une seconde
const FAST_MS = 1000;

describe("validation de l'email : longueurs bornées (ReDoS)", () => {
  const hugeInputs: Record<string, string> = {
    'une chaîne de 100 000 caractères sans @': 'a'.repeat(100_000),
    'un "@" suivi de 50 000 groupes "a."': 'a@' + 'a.'.repeat(50_000),
    'un domaine de 100 000 caractères': 'a@' + 'b'.repeat(100_000) + '.com',
    'des milliers de "@"': '@'.repeat(100_000),
  };

  it.each(Object.entries(hugeInputs))('rejette en 400 et rapidement : %s (inscription)', async (_label, email) => {
    const start = Date.now();
    const res = await registerWith(email);
    expect(res.status).toBe(400);
    expect(Date.now() - start).toBeLessThan(FAST_MS);
  });

  it('rejette en 400 et rapidement un email géant à la connexion', async () => {
    const start = Date.now();
    const res = await request(app).post('/auth/login').send({ email: 'a'.repeat(100_000), password: 'password123' });
    expect(res.status).toBe(400);
    expect(Date.now() - start).toBeLessThan(FAST_MS);
  });

  it('vérifie la longueur avant la regex : une entrée géante ne la traverse jamais', () => {
    const testSpy = jest.spyOn(RegExp.prototype, 'test');
    expect(() => parseRegister({ name: 'Al', email: 'a'.repeat(100_000), password: 'password123' })).toThrow();
    expect(testSpy).not.toHaveBeenCalled();
    testSpy.mockRestore();
  });

  it("n'a plus de temps de calcul explosif, même sur une entrée de 255 caractères pathologique", () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      try {
        parseRegister({ name: 'Al', email: ('a@' + 'a.'.repeat(126)).slice(0, 255), password: 'password123' });
      } catch {
        /* attendu ou non, seul le temps compte */
      }
    }
    expect(Date.now() - start).toBeLessThan(FAST_MS * 2);
  });

  it('accepte toujours des emails valides, y compris aux limites autorisées', async () => {
    expect(parseRegister({ name: 'Al', email: 'al@test.com', password: 'password123' }).email).toBe('al@test.com');
    expect(parseRegister({ name: 'Al', email: 'prenom.nom+tag@sous.domaine.example.fr', password: 'password123' }).email).toBe(
      'prenom.nom+tag@sous.domaine.example.fr',
    );
    const longest = 'a'.repeat(64) + '@' + 'b'.repeat(120) + '.com'; // partie locale de 64 caractères : le maximum
    expect((await registerWith(longest)).status).toBe(201);
  });

  it('refuse un email dont une partie dépasse sa limite', async () => {
    expect((await registerWith('a'.repeat(65) + '@test.com')).status).toBe(400); // partie locale trop longue
    expect((await registerWith('a@' + 'b'.repeat(191) + '.com')).status).toBe(400); // domaine trop long
    expect((await registerWith('a@test.' + 'c'.repeat(64))).status).toBe(400); // suffixe trop long
    expect((await registerWith('a'.repeat(250) + '@b.co')).status).toBe(400); // partie locale de 250 caractères (255 au total)
    expect((await registerWith('a'.repeat(300) + '@b.co')).status).toBe(400); // plus de 255 caractères au total
  });

  it('continue de refuser les emails mal formés', () => {
    for (const email of ['', 'sans-arobase', '@test.com', 'a@', 'a@test', 'a b@test.com', 'a@@test.com', 'a@te st.com']) {
      expect(() => parseRegister({ name: 'Al', email, password: 'password123' })).toThrow();
    }
  });

  it('normalise toujours (minuscules, espaces retirés) les emails valides', () => {
    expect(parseLogin({ email: '  AL@Test.COM ', password: 'x' }).email).toBe('al@test.com');
  });
});
