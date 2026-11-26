import { defineConfig } from "vitest/config";

// The FleetRunner promote's tests that take real time, kept out of the root include list so that
// `pnpm test` stays short for everyone else:
//   *.sweep_test.ts  the kill sweeps: one sandbox per engine call, per journal write and per call
//                    the Mac makes, about 360 in all;
//   *.slow_test.ts   the promote's other tests that sit through real waits (an evidence window,
//                    a stop bound, a lock held by a stuck step): minutes, not seconds.
// CI runs them with this config on every push to main and whenever a change touches fleet-runner
// (scripts/fleet-runner/promote-sweeps-decision.sh). To run them here:
//   pnpm exec vitest run --config vitest.promote-sweeps.config.ts
export default defineConfig({
  test: {
    include: ["packages/fleet-runner/src/__tests__/*.sweep_test.ts", "packages/fleet-runner/src/__tests__/*.slow_test.ts"],
    environment: "node",
  },
});
