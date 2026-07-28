import { defineConfig, devices } from "@playwright/test";

const webUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5180";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
