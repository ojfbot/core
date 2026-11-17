import type { DatabaseSync } from "node:sqlite";
import { object } from "./admission.js";
import { openStandingBudget } from "./standing-budget.js";
import type { StandingBudgetPolicy } from "./standing-budget.js";
import type { DispatchDisposition, RefusalReason } from "./types.js";

const reasons: readonly RefusalReason[] = [
  "invalid-request",
  "unassigned",
  "binding-mismatch",
  "profile-mismatch",
  "grant-mismatch",
  "held",
  "not-yet-valid",
  "expired",
  "resource-denied",
  "budget-exhausted",
  "delivery-conflict",
  "live-not-armed",
  "standing-hourly-limit",
  "standing-daily-limit",
  "standing-clock-rollback",
  "standing-effect-conflict",
  "standing-origin-denied",
  "standing-policy-revoked",
  "standing-policy-changed",
  "standing-policy-missing",
];
const exact = (value: Record<string, unknown>, keys: string) =>
  Object.keys(value).sort().join(",") === keys;
/** Validate persisted discriminants and terminal values in JS: SQL NULL is never acceptance. */
export function parseStoredDisposition(row: unknown): DispatchDisposition {
  try {
    if (!object(row) || typeof row.disposition !== "string") throw Error();
    const value: unknown = JSON.parse(row.disposition);
    if (!object(value)) throw Error();
    if (value.kind === "refused") {
      if (
        row.state !== "observed" ||
        !exact(value, "kind,reason") ||
        !reasons.includes(value.reason as RefusalReason)
      )
        throw Error();
    } else {
      if (
        typeof value.dispatchId !== "string" ||
        value.dispatchId !== row.dispatch_id ||
        typeof value.nativeSessionId !== "string" ||
        !value.nativeSessionId ||
        value.nativeSessionId !== row.native_session ||
        !(
          value.nativeTurnId === null ||
          (typeof value.nativeTurnId === "string" && value.nativeTurnId.length > 0)
        ) ||
        value.nativeTurnId !== row.native_turn
      )
        throw Error();
      if (value.kind === "unknown") {
        if (
          !["dispatching", "unknown"].includes(String(row.state)) ||
          value.reason !== "invocation-unresolved" ||
          !exact(value, "dispatchId,kind,nativeSessionId,nativeTurnId,reason")
        )
          throw Error();
      } else if (value.kind === "observed") {
        if (
          row.state !== "observed" ||
          !exact(value, "dispatchId,kind,nativeSessionId,nativeTurnId,outcome") ||
          ![
            "completed",
            "failed",
            "interrupted",
            "approval-blocked",
            "authentication-blocked",
          ].includes(String(value.outcome))
        )
          throw Error();
      } else throw Error();
    }
    return value as unknown as DispatchDisposition;
  } catch {
    throw Error("standing-budget-corrupt");
  }
}

/** Shared by runtime opens and one-shot read-only recovery; this never creates or repairs state. */
export function validateStandingJournal(
  db: DatabaseSync,
  budget: StandingBudgetPolicy,
  journalSource: "standing-live" | "standing-emulated",
): string {
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name),
  );
  for (const name of [
    "invocation_meta",
    "invocations",
    "controllers",
    "budgets",
    "grant_usage",
    "advisory_proposals",
    "turn_refusals",
    "journal_source",
    "standing_aliases",
    "standing_closed_grants",
    "standing_authorities",
    "standing_inputs",
    "standing_journal_instance",
  ])
    if (!tables.has(name)) throw Error("standing-budget-corrupt");
  const instances = db.prepare("SELECT * FROM standing_journal_instance").all();
  const instance = instances[0];
  if (
    instances.length !== 1 ||
    !instance ||
    instance.only !== 1 ||
    typeof instance.instance_id !== "string" ||
    !/^[a-f0-9]{64}$/.test(instance.instance_id)
  )
    throw Error("standing-budget-corrupt");
  openStandingBudget(db, budget);
  const sources = db.prepare("SELECT * FROM journal_source").all();
  const versions = db.prepare("SELECT * FROM invocation_meta").all();
  const badAliases = db
    .prepare(
      `SELECT count(*) AS n FROM standing_aliases a
  LEFT JOIN invocations i ON i.dispatch_id=a.dispatch_id
  LEFT JOIN invocations original ON original.delivery_id=a.delivery_id
  WHERE i.dispatch_id IS NULL OR (original.dispatch_id IS NOT NULL AND original.dispatch_id!=a.dispatch_id)`,
    )
    .get()?.n;
  const closures = db.prepare("SELECT * FROM standing_closed_grants").all();
  if (
    sources.length !== 1 ||
    sources[0].only !== 1 ||
    sources[0].source !== journalSource ||
    versions.length !== 1 ||
    versions[0].version !== 1 ||
    badAliases !== 0 ||
    closures.some(
      (row) =>
        typeof row.authority_id !== "string" ||
        !/^[a-f0-9]{64}$/.test(row.authority_id) ||
        typeof row.reason !== "string" ||
        ![
          "expired",
          "standing-policy-changed",
          "standing-policy-missing",
          "standing-policy-revoked",
        ].includes(row.reason),
    )
  )
    throw Error("standing-budget-corrupt");
  const bad = db
    .prepare(
      `SELECT count(*) AS n FROM standing_budget_reservations r
  LEFT JOIN invocations i ON i.dispatch_id=r.effect_id WHERE i.dispatch_id IS NULL
  OR i.request_digest!=r.payload_digest OR i.admitted_at!=r.admitted_at`,
    )
    .get()?.n;
  const absent = db
    .prepare(
      `SELECT count(*) AS n FROM invocations i
  LEFT JOIN standing_budget_reservations r ON i.dispatch_id=r.effect_id WHERE r.effect_id IS NULL`,
    )
    .get()?.n;
  const missingController = db
    .prepare(
      `SELECT count(*) AS n FROM invocations i LEFT JOIN controllers c USING(dispatch_id)
  WHERE i.state!='observed' AND (c.dispatch_id IS NULL OR c.session_key!=i.session_key)`,
    )
    .get()?.n;
  const strayController = db
    .prepare(
      `SELECT count(*) AS n FROM controllers c LEFT JOIN invocations i USING(dispatch_id)
  WHERE i.dispatch_id IS NULL OR i.state='observed'`,
    )
    .get()?.n;
  const invocationRows = db.prepare("SELECT * FROM invocations").all();
  for (const row of invocationRows) parseStoredDisposition(row);
  const counts = db
    .prepare(
      `SELECT json_extract(i.authorization,'$.grant.budgetScope') AS budget,
  json_extract(i.authorization,'$.grant.charterId') AS charter,
  json_extract(i.authorization,'$.grant.bindingAlias') AS alias, r.state
  FROM invocations i JOIN standing_budget_reservations r ON i.dispatch_id=r.effect_id`,
    )
    .all();
  const budgetCounts = new Map<string, number>(),
    grantCounts = new Map<string, number>();
  for (const row of counts) {
    if (
      typeof row.budget !== "string" ||
      typeof row.charter !== "string" ||
      typeof row.alias !== "string"
    )
      throw Error("standing-budget-corrupt");
    const charge = row.state === "refunded" ? 0 : 1;
    budgetCounts.set(row.budget, (budgetCounts.get(row.budget) ?? 0) + charge);
    const key = JSON.stringify([row.charter, row.alias]);
    grantCounts.set(key, (grantCounts.get(key) ?? 0) + charge);
  }
  for (const [table, expected] of [
    ["budgets", budgetCounts],
    ["grant_usage", grantCounts],
  ] as const) {
    const stored = db.prepare(`SELECT * FROM ${table}`).all();
    for (const row of stored) {
      if (
        typeof row.scope !== "string" ||
        !Number.isSafeInteger(row.used) ||
        !Number.isSafeInteger(row.lim) ||
        Number(row.lim) < 1 ||
        row.used !== (expected.get(row.scope) ?? 0)
      )
        throw Error("standing-budget-corrupt");
      expected.delete(row.scope);
    }
    if (expected.size) throw Error("standing-budget-corrupt");
  }
  if ([bad, absent, missingController, strayController].some((n) => n !== 0))
    throw Error("standing-budget-corrupt");
  const inputs = db.prepare("SELECT * FROM standing_inputs").all();
  const hashes = /^[a-f0-9]{64}$/;
  for (const row of inputs) {
    if (
      typeof row.delivery_id !== "string" ||
      typeof row.input_digest !== "string" ||
      !hashes.test(row.input_digest) ||
      !db.prepare("SELECT 1 FROM invocations WHERE dispatch_id=?").get(String(row.dispatch_id))
    )
      throw Error("standing-budget-corrupt");
  }
  if (
    db
      .prepare(
        "SELECT count(*) AS n FROM invocations i LEFT JOIN standing_inputs s ON s.delivery_id=i.delivery_id WHERE s.dispatch_id IS NULL OR s.dispatch_id!=i.dispatch_id",
      )
      .get()?.n !== 0
  )
    throw Error("standing-budget-corrupt");
  if (
    db
      .prepare(
        `SELECT count(*) AS n FROM standing_inputs s LEFT JOIN invocations i ON i.dispatch_id=s.dispatch_id LEFT JOIN standing_aliases a ON a.delivery_id=s.delivery_id WHERE i.delivery_id!=s.delivery_id AND (a.dispatch_id IS NULL OR a.dispatch_id!=s.dispatch_id)`,
      )
      .get()?.n !== 0
  )
    throw Error("standing-budget-corrupt");
  if (
    db
      .prepare(
        `SELECT count(*) AS n FROM standing_aliases a LEFT JOIN standing_inputs s USING(delivery_id) WHERE s.dispatch_id IS NULL OR s.dispatch_id!=a.dispatch_id`,
      )
      .get()?.n !== 0
  )
    throw Error("standing-budget-corrupt");
  for (const row of db.prepare("SELECT * FROM standing_authorities").all())
    if (
      typeof row.path !== "string" ||
      !row.path.startsWith("/") ||
      typeof row.authority_id !== "string" ||
      !hashes.test(row.authority_id)
    )
      throw Error("standing-budget-corrupt");
  return instance.instance_id;
}
