import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        compatibilityDate: "2026-08-15",
        bindings: {
          SESSION_SECRET: "test-session-secret",
          GITHUB_CLIENT_ID: "test-id",
          GITHUB_CLIENT_SECRET: "test-secret",
          APP_ORIGIN: "",
        },
      },
    }),
  ],
  test: { include: ["test/**/*.test.ts"] },
});
