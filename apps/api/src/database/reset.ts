import dataSource from './data-source.js';

// `npm run db:reset`: drops every table in echo_dev and rebuilds the schema from migrations.
// The seed runs afterwards (see the db:reset script in package.json).

const DEV_DATABASE = 'echo_dev';

function databaseName(options: typeof dataSource.options): string | undefined {
  const { database, url } = options as { database?: unknown; url?: unknown };
  if (typeof database === 'string' && database) return database;
  if (typeof url === 'string' && url) {
    try {
      return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const name = databaseName(dataSource.options);
// Safety guard: runs before anything is dropped.
if (name !== DEV_DATABASE) {
  console.error(
    `Refusing to reset "${name ?? 'unknown'}": db:reset only runs against ${DEV_DATABASE}`,
  );
  process.exit(1);
}

await dataSource.initialize();
try {
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
  console.log(`Reset done: ${name}`);
} finally {
  await dataSource.destroy();
}
