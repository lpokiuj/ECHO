import { defineConfig, devices } from '@playwright/test'

// E2E_PUBLIC_BASE_URL is the origin of the public dev server (the site lives at its root).
const baseURL = process.env.E2E_PUBLIC_BASE_URL ?? 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  globalSetup: './e2e/global-setup.ts',
  reporter: [['list']],
  // Traces and videos could record tokens used by the global setup.
  use: { baseURL, trace: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
  },
})
