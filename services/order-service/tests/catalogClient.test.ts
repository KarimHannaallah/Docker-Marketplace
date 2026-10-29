import { HttpCatalogClient } from '../src/clients/catalogClient';

const BASE = 'http://catalog-service:8000';
const product = { id: 42, name: 'Casque', price: '59.90', stock: 5, image_url: null };

function mockFetch(response: Partial<Response>) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue(response as Response);
}

afterEach(() => jest.restoreAllMocks());

describe('HttpCatalogClient : protection contre le SSRF', () => {
  const client = new HttpCatalogClient(BASE);

  it.each([
    ['zéro', 0],
    ['un négatif', -1],
    ['un décimal', 1.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['un entier non représentable exactement', Number.MAX_SAFE_INTEGER + 1],
    ['2^53', 2 ** 53],
    ['une chaîne de chemin', '1/../../admin' as unknown as number],
    ['une URL', 'http://evil.example/' as unknown as number],
    ['une chaîne numérique', '42' as unknown as number],
    ['null', null as unknown as number],
  ])("rejette %s sans jamais appeler le réseau", async (_label, id) => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => product });
    await expect(client.getProduct(id, 'token')).rejects.toMatchObject({ status: 400 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('construit une URL qui pointe toujours vers le catalogue', async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => product });
    await client.getProduct(42, 'jeton-utilisateur');

    const url = spy.mock.calls[0][0] as URL;
    expect(url).toBeInstanceOf(URL);
    expect(url.href).toBe('http://catalog-service:8000/catalog/products/42');
    expect(url.host).toBe('catalog-service:8000');
    // le JWT de l'utilisateur est transmis au catalogue
    expect((spy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jeton-utilisateur');
  });

  it("construit la même URL si l'adresse du catalogue se termine par un /", async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => product });
    await new HttpCatalogClient('http://catalog-service:8000/').getProduct(7, 't');
    expect((spy.mock.calls[0][0] as URL).href).toBe('http://catalog-service:8000/catalog/products/7');
  });

  it('retourne le produit avec un prix numérique', async () => {
    mockFetch({ ok: true, status: 200, json: async () => product });
    await expect(client.getProduct(42, 't')).resolves.toEqual({ id: 42, name: 'Casque', price: 59.9, stock: 5, image_url: null });
  });

  it('retourne null si le produit est introuvable (404)', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(client.getProduct(42, 't')).resolves.toBeNull();
  });

  it('répond 503 si le catalogue est injoignable, 502 pour une réponse inattendue', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client.getProduct(42, 't')).rejects.toMatchObject({ status: 503 });

    jest.restoreAllMocks();
    mockFetch({ ok: false, status: 500 });
    await expect(client.getProduct(42, 't')).rejects.toMatchObject({ status: 502 });
  });
});
