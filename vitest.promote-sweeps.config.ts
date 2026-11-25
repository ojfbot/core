import { defineConfig } from "vitest/config";

// The FleetRunner promote's kill sweeps: one sandbox per engine call, per journal write and per
// call the Mac makes, about 360 in all. They take far longer than the rest of `pnpm test` together,
// so they are not in the root include list. CI runs them with this config on every push to main and
// whenever a change touches the promote (scripts/fleet-runner/promote-sweeps-decision.sh).
export default defineConfig({
  test: {
    include: ["packages/fleet-runner/src/__tests__/*.sweep_test.ts"],
    environment: "node",
  },
});
