import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';

// Env files live at the repo root. Scripts run from apps/api, so that is ../../.
// process.loadEnvFile never overrides variables that are already set.
export const envFilePath = resolve(
  process.cwd(),
  process.env.NODE_ENV === 'test' ? '../../.env.test' : '../../.env',
);
if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

// import.meta.dirname is src/database (ts) or dist/database (js), so the globs
// below work for both the Nest app and the TypeORM CLI.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Schema changes go through migrations only
  synchronize: false,
  entities: [join(import.meta.dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(import.meta.dirname, '..', 'migrations', '*.{ts,js}')],
};

// Exported for the TypeORM CLI (-d dist/database/data-source.js)
export default new DataSource(dataSourceOptions);
