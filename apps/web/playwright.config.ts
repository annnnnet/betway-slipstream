import { defineConfig, devices } from '@playwright/test';

/**
 * Two suites live here:
 *
 *   e2e/slipstream.spec.ts — our own app, against local dev servers.
 *   e2e/betway-verification.spec.ts — the assessment's verification
 *     requirement: it generates a code through our API and then loads that
 *     code on betway.com.ng itself, capturing screenshots as evidence.
 *
 * `reuseExistingServer` means an already-running `pnpm dev` is used as-is; on
 * a fresh clone with nothing running, Playwright boots both itself. Without
 * it, the only symptom of "you forgot to start the servers" is a bare
 * ERR_CONNECTION_REFUSED, which is a poor first run for a reviewer.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: './test-results',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // Against a deployed URL there is nothing to boot — starting local servers
  // would also mean the run silently exercised localhost instead of
  // production, which is the one thing a deployment check must not do.
  webServer: process.env.E2E_WEB_URL
    ? undefined
    : [
        {
          command: 'pnpm --filter @slipstream/api start:dev',
          cwd: '../..',
          // The catalogue endpoint needs no database and no auth, so a 200
          // here proves the API is genuinely serving rather than just listening.
          url: 'http://localhost:4000/api/catalogue/sports',
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
        {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
