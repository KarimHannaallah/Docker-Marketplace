import { loadConfig } from '../src/config';

const required = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret', ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'pw' };

describe('configuration de la limitation du débit', () => {
  it('utilise les valeurs par défaut : 15 minutes, 100 requêtes, 10 pour login/register', () => {
    expect(loadConfig(required).rateLimit).toEqual({ windowMs: 900_000, max: 100, authMax: 10 });
  });

  it("lit les variables d'environnement", () => {
    const config = loadConfig({
      ...required,
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '500',
      AUTH_RATE_LIMIT_MAX: '20',
    });
    expect(config.rateLimit).toEqual({ windowMs: 60_000, max: 500, authMax: 20 });
  });

  it('traite une variable vide comme absente', () => {
    expect(loadConfig({ ...required, RATE_LIMIT_MAX: '' }).rateLimit.max).toBe(100);
  });

  it.each(['abc', '0', '-5', '1.5', '1e400'])('refuse la valeur invalide %p au démarrage', (value) => {
    expect(() => loadConfig({ ...required, AUTH_RATE_LIMIT_MAX: value })).toThrow(/AUTH_RATE_LIMIT_MAX/);
  });
});
