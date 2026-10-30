import { DataSource } from 'typeorm';
import { assertTestDatabase } from '../src/database/assert-test-database.js';
import { dataSourceOptions } from '../src/database/data-source.js';

// Runs once before the e2e suite: abort unless the target is a *_test database,
// then bring its schema up to date.
export default async function setup() {
  assertTestDatabase(dataSourceOptions.database as string | undefined);
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
