import { defineConfig } from "vitest/config";

// The FleetRunner G0 contract test needs FLEET_RUNNER_CLIENT_REPO (a BookcaseDiscovery
// checkout), so it is not in the root `pnpm test` include list. CI runs it with this config.
export default defineConfig({
  test: {
    include: ["scripts/fleet-runner/__tests__/**/*.test.mjs"],
    environment: "node",
  },
});
