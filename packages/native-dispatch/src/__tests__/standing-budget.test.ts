import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync as Database } from "node:sqlite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { initializeStandingBudget, openStandingBudget } from "../standing-budget.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};
const policy = { lineageId: "policy-lineage", deviceId: "device-a", hourlyLimit: 2, dailyLimit: 3 };
const hour = 3_600_000;
const day = 24 * hour;
let dir: string;
let db: Database;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "standing-budget-"));
  db = new DatabaseSync(join(dir, "state.sqlite"));
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function transaction<T>(run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
function start() {
  transaction(() => initializeStandingBudget(db, policy));
  return openStandingBudget(db, policy);
}

it("requires an explicit bootstrap and a caller transaction; runtime open cannot reset missing usage", () => {
  expect(() => openStandingBudget(db, policy)).toThrow("standing-budget-missing");
  expect(() => initializeStandingBudget(db, policy)).toThrow(
    "standing-budget-transaction-required",
  );
  const budget = start();
  expect(() => budget.reserve("effect-a", "digest-a", 1)).toThrow(
    "standing-budget-transaction-required",
  );
  transaction(() => budget.reserve("effect-a", "digest-a", 1));
  expect(() => transaction(() => initializeStandingBudget(db, policy))).toThrow(
    "standing-budget-already-initialized",
  );
});

it("enforces rolling hour/day boundaries and retains usage through restart and new policy objects", () => {
  let budget = start();
  expect(transaction(() => budget.reserve("a", "a", 0))).toEqual({ kind: "new" });
  expect(transaction(() => budget.reserve("b", "b", 1))).toEqual({ kind: "new" });
  expect(transaction(() => budget.reserve("c", "c", hour - 1))).toEqual({
    kind: "held",
    reason: "hourly-limit",
  });
  db.close();
  db = new DatabaseSync(join(dir, "state.sqlite"));
  budget = openStandingBudget(db, { ...policy });
  expect(transaction(() => budget.reserve("c", "c", hour))).toEqual({ kind: "new" });
  expect(transaction(() => budget.reserve("d", "d", 2 * hour))).toEqual({
    kind: "held",
    reason: "daily-limit",
  });
  expect(transaction(() => budget.reserve("d", "d", day))).toEqual({ kind: "new" });
});

it("returns prior reservations without spending again and rejects changed effect payloads", () => {
  const budget = start();
  transaction(() => budget.reserve("same", "digest", 1));
  expect(transaction(() => budget.reserve("same", "digest", 2))).toEqual({
    kind: "prior",
    state: "reserved",
  });
  expect(transaction(() => budget.reserve("same", "changed", 2))).toEqual({
    kind: "held",
    reason: "effect-conflict",
  });
  expect(transaction(() => budget.reserve("next", "next", 2))).toEqual({ kind: "new" });
  expect(transaction(() => budget.reserve("last", "last", 2))).toEqual({
    kind: "held",
    reason: "hourly-limit",
  });
});

it("rolls back quota and an adjacent effect intent together", () => {
  const budget = start();
  db.exec("CREATE TABLE effect_intents(id TEXT PRIMARY KEY)");
  expect(() =>
    transaction(() => {
      budget.reserve("a", "a", 1);
      db.prepare("INSERT INTO effect_intents VALUES(?)").run("a");
      throw Error("crash-before-commit");
    }),
  ).toThrow("crash-before-commit");
  expect(db.prepare("SELECT count(*) AS n FROM effect_intents").get()?.n).toBe(0);
  expect(transaction(() => budget.reserve("a", "a", 1))).toEqual({ kind: "new" });
  expect(transaction(() => budget.reserve("b", "b", 2))).toEqual({ kind: "new" });
});

it("refunds only an unstarted reservation once; started or unknown effects stay charged", () => {
  const budget = start();
  transaction(() => budget.reserve("prelaunch", "a", 0));
  transaction(() => budget.refundBeforeLaunch("prelaunch"));
  transaction(() => budget.refundBeforeLaunch("prelaunch"));
  expect(transaction(() => budget.reserve("prelaunch", "a", 1))).toEqual({
    kind: "prior",
    state: "refunded",
  });
  transaction(() => budget.reserve("unknown", "b", 1));
  transaction(() => budget.markStarted("unknown"));
  expect(() => transaction(() => budget.refundBeforeLaunch("unknown"))).toThrow(
    "standing-budget-effect-started",
  );
  transaction(() => budget.reserve("other", "c", 2));
  expect(transaction(() => budget.reserve("extra", "d", 3))).toEqual({
    kind: "held",
    reason: "hourly-limit",
  });
});

it("holds after clock rollback, including restart, instead of expiring usage against an earlier clock", () => {
  let budget = start();
  transaction(() => budget.reserve("a", "a", 100));
  db.close();
  db = new DatabaseSync(join(dir, "state.sqlite"));
  budget = openStandingBudget(db, policy);
  expect(transaction(() => budget.reserve("b", "b", 99))).toEqual({
    kind: "held",
    reason: "clock-rollback",
  });
  expect(transaction(() => budget.reserve("b", "b", 100))).toEqual({ kind: "new" });
});

it("pins device and lineage, refuses unapproved increases, and permits stricter limits without resetting usage", () => {
  const budget = start();
  transaction(() => budget.reserve("a", "a", 0));
  for (const change of [
    { deviceId: "device-b" },
    { lineageId: "replacement" },
    { hourlyLimit: 3 },
    { dailyLimit: 4 },
  ]) {
    expect(() => openStandingBudget(db, { ...policy, ...change })).toThrow(
      "standing-budget-policy-mismatch",
    );
  }
  const stricter = openStandingBudget(db, { ...policy, hourlyLimit: 1 });
  expect(transaction(() => stricter.reserve("b", "b", 1))).toEqual({
    kind: "held",
    reason: "hourly-limit",
  });
});

it("refuses partial or corrupt accounting rather than recreating it", () => {
  start();
  db.exec("DROP TABLE standing_budget_reservations");
  expect(() => openStandingBudget(db, policy)).toThrow("standing-budget-corrupt");
  expect(() => transaction(() => initializeStandingBudget(db, policy))).toThrow(
    "standing-budget-already-initialized",
  );
});

it("rejects unsafe numeric inputs and freezes its allocation against caller mutation", () => {
  start();
  const mutable = { ...policy };
  const budget = openStandingBudget(db, mutable);
  mutable.hourlyLimit = 100;
  mutable.dailyLimit = 100;
  expect(() => transaction(() => budget.reserve("bad", "a", Number.NaN))).toThrow(
    "standing-budget-invalid-time",
  );
  expect(() => openStandingBudget(db, { ...policy, hourlyLimit: 0 })).toThrow(
    "standing-budget-invalid-policy",
  );
  transaction(() => budget.reserve("a", "a", 0));
  transaction(() => budget.reserve("b", "b", 0));
  expect(transaction(() => budget.reserve("c", "c", 0))).toEqual({
    kind: "held",
    reason: "hourly-limit",
  });
});
