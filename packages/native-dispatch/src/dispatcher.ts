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
import { isSupervisedTransport } from "./supervised-native.js";
import type { SupervisedTransport } from "./supervised-native.js";
import { isCorrespondencePrelaunch, isCorrespondenceTransport } from "./correspondence-native.js";
import type { CorrespondenceTransport } from "./correspondence-native.js";
import type { CorrespondenceTurnRefusal } from "./correspondence-frames.js";
import type { RelayedCanaryProposal } from "./advisory.js";
import type {
  DispatchDisposition,
  DispatcherStatus,
  NativeEvidence,
  NativeOutcome,
  RefusalReason,
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
export interface Dispatcher<P = RelayedCanaryProposal> {
  dispatch(request: unknown, options?: { signal?: AbortSignal }): Promise<DispatchDisposition>;
  reconcile(evidence: NativeEvidence): DispatchDisposition;
  lookup(deliveryId: string): DispatchDisposition | undefined;
  agentProposal(deliveryId: string): P | undefined;
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
  // No correspondence source: it cannot open a marked correspondence journal.
  return openEngine(options, "mechanical", 5000, undefined, null);
}

/** Internal built-in transport seam; the public qualification factory stays qualification-only. */
export function openSupervisedDispatcher(
  options: Omit<DispatcherOptions, "transport"> & {
    transport: SupervisedTransport;
    beforeInvoke: () => RefusalReason | undefined;
  },
): Dispatcher {
  if (!isSupervisedTransport(options.transport)) throw Error("live-not-armed");
  return openEngine(options, "supervised", 120000, options.beforeInvoke, null);
}

/** Internal seam for correspondence windows (supervised) and their offline emulation (mechanical). */
export function openCorrespondenceDispatcher<P>(
  options: Omit<DispatcherOptions, "transport"> & {
    transport: CorrespondenceTransport;
    beforeInvoke?: () => RefusalReason | undefined;
    /** Duty windows and qualification runs keep separate journals. */
    qualification?: boolean;
    /** Claude versions this correspondence journal may run: the allowlist's (plus, for a
     * qualification run, the version being qualified). */
    claudeVersions: readonly string[];
  },
): CorrespondenceEngine<P> {
  if (!isCorrespondenceTransport(options.transport)) throw Error("live-not-armed");
  const live = options.transport.mode === "supervised";
  if (options.qualification && !live) throw Error("live-not-armed");
  return openEngine<P>(
    options,
    live ? "supervised" : "mechanical",
    120000,
    options.beforeInvoke,
    // The journal records its source; duty, qualification and emulation never share one.
    options.qualification ? "qualification" : live ? "live" : "emulated",
    options.claudeVersions,
  ) as CorrespondenceEngine<P>;
}
/** A correspondence engine also journals why an unknown turn was refused. */
export type CorrespondenceEngine<P> = Dispatcher<P> & {
  turnRefusal(deliveryId: string): CorrespondenceTurnRefusal | undefined;
  /** Claude's process group for a refused live turn, when the watchdog reported it. */
  turnProcessGroup(deliveryId: string): number | undefined;
};
/** Who opened a journal. `null` is an advisory or supervised opener with no correspondence marker. */
type JournalSource = "emulated" | "live" | "qualification" | null;

function openEngine<P = RelayedCanaryProposal>(
  options: Omit<DispatcherOptions, "transport"> & {
    transport: QualificationTransport | SupervisedTransport | CorrespondenceTransport;
  },
  mode: "mechanical" | "supervised",
  timeoutMs: number,
  beforeInvoke: (() => RefusalReason | undefined) | undefined,
  journalSource: JournalSource,
  claudeVersions?: readonly string[],
): Dispatcher<P> {
  if (!isAbsolute(options.stateFile)) throw Error("invalid-state-path");
  validateConfiguration(options, claudeVersions);
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
    db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
    // One transaction: check the source first, and create nothing if it is refused, so a refused
    // open leaves the journal unchanged.
    db.exec("BEGIN IMMEDIATE");
    try {
      const tables = new Set(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()
          .map((r) => r.name),
      );
      const marked = tables.has("journal_source")
        ? db.prepare("SELECT source FROM journal_source").get()?.source
        : undefined;
      const rows = tables.has("invocations")
        ? db.prepare("SELECT count(*) AS n FROM invocations").get()?.n
        : 0;
      // Correspondence rows, marked or not (a 0.4.0 journal is unmarked): fresh-session grants.
      const correspondenceRows = tables.has("invocations")
        ? db
            .prepare(
              `SELECT count(*) AS n FROM invocations WHERE
                 json_extract(authorization,'$.grant.workflow')='correspondence' OR
                 json_extract(authorization,'$.grant.operation')='native-fresh'`,
            )
            .get()?.n
        : 0;
      // A marked journal opens only for its own source. A correspondence opener also refuses an
      // unmarked journal that already holds rows: its source is unknown.
      if (
        journalSource === null
          ? marked !== undefined || correspondenceRows !== 0
          : marked !== undefined
            ? marked !== journalSource
            : rows !== 0
      )
        throw Error("journal-source-mismatch");
      db.exec(`CREATE TABLE IF NOT EXISTS invocation_meta(version INTEGER NOT NULL CHECK(version=1));
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
      if (journalSource !== null) {
        // Correspondence journals only; the advisory and supervised journal schema is unchanged.
        db.exec(`CREATE TABLE IF NOT EXISTS journal_source(only INTEGER PRIMARY KEY CHECK(only=1),
          source TEXT NOT NULL CHECK(source IN ('emulated','live','qualification')));
        CREATE TABLE IF NOT EXISTS turn_refusals(dispatch_id TEXT PRIMARY KEY,reason TEXT NOT NULL,
          process_group INTEGER);`);
        if (marked === undefined)
          db.prepare("INSERT INTO journal_source VALUES(1,?)").run(journalSource);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
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
  /** No native effect occurred. Refund this reservation atomically with its terminal refusal. */
  function refund(
    dispatchId: string,
    grant: { budgetScope: string; charterId: string; bindingAlias: string },
    reason: RefusalReason,
  ): DispatchDisposition {
    return transaction(() => {
      const result: DispatchDisposition = { kind: "refused", reason };
      db.prepare("UPDATE invocations SET state='observed',disposition=? WHERE dispatch_id=?").run(
        JSON.stringify(result),
        dispatchId,
      );
      db.prepare("DELETE FROM controllers WHERE dispatch_id=?").run(dispatchId);
      db.prepare("UPDATE budgets SET used=used-1 WHERE scope=?").run(grant.budgetScope);
      db.prepare("UPDATE grant_usage SET used=used-1 WHERE scope=?").run(
        JSON.stringify([grant.charterId, grant.bindingAlias]),
      );
      return result;
    });
  }
  const engine: Dispatcher<P> = {
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
        const hold = beforeInvoke?.();
        if (hold)
          return { kind: "prior" as const, result: { kind: "refused" as const, reason: hold } };
        const admission = decide(request, config, admittedAt, mode);
        if (admission.kind === "refused") return { kind: "prior" as const, result: admission };
        const { grant, profile } = admission;
        // A fresh-per-dispatch binding gets a new native session, journaled before any launch.
        const fresh = grant.operation === "native-fresh";
        const binding = fresh
          ? { ...admission.binding, nativeSessionId: randomUUID() }
          : admission.binding;
        const sessionKey = JSON.stringify(
          fresh
            ? [binding.deviceId, binding.provider, "fresh-per-dispatch", binding.alias]
            : [binding.deviceId, binding.provider, binding.nativeSessionId],
        );
        const held =
          mode === "supervised"
            ? db.prepare("SELECT dispatch_id FROM controllers LIMIT 1").get()
            : db.prepare("SELECT dispatch_id FROM controllers WHERE session_key=?").get(sessionKey);
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
      const prelaunchHold = beforeInvoke?.();
      const remainingMs = grant.expiresAtMs - now();
      if (remainingMs <= 0 || prelaunchHold)
        return refund(dispatchId, grant, prelaunchHold ?? "expired");
      active.add(dispatchId);
      let refusal: string | undefined,
        processGroup: number | null = null;
      try {
        const observation = await transport.resume({
          binding,
          profile,
          request,
          dispatchId,
          signal: settings.signal ?? new AbortController().signal,
          timeoutMs: Math.min(timeoutMs, remainingMs),
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
        const reported = (observation as { refusal?: unknown }).refusal;
        const group = (observation as { processGroup?: unknown }).processGroup;
        if (journalSource && typeof reported === "string" && /^[a-z-]{1,64}$/.test(reported))
          refusal = reported;
        if (typeof group === "number" && Number.isSafeInteger(group) && group > 1)
          processGroup = group;
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
      } catch (error) {
        // Proven before any process started: refund it, as for a hold before launch.
        if (journalSource !== null && isCorrespondencePrelaunch(error)) {
          active.delete(dispatchId);
          return refund(dispatchId, grant, error.reason);
        }
        // Once an effect intent is durable, a lost response is held, even if the process exited zero.
      } finally {
        active.delete(dispatchId);
      }
      return transaction(() => {
        db.prepare("UPDATE invocations SET state='unknown' WHERE dispatch_id=?").run(dispatchId);
        if (refusal)
          db.prepare("INSERT OR IGNORE INTO turn_refusals VALUES(?,?,?)").run(
            dispatchId,
            refusal,
            processGroup,
          );
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
      return JSON.parse(row.proposal) as P;
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
        ...(mode === "mechanical"
          ? { mode: "mechanical" as const, realProviderCalls: 0 as const }
          : { mode: "supervised" as const, realProviderCalls: null }),
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
  if (journalSource === null) return engine;
  return {
    ...engine,
    turnRefusal: (deliveryId: string) => {
      const row = db
        .prepare(
          "SELECT reason FROM turn_refusals JOIN invocations USING(dispatch_id) WHERE delivery_id=?",
        )
        .get(deliveryId);
      // Only the correspondence transport's closed reason set is written here.
      return typeof row?.reason === "string"
        ? (row.reason as CorrespondenceTurnRefusal)
        : undefined;
    },
    turnProcessGroup: (deliveryId: string) => {
      const row = db
        .prepare(
          "SELECT process_group FROM turn_refusals JOIN invocations USING(dispatch_id) WHERE delivery_id=?",
        )
        .get(deliveryId);
      return typeof row?.process_group === "number" ? row.process_group : undefined;
    },
  } as Dispatcher<P>;
}
