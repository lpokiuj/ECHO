import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities.js';

// Env files live at the repo root. Scripts run from apps/api, so that is ../../.
// process.loadEnvFile never overrides variables that are already set.
export const envFilePath = resolve(
  process.cwd(),
  process.env.NODE_ENV === 'test' ? '../../.env.test' : '../../.env',
);
if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

// Migrations are always loaded from the compiled output. Under Vitest this file runs from
// src/, where Node cannot import the .ts files, so point at ../../dist instead
// (`npm run test:e2e` builds first).
const compiledRoot = import.meta.dirname.endsWith(join('src', 'database'))
  ? join(import.meta.dirname, '..', '..', 'dist')
  : join(import.meta.dirname, '..');

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // uuid PKs default to gen_random_uuid(); a hand-written default would cause migration drift
  uuidExtension: 'pgcrypto',
  // Schema changes go through migrations only
  synchronize: false,
  entities: ENTITIES,
  migrations: [join(compiledRoot, 'migrations', '*.js')],
};

// Exported for the TypeORM CLI (-d dist/database/data-source.js)
export default new DataSource(dataSourceOptions);
