import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { assertTestDatabase } from '../../src/database/assert-test-database.js';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

// Empties every table except TypeORM's migrations table. Call between tests.
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  assertTestDatabase(dataSource.options.database as string);
  const tables: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (tables.length === 0) return;
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}
