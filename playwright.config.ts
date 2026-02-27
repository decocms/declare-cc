import { defineConfig, devices } from "@playwright/test";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIFECYCLE_TMP = resolve(__dirname, "test-results/lifecycle-project");
const FIXTURES = resolve(__dirname, "tests/e2e/fixtures/ai-responses.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3847",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/full-lifecycle.spec.ts"],
    },
    {
      name: "lifecycle",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3848",
      },
      testMatch: "**/full-lifecycle.spec.ts",
    },
  ],
  webServer: [
    {
      command: "bun run dev:server",
      url: "http://localhost:3847/api/graph",
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: `DCL_PROJECT_ROOT=${LIFECYCLE_TMP} DCL_MOCK_AI=${FIXTURES} PORT=3848 bun run dev:server`,
      url: "http://localhost:3848/api/graph",
      reuseExistingServer: false,
      timeout: 10_000,
    },
  ],
});
