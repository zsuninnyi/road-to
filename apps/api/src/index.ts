import { buildApp } from './app.js';
import { createAuth } from './auth.js';
import { createDb, createPool } from './db/index.js';
import { loadRootEnv } from './env.js';

loadRootEnv();

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '127.0.0.1';

const pool = createPool();
const db = createDb(pool);
const app = await buildApp({ auth: createAuth(pool), db });

async function shutdown() {
  await app.close();
  await pool.end();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown().finally(() => process.exit(0));
  });
}

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  await shutdown();
  process.exit(1);
}
