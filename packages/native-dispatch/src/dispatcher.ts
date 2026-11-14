import { randomUUID } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute } from "node:path";
import type { DatabaseSync as Database } from "node:sqlite";
import {
  decide,
  digest,
  object,
  parseDispatchRequest,
  validateConfiguration,
} from "./admission.js";
import type { DispatchConfiguration } from "./admission.js";
import { isQualificationTransport } from "./native.js";
import type { QualificationTransport } from "./native.js";
import type { RelayedCanaryProposal } from "./advisory.js";
import type {
  DispatchDisposition,
  DispatcherStatus,
  NativeEvidence,
  NativeOutcome,
} from "./types.js";

// Node's builtin is loaded directly: Vite 5 otherwise rewrites the unsupported node:sqlite import.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};

export interface DispatcherOptions extends DispatchConfiguration {
  stateFile: string;
  transport: QualificationTransport;
  now?: () => number;
}
export interface Dispatcher {
  dispatch(request: unknown, options?: { signal?: AbortSignal }): Promise<DispatchDisposition>;
  reconcile(evidence: NativeEvidence): DispatchDisposition;
  lookup(deliveryId: string): DispatchDisposition | undefined;
  agentProposal(deliveryId: string): RelayedCanaryProposal | undefined;
  status(): DispatcherStatus;
  close(): void;
}
const outcomes: NativeOutcome[] = [
  "completed",
  "failed",
  "interrupted",
  "approval-blocked",
  "authentication-blocked",
];

export function openDispatcher(options: DispatcherOptions): Dispatcher {
  if (!isQualificationTransport(options.transport)) throw Error("live-not-armed");
  if (!isAbsolute(options.stateFile)) throw Error("invalid-state-path");
  validateConfiguration(options);
  // Detach authority from mutable objects owned by a caller. It is never drawn from a delivery.
  const config: DispatchConfiguration = structuredClone({
    bindings: options.bindings,
    grants: options.grants,
    profiles: options.profiles,
  });
  for (const binding of config.bindings) binding.cwd = realpathSync(binding.cwd);
  const transport = options.transport,
    now = options.now ?? Date.now;
  mkdirSync(dirname(options.stateFile), { recursive: true, mode: 0o700 });
  try {
    const fd = openSync(options.stateFile, "wx", 0o600);
    closeSync(fd);
  } catch (error) {
    if (!(object(error) && error.code === "EEXIST")) throw error;
  }
  const info = lstatSync(options.stateFile);
  if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077)
    throw Error("unsafe-state-file");
  const db = new DatabaseSync(options.stateFile);
  try {
    if (process.platform === "darwin")
      db.exec("PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON;");
    // SQLite retains the OS lock until close, including between transactions.
    // A crashed process releases the lock without resolving its external invocation.
    db.exec("PRAGMA busy_timeout=0; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;");
  } catch (error) {
    db.close();
    if (object(error) && (error.errcode === 5 || error.errcode === 6))
      throw Error("dispatcher-already-open");
    throw error;
  }
  try {
    db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS invocation_meta(version INTEGER NOT NULL CHECK(version=1));
    INSERT INTO invocation_meta SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM invocation_meta);
    CREATE TABLE IF NOT EXISTS invocations(
      delivery_id TEXT PRIMARY KEY, dispatch_id TEXT UNIQUE NOT NULL, request_digest TEXT NOT NULL,
      session_key TEXT NOT NULL, native_session TEXT NOT NULL, native_turn TEXT,
      state TEXT NOT NULL CHECK(state IN ('dispatching','unknown','observed')),
      disposition TEXT NOT NULL, authorization TEXT NOT NULL, controller TEXT NOT NULL,
      admitted_at INTEGER NOT NULL, observed_at INTEGER);
    CREATE TABLE IF NOT EXISTS controllers(session_key TEXT PRIMARY KEY,dispatch_id TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS budgets(scope TEXT PRIMARY KEY,lim INTEGER NOT NULL,used INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS grant_usage(scope TEXT PRIMARY KEY,lim INTEGER NOT NULL,used INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS advisory_proposals(dispatch_id TEXT PRIMARY KEY,proposal TEXT NOT NULL);`);
  } catch (error) {
    db.close();
    throw error;
  }
  const active = new Set<string>(),
    controller = randomUUID();
  const transaction = <T>(run: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = run();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  function disposition(row: unknown): DispatchDisposition {
    if (!object(row) || typeof row.disposition !== "string")
      throw Error("invalid-invocation-state");
    // Only Core writes this owner-private database, and validates before each write.
    return JSON.parse(row.disposition) as DispatchDisposition;
  }
  function observe(evidence: NativeEvidence): DispatchDisposition {
    if (
      typeof evidence.dispatchId !== "string" ||
      typeof evidence.nativeSessionId !== "string" ||
      !(
        evidence.nativeTurnId === null ||
        (typeof evidence.nativeTurnId === "string" && evidence.nativeTurnId.length > 0)
      )
    )
      throw Error("evidence-mismatch");
    const row = db
      .prepare("SELECT * FROM invocations WHERE dispatch_id=?")
      .get(evidence.dispatchId);
    if (
      !row ||
      row.native_session !== evidence.nativeSessionId ||
      (row.native_turn !== null && row.native_turn !== evidence.nativeTurnId) ||
      !outcomes.includes(evidence.outcome)
    )
      throw Error("evidence-mismatch");
    const result: DispatchDisposition = {
      kind: "observed",
      dispatchId: evidence.dispatchId,
      nativeSessionId: evidence.nativeSessionId,
      nativeTurnId: evidence.nativeTurnId,
      outcome: evidence.outcome,
    };
    if (row.state === "observed") {
      if (JSON.stringify(disposition(row)) !== JSON.stringify(result))
        throw Error("evidence-conflict");
      return result;
    }
    db.prepare(
      "UPDATE invocations SET state='observed',disposition=?,native_turn=?,observed_at=? WHERE dispatch_id=?",
    ).run(JSON.stringify(result), evidence.nativeTurnId, now(), evidence.dispatchId);
    db.prepare("DELETE FROM controllers WHERE dispatch_id=?").run(evidence.dispatchId);
    return result;
  }
  return {
    dispatch: async (input, settings = {}) => {
      let request;
      try {
        request = parseDispatchRequest(input);
      } catch {
        return { kind: "refused", reason: "invalid-request" };
      }
      if (settings.signal?.aborted) return { kind: "refused", reason: "held" };
      const requestDigest = digest(JSON.stringify(request));
      const prepared = transaction(() => {
        const prior = db
          .prepare("SELECT * FROM invocations WHERE delivery_id=?")
          .get(request.deliveryId);
        if (prior)
          return {
            kind: "prior" as const,
            result:
              prior.request_digest === requestDigest
                ? disposition(prior)
                : { kind: "refused" as const, reason: "delivery-conflict" as const },
          };
        const admittedAt = now();
        const admission = decide(request, config, admittedAt);
        if (admission.kind === "refused") return { kind: "prior" as const, result: admission };
        const { binding, grant, profile } = admission;
        const sessionKey = JSON.stringify([
          binding.deviceId,
          binding.provider,
          binding.nativeSessionId,
        ]);
        const held = db
          .prepare("SELECT dispatch_id FROM controllers WHERE session_key=?")
          .get(sessionKey);
        if (held && typeof held.dispatch_id === "string")
          return {
            kind: "prior" as const,
            result: {
              kind: "busy" as const,
              reason: "session-busy" as const,
              dispatchId: held.dispatch_id,
            },
          };
        const grantScope = JSON.stringify([grant.charterId, grant.bindingAlias]);
        db.prepare("INSERT OR IGNORE INTO budgets VALUES(?,?,0)").run(
          grant.budgetScope,
          grant.scopeMaxInvocations,
        );
        db.prepare("INSERT OR IGNORE INTO grant_usage VALUES(?,?,0)").run(
          grantScope,
          grant.maxInvocations,
        );
        const budget = db
          .prepare("SELECT lim,used FROM budgets WHERE scope=?")
          .get(grant.budgetScope);
        const usage = db.prepare("SELECT lim,used FROM grant_usage WHERE scope=?").get(grantScope);
        if (
          !budget ||
          !usage ||
          typeof budget.used !== "number" ||
          typeof budget.lim !== "number" ||
          typeof usage.used !== "number" ||
          typeof usage.lim !== "number" ||
          budget.used >= Math.min(budget.lim, grant.scopeMaxInvocations) ||
          usage.used >= Math.min(usage.lim, grant.maxInvocations)
        )
          return {
            kind: "prior" as const,
            result: { kind: "refused" as const, reason: "budget-exhausted" as const },
          };
        const dispatchId = digest(JSON.stringify(["native-dispatch-v1", request.deliveryId]));
        const result: DispatchDisposition = {
          kind: "unknown",
          reason: "invocation-unresolved",
          dispatchId,
          nativeSessionId: binding.nativeSessionId,
          nativeTurnId: null,
        };
        db.prepare(
          "INSERT INTO invocations VALUES(?,?,?,?,?,NULL,'dispatching',?,?,?, ?,NULL)",
        ).run(
          request.deliveryId,
          dispatchId,
          requestDigest,
          sessionKey,
          binding.nativeSessionId,
          JSON.stringify(result),
          JSON.stringify({ binding, grant, profile }),
          controller,
          admittedAt,
        );
        db.prepare("INSERT INTO controllers VALUES(?,?)").run(sessionKey, dispatchId);
        db.prepare("UPDATE budgets SET used=used+1 WHERE scope=?").run(grant.budgetScope);
        db.prepare("UPDATE grant_usage SET used=used+1 WHERE scope=?").run(grantScope);
        return { kind: "new" as const, dispatchId, binding, grant, profile };
      });
      if (prepared.kind === "prior") return prepared.result;
      const { dispatchId, binding, grant, profile } = prepared;
      const remainingMs = grant.expiresAtMs - now();
      if (remainingMs <= 0)
        return transaction(() => {
          // No native effect occurred. Refund this reservation atomically with its terminal refusal.
          const result: DispatchDisposition = { kind: "refused", reason: "expired" };
          db.prepare(
            "UPDATE invocations SET state='observed',disposition=? WHERE dispatch_id=?",
          ).run(JSON.stringify(result), dispatchId);
          db.prepare("DELETE FROM controllers WHERE dispatch_id=?").run(dispatchId);
          db.prepare("UPDATE budgets SET used=used-1 WHERE scope=?").run(grant.budgetScope);
          db.prepare("UPDATE grant_usage SET used=used-1 WHERE scope=?").run(
            JSON.stringify([grant.charterId, grant.bindingAlias]),
          );
          return result;
        });
      active.add(dispatchId);
      try {
        const observation = await transport.resume({
          binding,
          profile,
          request,
          dispatchId,
          signal: settings.signal ?? new AbortController().signal,
          timeoutMs: Math.min(5_000, remainingMs),
          onStarted: (turnId) => {
            const result: DispatchDisposition = {
              kind: "unknown",
              reason: "invocation-unresolved",
              dispatchId,
              nativeSessionId: binding.nativeSessionId,
              nativeTurnId: turnId,
            };
            db.prepare(
              "UPDATE invocations SET native_turn=?,disposition=? WHERE dispatch_id=? AND state='dispatching'",
            ).run(turnId, JSON.stringify(result), dispatchId);
          },
        });
        const outcome = observation.outcome;
        if (outcome !== "unknown")
          return transaction(() => {
            const result = observe({
              dispatchId,
              nativeSessionId: observation.nativeSessionId,
              nativeTurnId: observation.nativeTurnId,
              outcome,
            });
            if (observation.agentProposal && outcome === "completed")
              db.prepare("INSERT OR IGNORE INTO advisory_proposals VALUES(?,?)").run(
                dispatchId,
                JSON.stringify(observation.agentProposal),
              );
            return result;
          });
      } catch {
        // Once an effect intent is durable, a lost response is held, even if the process exited zero.
      } finally {
        active.delete(dispatchId);
      }
      return transaction(() => {
        db.prepare("UPDATE invocations SET state='unknown' WHERE dispatch_id=?").run(dispatchId);
        return disposition(
          db.prepare("SELECT * FROM invocations WHERE dispatch_id=?").get(dispatchId),
        );
      });
    },
    reconcile: (evidence) => {
      if (active.has(evidence.dispatchId)) throw Error("invocation-still-active");
      return transaction(() => observe(evidence));
    },
    lookup: (deliveryId) => {
      const row = db.prepare("SELECT * FROM invocations WHERE delivery_id=?").get(deliveryId);
      return row ? disposition(row) : undefined;
    },
    agentProposal: (deliveryId) => {
      const row = db
        .prepare(
          "SELECT proposal FROM advisory_proposals JOIN invocations USING(dispatch_id) WHERE delivery_id=? AND state='observed'",
        )
        .get(deliveryId);
      if (!row) return undefined;
      if (typeof row.proposal !== "string") throw Error("invalid-advisory-state");
      // This owner-private record is written only after parseCanaryProposal accepts the native data.
      return JSON.parse(row.proposal) as RelayedCanaryProposal;
    },
    status: () => {
      const count = db
        .prepare("SELECT count(*) AS n FROM invocations WHERE state!='observed'")
        .get();
      const used = db.prepare("SELECT count(*) AS n FROM invocations").get();
      if (typeof count?.n !== "number" || typeof used?.n !== "number")
        throw Error("invalid-invocation-state");
      return {
        schemaVersion: 1,
        mode: "mechanical",
        realProviderCalls: 0,
        active: active.size,
        unknown: Math.max(0, count.n - active.size),
        reservations: used.n,
      };
    },
    close: () => {
      if (active.size) throw Error("invocation-still-active");
      db.close();
    },
  };
}
