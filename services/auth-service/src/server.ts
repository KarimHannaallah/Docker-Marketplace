import { Pool } from 'pg';
import { createApp } from './app';
import { loadConfig } from './config';
import { PgTokenRepository } from './repositories/pgTokenRepository';
import { PgUserRepository } from './repositories/pgUserRepository';
import { AuthService } from './services/authService';

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

  const service = new AuthService(new PgUserRepository(pool), new PgTokenRepository(pool), config);
  if (await service.ensureAdmin()) console.log(`Compte admin créé : ${config.adminEmail}`);

  createApp(service, config.rateLimit).listen(config.port, () => {
    console.log(`auth-service à l'écoute sur le port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
