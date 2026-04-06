import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/__tests__/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/__tests__/**", "**/dist/**", "**/index.ts"],
    },
  },
});
