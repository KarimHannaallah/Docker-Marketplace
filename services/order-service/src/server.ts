import { Pool } from 'pg';
import { createApp } from './app';
import { HttpCatalogClient } from './clients/catalogClient';
import { HttpRevocationChecker } from './clients/tokenVerifier';
import { loadConfig } from './config';
import { authenticate } from './middleware/auth';
import { PgCartRepository } from './repositories/pgCartRepository';
import { PgOrderRepository } from './repositories/pgOrderRepository';
import { CartService } from './services/cartService';
import { OrderService } from './services/orderService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** La base peut démarrer après le service : on réessaie quelques fois. */
async function waitForDatabase(pool: Pool, attempts = 15): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`Base indisponible, nouvel essai (${i}/${attempts})...`);
      await sleep(2000);
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  await waitForDatabase(pool);

  const catalog = new HttpCatalogClient(config.catalogServiceUrl);
  const carts = new PgCartRepository(pool);
  const orders = new PgOrderRepository(pool);
  const requireAuth = authenticate(config.jwtSecret, new HttpRevocationChecker(config.authServiceUrl));

  createApp(requireAuth, new CartService(carts, catalog), new OrderService(carts, orders, catalog)).listen(
    config.port,
    () => console.log(`order-service à l'écoute sur le port ${config.port}`),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
