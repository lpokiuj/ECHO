import dataSource from './data-source.js';
import { runSeed } from './run-seed.js';
import { SEED_DATA } from './seed-data.js';
import { assertSeedAllowed } from './seed-guard.js';

// `npm run seed`: dev data only, see seed-data.ts
assertSeedAllowed(process.env);

await dataSource.initialize();
try {
  await runSeed(dataSource, SEED_DATA, {
    adminEmail: process.env.ADMIN_EMAIL!.trim().toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD!,
    userPassword: process.env.SEED_USER_PASSWORD ?? 'password123',
  });
  console.log('Seed done.');
} finally {
  await dataSource.destroy();
}
