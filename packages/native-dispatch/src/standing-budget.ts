import type { DatabaseSync } from "node:sqlite";

/** Internal accounting seam, not an authority grant or a public dispatch entry point. */
export interface StandingBudgetPolicy {
  /** Stable across policy revisions, aliases and renewal. */
  lineageId: string;
  deviceId: string;
  hourlyLimit: number;
  dailyLimit: number;
}

type ReservationState = "reserved" | "started" | "refunded";
type Reservation =
  | { kind: "new" }
  | { kind: "prior"; state: ReservationState }
  | { kind: "held"; reason: "hourly-limit" | "daily-limit" | "clock-rollback" | "effect-conflict" };

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function checkedPolicy(policy: StandingBudgetPolicy): StandingBudgetPolicy {
  if (
    !policy ||
    typeof policy.lineageId !== "string" ||
    !identifier.test(policy.lineageId) ||
    typeof policy.deviceId !== "string" ||
    !identifier.test(policy.deviceId) ||
    !Number.isSafeInteger(policy.hourlyLimit) ||
    !Number.isSafeInteger(policy.dailyLimit) ||
    policy.hourlyLimit < 1 ||
    policy.dailyLimit < policy.hourlyLimit
  )
    throw Error("standing-budget-invalid-policy");
  return { ...policy };
}
function inTransaction(db: DatabaseSync): void {
  // Reservations must commit with the caller's invocation intent (or roll back with it).
  if (!db.isTransaction) throw Error("standing-budget-transaction-required");
}
function tables(db: DatabaseSync): Set<string> {
  return new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => String(row.name)),
  );
}

/**
 * Explicit bootstrap only. Runtime open MUST NOT call this on missing state. The caller owns
 * private-file checks, the exclusive controller lock, and a transaction on the invocation DB.
 * The original allocation is a ceiling: this seam never silently increases or resets it.
 */
export function initializeStandingBudget(db: DatabaseSync, input: StandingBudgetPolicy): void {
  inTransaction(db);
  const policy = checkedPolicy(input);
  const existing = tables(db);
  if (existing.has("standing_budget_meta") || existing.has("standing_budget_reservations"))
    throw Error("standing-budget-already-initialized");
  db.exec(`
    CREATE TABLE standing_budget_meta(
      only INTEGER PRIMARY KEY CHECK(only=1), version INTEGER NOT NULL CHECK(version=1),
      lineage TEXT NOT NULL, device TEXT NOT NULL,
      hourly_ceiling INTEGER NOT NULL CHECK(hourly_ceiling>0),
      daily_ceiling INTEGER NOT NULL CHECK(daily_ceiling>=hourly_ceiling),
      high_water INTEGER NOT NULL CHECK(high_water>=0),
      reservation_count INTEGER NOT NULL CHECK(reservation_count>=0));
    CREATE TABLE standing_budget_reservations(
      effect_id TEXT PRIMARY KEY, payload_digest TEXT NOT NULL,
      admitted_at INTEGER NOT NULL CHECK(admitted_at>=0),
      state TEXT NOT NULL CHECK(state IN ('reserved','started','refunded')));
    CREATE INDEX standing_budget_time ON standing_budget_reservations(admitted_at);
  `);
  db.prepare("INSERT INTO standing_budget_meta VALUES(1,1,?,?,?,?,0,0)").run(
    policy.lineageId,
    policy.deviceId,
    policy.hourlyLimit,
    policy.dailyLimit,
  );
}

/**
 * The journal stores all reservations, including uncertain effects and refunds. It is not
 * pruned on renewal. A prior reservation is evidence to reconcile, never permission to launch
 * again. This helper adds no provider capability and cannot open a missing runtime journal.
 */
export function openStandingBudget(db: DatabaseSync, input: StandingBudgetPolicy) {
  const policy = checkedPolicy(input);
  const existing = tables(db);
  const metaExists = existing.has("standing_budget_meta");
  const rowsExist = existing.has("standing_budget_reservations");
  if (!metaExists && !rowsExist) throw Error("standing-budget-missing");
  if (!metaExists || !rowsExist) throw Error("standing-budget-corrupt");
  try {
    const all = db.prepare("SELECT * FROM standing_budget_meta").all();
    const meta = all[0];
    const count = db.prepare("SELECT count(*) AS n FROM standing_budget_reservations").get()?.n;
    const badRows = db
      .prepare(
        `SELECT count(*) AS n FROM standing_budget_reservations
      WHERE typeof(admitted_at)!='integer' OR admitted_at<0 OR admitted_at>?
      OR state NOT IN ('reserved','started','refunded') OR typeof(effect_id)!='text'
      OR typeof(payload_digest)!='text'`,
      )
      .get(Number(meta?.high_water ?? -1))?.n;
    if (
      badRows !== 0 ||
      all.length !== 1 ||
      !meta ||
      meta.only !== 1 ||
      meta.version !== 1 ||
      !Number.isSafeInteger(meta.high_water) ||
      Number(meta.high_water) < 0 ||
      !Number.isSafeInteger(meta.hourly_ceiling) ||
      Number(meta.hourly_ceiling) < 1 ||
      !Number.isSafeInteger(meta.daily_ceiling) ||
      Number(meta.daily_ceiling) < Number(meta.hourly_ceiling) ||
      count !== meta.reservation_count
    )
      throw Error("standing-budget-corrupt");
    if (
      meta.lineage !== policy.lineageId ||
      meta.device !== policy.deviceId ||
      policy.hourlyLimit > Number(meta.hourly_ceiling) ||
      policy.dailyLimit > Number(meta.daily_ceiling)
    )
      throw Error("standing-budget-policy-mismatch");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("standing-budget-")) throw error;
    throw Error("standing-budget-corrupt");
  }

  function state(effectId: string): ReservationState {
    const value = db
      .prepare("SELECT state FROM standing_budget_reservations WHERE effect_id=?")
      .get(effectId)?.state;
    if (value !== "reserved" && value !== "started" && value !== "refunded")
      throw Error("standing-budget-reservation-missing");
    return value;
  }
  return {
    reserve(effectId: string, payloadDigest: string, nowMs: number): Reservation {
      inTransaction(db);
      if (
        typeof effectId !== "string" ||
        typeof payloadDigest !== "string" ||
        !identifier.test(effectId) ||
        !identifier.test(payloadDigest)
      )
        throw Error("standing-budget-invalid-effect");
      if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw Error("standing-budget-invalid-time");
      const prior = db
        .prepare("SELECT payload_digest,state FROM standing_budget_reservations WHERE effect_id=?")
        .get(effectId);
      if (prior)
        return prior.payload_digest === payloadDigest
          ? { kind: "prior", state: state(effectId) }
          : { kind: "held", reason: "effect-conflict" };
      const highWater = db
        .prepare("SELECT high_water FROM standing_budget_meta WHERE only=1")
        .get()?.high_water;
      if (!Number.isSafeInteger(highWater)) throw Error("standing-budget-corrupt");
      if (nowMs < Number(highWater)) return { kind: "held", reason: "clock-rollback" };
      db.prepare("UPDATE standing_budget_meta SET high_water=? WHERE only=1").run(nowMs);
      const usage = db
        .prepare(
          `SELECT
        COALESCE(SUM(CASE WHEN admitted_at>? THEN 1 ELSE 0 END),0) AS hourly,
        count(*) AS daily FROM standing_budget_reservations
        WHERE admitted_at>? AND state!='refunded'`,
        )
        .get(nowMs - HOUR_MS, nowMs - DAY_MS);
      if (!usage || typeof usage.hourly !== "number" || typeof usage.daily !== "number")
        throw Error("standing-budget-corrupt");
      if (usage.hourly >= policy.hourlyLimit) return { kind: "held", reason: "hourly-limit" };
      if (usage.daily >= policy.dailyLimit) return { kind: "held", reason: "daily-limit" };
      db.prepare("INSERT INTO standing_budget_reservations VALUES(?,?,?,'reserved')").run(
        effectId,
        payloadDigest,
        nowMs,
      );
      db.exec("UPDATE standing_budget_meta SET reservation_count=reservation_count+1 WHERE only=1");
      return { kind: "new" };
    },
    /** Mark conservatively before external launch; unresolved starts remain charged. */
    markStarted(effectId: string): void {
      inTransaction(db);
      if (state(effectId) === "refunded") throw Error("standing-budget-effect-refunded");
      db.prepare("UPDATE standing_budget_reservations SET state='started' WHERE effect_id=?").run(
        effectId,
      );
    },
    /** Caller must establish no launch occurred, and commit the terminal refusal in this transaction. */
    refundBeforeLaunch(effectId: string): void {
      inTransaction(db);
      if (state(effectId) === "started") throw Error("standing-budget-effect-started");
      db.prepare("UPDATE standing_budget_reservations SET state='refunded' WHERE effect_id=?").run(
        effectId,
      );
    },
  };
}
