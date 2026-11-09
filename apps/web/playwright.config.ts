import { defineConfig, devices } from '@playwright/test'

// E2E_BASE_URL is the origin only; the portal lives under /volunteer-portal/.
const origin = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const baseURL = new URL('/volunteer-portal/', origin).href

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  globalSetup: './e2e/global-setup.ts',
  reporter: [['list']],
  // Traces and videos would record passwords and tokens (DECISIONS D-013).
  use: { baseURL, trace: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
  },
})
