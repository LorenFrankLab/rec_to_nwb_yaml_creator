import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 4 workers in CI for faster parallel execution (26 tests / 4 = ~6.5 tests per worker)
  // GitHub Actions runners have 2 cores, but can handle 4 parallel browser instances
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Visual regression settings for deterministic screenshots
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  // Visual regression baseline project (chromium only for consistency)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Override for consistent visual regression
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },
    // Disable other browsers for baseline tests to reduce snapshot volume
    // Uncomment for cross-browser testing later
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // Screenshot comparison settings
  expect: {
    toHaveScreenshot: {
      // Allow small pixel differences for font rendering variations
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
});
