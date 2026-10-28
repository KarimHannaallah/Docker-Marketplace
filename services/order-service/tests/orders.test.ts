import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { HttpError } from '../src/errors';
import { authenticate } from '../src/middleware/auth';
import { CartService } from '../src/services/cartService';
import { OrderService } from '../src/services/orderService';
import { FakeCatalog, FakeRevocation, InMemoryCartRepository, InMemoryOrderRepository } from './fakes';

const SECRET = 'test-secret-with-at-least-32-bytes-ok';

const PRODUCTS = [
  { id: 1, name: 'Casque', price: 59.9, stock: 5, image_url: null },
  { id: 2, name: 'Souris', price: 24.99, stock: 2, image_url: null },
  { id: 3, name: 'Livre', price: 0.1, stock: 100, image_url: null },
];

let app: ReturnType<typeof createApp>;
let carts: InMemoryCartRepository;
let orders: InMemoryOrderRepository;
let catalog: FakeCatalog;
let revocation: FakeRevocation;

const tokenFor = (userId: number, role = 'STANDARD') =>
  jwt.sign({ role }, SECRET, { subject: String(userId), jwtid: `jti-${userId}`, expiresIn: '1h' });

const alice = tokenFor(1);
const bob = tokenFor(2);
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  carts = new InMemoryCartRepository();
  orders = new InMemoryOrderRepository(carts);
  catalog = new FakeCatalog(PRODUCTS);
  revocation = new FakeRevocation();
  app = createApp(
    authenticate(SECRET, revocation),
    new CartService(carts, catalog),
    new OrderService(carts, orders, catalog),
  );
});

const addToCart = (token: string, productId: number, quantity?: number) =>
  request(app).post('/orders/cart').set(as(token)).send({ productId, quantity });

describe('authentification', () => {
  it('health est public', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('401 sans token, avec un token falsifié ou expiré', async () => {
    expect((await request(app).get('/orders/cart')).status).toBe(401);
    expect((await request(app).get('/orders/cart').set(as('nimportequoi'))).status).toBe(401);
    const expired = jwt.sign({ role: 'STANDARD' }, SECRET, { subject: '1', expiresIn: -10 });
    expect((await request(app).get('/orders')).status).toBe(401);
    expect((await request(app).get('/orders').set(as(expired))).status).toBe(401);
    const wrongSecret = jwt.sign({ role: 'STANDARD' }, 'un-autre-secret-de-plus-de-32-octets!', { subject: '1' });
    expect((await request(app).get('/orders').set(as(wrongSecret))).status).toBe(401);
  });

  it('401 si le token a été révoqué (logout)', async () => {
    expect((await request(app).get('/orders').set(as(alice))).status).toBe(200);
    revocation.revoked.add(alice);
    expect((await request(app).get('/orders').set(as(alice))).status).toBe(401);
  });
});

describe('panier', () => {
  it('commence vide', async () => {
    const res = await request(app).get('/orders/cart').set(as(alice));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });

  it('ajoute un produit (quantité 1 par défaut) puis incrémente', async () => {
    const first = await addToCart(alice, 1);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ product_id: 1, quantity: 1 });
    const second = await addToCart(alice, 1, 2);
    expect(second.body.quantity).toBe(3);
  });

  it('GET /orders/cart enrichit avec le catalogue et calcule le total', async () => {
    await addToCart(alice, 1, 2);
    await addToCart(alice, 3, 3);
    const res = await request(app).get('/orders/cart').set(as(alice));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ product_id: 1, quantity: 2, line_total: 119.8 });
    expect(res.body.items[0].product.name).toBe('Casque');
    expect(res.body.total).toBe(120.1); // 119.80 + 0.30, sans erreur de flottant
  });

  it('transmet le JWT de l\'utilisateur au catalogue', async () => {
    await addToCart(alice, 1);
    expect(catalog.calls.at(-1)).toEqual({ id: 1, token: alice });
  });

  it('refuse un produit inconnu (404) et une quantité invalide (400)', async () => {
    expect((await addToCart(alice, 999)).status).toBe(404);
    expect((await addToCart(alice, 1, 0)).status).toBe(400);
    expect((await addToCart(alice, 1, -2)).status).toBe(400);
    expect((await addToCart(alice, 1, 1.5)).status).toBe(400);
    expect((await addToCart(alice, 1, 1000)).status).toBe(400);
    expect((await request(app).post('/orders/cart').set(as(alice)).send({})).status).toBe(400);
  });

  it('refuse de dépasser le stock (409), y compris en incrémentant', async () => {
    expect((await addToCart(alice, 2, 3)).status).toBe(409);
    expect((await addToCart(alice, 2, 2)).status).toBe(201);
    expect((await addToCart(alice, 2, 1)).status).toBe(409);
  });

  it('PATCH modifie la quantité', async () => {
    await addToCart(alice, 1);
    const res = await request(app).patch('/orders/cart/1').set(as(alice)).send({ quantity: 4 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ product_id: 1, quantity: 4 });
    expect((await request(app).patch('/orders/cart/1').set(as(alice)).send({ quantity: 6 })).status).toBe(409);
    expect((await request(app).patch('/orders/cart/1').set(as(alice)).send({ quantity: 0 })).status).toBe(400);
    expect((await request(app).patch('/orders/cart/2').set(as(alice)).send({ quantity: 1 })).status).toBe(404);
  });

  it('DELETE retire une ligne', async () => {
    await addToCart(alice, 1);
    expect((await request(app).delete('/orders/cart/1').set(as(alice))).status).toBe(204);
    expect((await request(app).get('/orders/cart').set(as(alice))).body.items).toEqual([]);
    expect((await request(app).delete('/orders/cart/1').set(as(alice))).status).toBe(404);
  });

  it('isolation : chaque utilisateur a son propre panier', async () => {
    await addToCart(alice, 1, 2);
    const bobCart = await request(app).get('/orders/cart').set(as(bob));
    expect(bobCart.body.items).toEqual([]);
    // Bob ne peut ni modifier ni supprimer la ligne d'Alice
    expect((await request(app).patch('/orders/cart/1').set(as(bob)).send({ quantity: 1 })).status).toBe(404);
    expect((await request(app).delete('/orders/cart/1').set(as(bob))).status).toBe(404);
    expect((await request(app).get('/orders/cart').set(as(alice))).body.items[0].quantity).toBe(2);
  });
});

describe('checkout', () => {
  it('crée une commande PAID avec le prix du catalogue et vide le panier', async () => {
    await addToCart(alice, 1, 2);
    await addToCart(alice, 3, 3);
    // Le prix change dans le catalogue après l'ajout au panier : c'est le prix au paiement qui compte.
    catalog.products.set(1, { ...PRODUCTS[0], price: 50 });

    const res = await request(app).post('/orders/checkout').set(as(alice));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PAID');
    expect(res.body.total).toBe(100.3);
    expect(res.body.items).toEqual([
      { product_id: 1, quantity: 2, price_at_purchase: 50 },
      { product_id: 3, quantity: 3, price_at_purchase: 0.1 },
    ]);
    expect((await request(app).get('/orders/cart').set(as(alice))).body.items).toEqual([]);
  });

  it('409 si le stock est insuffisant : aucune commande, panier conservé', async () => {
    await addToCart(alice, 2, 2);
    catalog.products.set(2, { ...PRODUCTS[1], stock: 1 }); // le stock a baissé entre-temps

    const res = await request(app).post('/orders/checkout').set(as(alice));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Stock insuffisant/);
    expect(orders.orders).toHaveLength(0);
    expect((await request(app).get('/orders/cart').set(as(alice))).body.items).toHaveLength(1);
  });

  it('409 si un produit a disparu du catalogue', async () => {
    await addToCart(alice, 1);
    catalog.products.delete(1);
    expect((await request(app).post('/orders/checkout').set(as(alice))).status).toBe(409);
    expect(orders.orders).toHaveLength(0);
  });

  it('400 si le panier est vide', async () => {
    expect((await request(app).post('/orders/checkout').set(as(alice))).status).toBe(400);
  });

  it('503 si le catalogue est indisponible', async () => {
    await addToCart(alice, 1);
    catalog.getProduct = async () => {
      throw new HttpError(503, 'Catalogue indisponible');
    };
    expect((await request(app).post('/orders/checkout').set(as(alice))).status).toBe(503);
    expect(orders.orders).toHaveLength(0);
  });
});

describe('commandes', () => {
  async function pay(token: string, productId = 1) {
    await addToCart(token, productId);
    return (await request(app).post('/orders/checkout').set(as(token))).body;
  }

  it('liste ses commandes et lit le détail', async () => {
    const o1 = await pay(alice);
    const o2 = await pay(alice, 3);

    const list = await request(app).get('/orders').set(as(alice));
    expect(list.status).toBe(200);
    expect(list.body.map((o: { id: number }) => o.id)).toEqual([o2.id, o1.id]); // plus récente d'abord

    const detail = await request(app).get(`/orders/${o1.id}`).set(as(alice));
    expect(detail.status).toBe(200);
    expect(detail.body.items[0].product_id).toBe(1);
  });

  it('isolation : on ne voit jamais les commandes des autres', async () => {
    const aliceOrder = await pay(alice);
    expect((await request(app).get('/orders').set(as(bob))).body).toEqual([]);
    expect((await request(app).get(`/orders/${aliceOrder.id}`).set(as(bob))).status).toBe(404);
  });

  it('404 pour une commande inconnue, 400 pour un id invalide', async () => {
    expect((await request(app).get('/orders/999').set(as(alice))).status).toBe(404);
    expect((await request(app).get('/orders/abc').set(as(alice))).status).toBe(400);
  });
});
