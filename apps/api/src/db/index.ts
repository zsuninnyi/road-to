import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { getDatabaseUrl } from '../env.js';
import type { Database } from './types.js';

export type { Database } from './types.js';

export function createPool(connectionString = getDatabaseUrl()): Pool {
  const pool = new Pool({ connectionString });
  pool.on('error', (error) => {
    console.error('Postgres pool error', error);
  });
  return pool;
}

export function createDb(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}
