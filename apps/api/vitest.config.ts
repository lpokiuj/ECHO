import { defineConfig } from 'vitest/config';

// `resolve.tsconfigPaths` resolves the path aliases declared in tsconfig.json,
// including the ones added by `nest g library`. Requires Vite 8.
// Select one project with `--project unit` or `--project e2e`; a bare
// `vitest` runs both (e2e needs NODE_ENV=test and the test database).
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          globals: true,
          include: ['**/*.spec.ts'],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'e2e',
          globals: true,
          include: ['**/*.e2e-spec.ts'],
          globalSetup: ['./test/global-setup.ts'],
          // All e2e files share one database, so they must not run in parallel
          fileParallelism: false,
          // Most files log in many times from one IP; the throttle test sets its own limit
          env: { LOGIN_RATE_LIMIT: '100000' },
        },
      },
    ],
  },
});
