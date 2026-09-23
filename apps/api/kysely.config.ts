import { defineConfig } from 'kysely-ctl';
import { Pool } from 'pg';
import { getDatabaseUrl, loadRootEnv } from './src/env.js';

loadRootEnv();

export default defineConfig({
  dialect: 'pg',
  dialectConfig: {
    pool: new Pool({ connectionString: getDatabaseUrl() }),
  },
  migrations: {
    migrationFolder: './migrations',
  },
});
