import { expect, it } from "vitest";
import { rebootRecoveryWindow } from "../../fleet-runner/reboot-timing.mjs";

it("allows a real 95-second recovery after a long owner password wait", () => {
  const armedAt = 1_000;
  const commandReturnedAt = armedAt + 240_000;
  const window = rebootRecoveryWindow(armedAt, commandReturnedAt);
  const recoveredAt = commandReturnedAt + 95_000;
  expect(window.ownerWaitMs).toBe(240_000);
  expect(recoveredAt < window.deadline).toBe(true);
  expect(recoveredAt - window.startedAt).toBe(95_000);
});
it("still fails the bound for an actual recovery longer than five minutes", () => {
  const window = rebootRecoveryWindow(1_000, 241_000);
  expect(window.startedAt + 300_001 < window.deadline).toBe(false);
});
it("rejects backward clocks instead of creating a false recovery interval", () => {
  expect(() => rebootRecoveryWindow(5_000, 4_000)).toThrow("invalid reboot timing");
});
