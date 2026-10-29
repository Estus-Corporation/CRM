import type { Knex } from 'knex';
import dotenv from 'dotenv';
import { assertLocalDatabase } from './src/config/assertLocalDatabase';

dotenv.config();
// migrate:latest/rollback/seed passam por aqui sem carregar src/config/env.ts
assertLocalDatabase(process.env.DATABASE_URL, process.env.NODE_ENV, process.env.ALLOW_REMOTE_DB);

const config: { [env: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/db/seeds',
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    pool: { min: 2, max: 10 },
  },
};

export default config;
