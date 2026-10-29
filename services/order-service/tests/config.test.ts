import { loadConfig } from '../src/config';

const required = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret' };

describe("validation des adresses des autres services au démarrage", () => {
  it('utilise les adresses par défaut du réseau Docker', () => {
    const config = loadConfig(required);
    expect(config.catalogServiceUrl).toBe('http://catalog-service:8000');
    expect(config.authServiceUrl).toBe('http://auth-service:3001');
  });

  it.each(['http://catalog-service:8000', 'https://catalogue.example.com', 'http://localhost:8100'])(
    'accepte une URL http(s) valide : %s',
    (url) => {
      expect(loadConfig({ ...required, CATALOG_SERVICE_URL: url }).catalogServiceUrl).toBe(url);
    },
  );

  it.each([
    ['du texte quelconque', 'pas une url'],
    ['une valeur vide', ''],
    ['un hôte sans schéma', 'catalog-service:8000/path'],
    ['le schéma file://', 'file:///etc/passwd'],
    ['le schéma ftp://', 'ftp://catalog-service/'],
    ['le schéma javascript:', 'javascript:alert(1)'],
    ['le schéma data:', 'data:text/plain,hello'],
  ])('refuse %s pour CATALOG_SERVICE_URL', (_label, url) => {
    expect(() => loadConfig({ ...required, CATALOG_SERVICE_URL: url })).toThrow(/CATALOG_SERVICE_URL/);
  });

  it('applique la même validation à AUTH_SERVICE_URL', () => {
    expect(() => loadConfig({ ...required, AUTH_SERVICE_URL: 'file:///x' })).toThrow(/AUTH_SERVICE_URL/);
    expect(() => loadConfig({ ...required, AUTH_SERVICE_URL: 'n importe quoi' })).toThrow(/AUTH_SERVICE_URL/);
  });
});
