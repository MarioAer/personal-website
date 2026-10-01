import { defineConfig, devices } from '@playwright/test'

const BASE_PATH = '/personal-website/'
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}${BASE_PATH}`, trace: 'retain-on-failure' },
  webServer: {
    command: `BASE_PATH=${BASE_PATH} npm run build && BASE_PATH=${BASE_PATH} PORT=${PORT} npm run serve`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-phone', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
    { name: 'webkit-phone', use: { ...devices['Desktop Safari'], viewport: { width: 360, height: 780 } } },
  ],
})
