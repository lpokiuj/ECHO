import { assertSeedAllowed } from './seed-guard.js';

const ok = {
  NODE_ENV: 'development',
  DB_NAME: 'echo_dev',
  ADMIN_EMAIL: 'admin@echo.local',
  ADMIN_PASSWORD: 'password',
};

describe('assertSeedAllowed', () => {
  it('allows the dev database with admin env set', () => {
    expect(() => assertSeedAllowed(ok)).not.toThrow();
  });

  it('refuses NODE_ENV=production', () => {
    expect(() => assertSeedAllowed({ ...ok, NODE_ENV: 'production' })).toThrow(
      'production',
    );
  });

  it('refuses any database other than echo_dev', () => {
    expect(() => assertSeedAllowed({ ...ok, DB_NAME: 'echo_test' })).toThrow(
      'only runs against echo_dev',
    );
    expect(() => assertSeedAllowed({ ...ok, DB_NAME: undefined })).toThrow();
  });

  it('requires ADMIN_EMAIL and ADMIN_PASSWORD', () => {
    expect(() => assertSeedAllowed({ ...ok, ADMIN_EMAIL: '' })).toThrow(
      'ADMIN_EMAIL and ADMIN_PASSWORD',
    );
    expect(() =>
      assertSeedAllowed({ ...ok, ADMIN_PASSWORD: undefined }),
    ).toThrow('ADMIN_EMAIL and ADMIN_PASSWORD');
  });
});
