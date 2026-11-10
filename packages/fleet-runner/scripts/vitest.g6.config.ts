import { defineConfig } from "vitest/config";

export default defineConfig({
  root: process.cwd(),
  test: {
    include: ["packages/fleet-runner/scripts/g6-interruption-campaign.test.ts"],
  },
});
