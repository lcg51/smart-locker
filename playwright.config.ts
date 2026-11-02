import { defineConfig } from "@playwright/test"

const E2E_PORT = 3100
const E2E_URL = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `dotenv -e .env.test -- pnpm dev --port ${E2E_PORT}`,
    env: {
      APP_URL: E2E_URL,
      AUTH_URL: E2E_URL,
    },
    url: E2E_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
