import { defineConfig } from '@playwright/test'

// Electron UI smoke tests: run `npm run build` first (`npm run test:ui` does both).
export default defineConfig({
  testDir: 'tests-ui',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
})
