export interface SeedEnv {
  NODE_ENV?: string;
  DB_NAME?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

// The seed inserts fake users with known passwords, so it may only touch the dev database.
export function assertSeedAllowed(env: SeedEnv): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production');
  }
  if (env.DB_NAME !== 'echo_dev') {
    throw new Error(
      `Refusing to seed "${env.DB_NAME}": the seed only runs against echo_dev`,
    );
  }
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed');
  }
}
