import { defineConfig } from '@playwright/test'

// Electron UI smoke tests: run `npm run build` first (`npm run test:ui` does both).
export default defineConfig({
  testDir: 'tests-ui',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  // Most assertions settle in milliseconds, so a missing element should fail in seconds, not wait ten.
  expect: { timeout: 5_000 },
  // Stop at the first failure when running by hand; CI still reports every failure.
  maxFailures: process.env.CI ? 0 : 1,
  outputDir: 'test-results',
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
})
