import {
  existsSync,
  lstatSync,
  openSync,
  closeSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { fleetClient, type FleetClient } from "./client.js";
import { commandHandler } from "./declared-worker.js";
import { canonicalJson, jobKey, JobError, type Claim, type JobOutput } from "./jobs.js";
import { releaseInfo } from "./version.js";
import { workOnce } from "./worker.js";
import { parseWorkerSettings, type WorkerSettings } from "./worker-settings.js";
import { ProofJournal } from "./ledger-proof-state.js";
import {
  parseProofCommand,
  verifyProofCommand,
  runProofCommand,
  ProofCommandError,
  type ProofCommand,
} from "./ledger-proof-command.js";
import {
  directoryBytes,
  exact,
  integer,
  ledgerSpec,
  proofTimeEligible,
  object,
  parseLedgerProof,
  privatePath,
  proofHash,
  proofSnapshotSchema,
  readPrivateJson,
  string,
  verifyAccepted,
  verifyAdmission,
  verifyClaim,
  type LedgerProof,
  type ProofSnapshot,
} from "./ledger-proof.js";

type Role = "primary" | "fallback" | "supervisor" | "watchdog";
export interface ProofRuntime {
  proof: LedgerProof;
  role: Role;
  stateFile: string;
  evidenceDir: string;
  cpuSlot: string;
  pauseFile: string;
  reservationFile: string;
  settings: WorkerSettings;
  artifacts: Record<string, string>;
  commands: {
    probe: ProofCommand;
    snapshot: ProofCommand;
    post: ProofCommand;
    stop: ProofCommand;
    fault: ProofCommand;
    faultEvidence: ProofCommand;
  };
}
export function parseProofRuntime(value: unknown): ProofRuntime {
  const row = exact(value, [
    "proof",
    "role",
    "stateFile",
    "evidenceDir",
    "cpuSlot",
    "pauseFile",
    "reservationFile",
    "settings",
    "commands",
    "artifacts",
  ]);
  const proof = parseLedgerProof(row.proof),
    role = string(row.role);
  if (!["primary", "fallback", "supervisor", "watchdog"].includes(role))
    throw Error("invalid-proof-role");
  const rawSettings = object(row.settings);
  const ownerRole = role === "supervisor" || role === "watchdog";
  if (proof.practice && ownerRole) throw Error("proof-practice-worker-required");
  if (ownerRole && rawSettings.worker !== "owner") throw Error("proof-owner-identity-mismatch");
  // The existing worker parser deliberately rejects the reserved owner ID. It still validates
  // all shared connection/path/command settings here; the supervisor is never run as a worker.
  const settings = parseWorkerSettings(
    ownerRole ? { ...rawSettings, worker: proof.primary } : rawSettings,
  );
  if (ownerRole) settings.worker = "owner";
  if (
    settings.pollMs !== 5000 ||
    Object.keys(settings.kinds).join() !== "bookcase-ledger-replay" ||
    canonicalJson(settings.kinds["bookcase-ledger-replay"]!.capabilities) !==
      canonicalJson([proof.capability]) ||
    settings.kinds["bookcase-ledger-replay"]!.timeoutMs > 120_000 ||
    settings.worker !==
      (role === "primary" ? proof.primary : role === "fallback" ? proof.fallback : "owner")
  )
    throw Error("proof-worker-settings-mismatch");
  const artifactRow = object(row.artifacts),
    artifacts: Record<string, string> = {};
  if (Object.keys(artifactRow).length < 2 || Object.keys(artifactRow).length > 64)
    throw Error("proof-artifact-manifest-invalid");
  for (const [file, digest] of Object.entries(artifactRow))
    artifacts[privatePath(file)] = string(digest, /^[a-f0-9]{64}$/);
  const appCommand = settings.kinds["bookcase-ledger-replay"]!.command;
  if (
    appCommand.length !== 4 ||
    appCommand[2] !== "--grant" ||
    !artifacts[appCommand[0]] ||
    !artifacts[privatePath(appCommand[1])]
  )
    throw Error("proof-installed-command-mismatch");
  privatePath(appCommand[3]);
  const commands = exact(row.commands, [
    "probe",
    "snapshot",
    "post",
    "stop",
    "fault",
    "faultEvidence",
  ]);
  return {
    proof,
    role: role as Role,
    stateFile: privatePath(row.stateFile),
    evidenceDir: privatePath(row.evidenceDir),
    cpuSlot: privatePath(row.cpuSlot),
    pauseFile: privatePath(row.pauseFile),
    reservationFile: privatePath(row.reservationFile),
    settings,
    artifacts,
    commands: {
      probe: parseProofCommand(commands.probe),
      snapshot: parseProofCommand(commands.snapshot),
      post: parseProofCommand(commands.post),
      stop: parseProofCommand(commands.stop),
      fault: parseProofCommand(commands.fault),
      faultEvidence: parseProofCommand(commands.faultEvidence),
    },
  };
}
export function loadProofRuntime(file: string, digest: string): ProofRuntime {
  const raw = readPrivateJson(file);
  if (proofHash(canonicalJson(raw)) !== string(digest, /^[a-f0-9]{64}$/))
    throw Error("proof-config-digest-mismatch");
  return parseProofRuntime(raw);
}
function privateDirectory(path: string): void {
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid?.() ||
    stat.mode & 0o077
  )
    throw Error("unsafe-proof-directory");
}
function budget(config: ProofRuntime): void {
  privateDirectory(config.evidenceDir);
  privateDirectory(config.settings.outDir);
  directoryBytes(config.evidenceDir, 127 * 1024 * 1024);
  directoryBytes(config.settings.outDir, 63 * 1024 * 1024);
}
function active(proof: LedgerProof, journal: ProofJournal, now = Date.now()): void {
  journal.advanceClock(now);
  if (
    now < proof.startsAtMs ||
    now >= proof.endsAtMs ||
    now >= proof.approvalExpiresAtMs ||
    journal.get("terminal")
  )
    throw Error("proof-not-active");
}
class ProofReadinessHold extends Error {}
export const ATTENDED_PREARM_LEAD_MS = 10 * 60_000;
const READY_REPORT_LEAD_MS = 30_000;
const READY_GRACE_MS = 15_000;
// Two 120-second computations, the 300-second lease, and time for pickup, verification and cleanup.
const WORKER_STOP_REMAINING_MS = 12 * 60_000;
const WORKER_STOP_READY_FRESH_MS = 30_000;

function recordProofStep(journal: ProofJournal, stage: string, reason?: string): void {
  const value = { stage, ...(reason ? { reason } : {}) };
  const last = journal.get("progress");
  if (last && canonicalJson(object(last).value) === canonicalJson(value)) return;
  const atMs = Date.now();
  journal.observe("progress", value, atMs);
  journal.put("progress", { value, atMs });
}

function retryableEvidence(error: unknown): boolean {
  return (
    error instanceof ProofReadinessHold ||
    [
      "invalid-ledger-proof",
      "proof-invalid-readiness-receipt",
      "proof-command-failed",
      "proof-command-invalid-output",
      "proof-command-timeout",
      "proof-clock-uncertainty",
    ].includes(failureCode(error))
  );
}

async function probe(config: ProofRuntime, signal?: AbortSignal): Promise<void> {
  if (existsSync(config.pauseFile) || existsSync(config.reservationFile))
    throw Error("proof-local-paused");
  const result = await runProofCommand(
    config.commands.probe,
    { proofId: config.proof.proofId, role: config.role },
    signal,
  );
  if (config.proof.practice || config.proof.faultMode === "worker-stop") {
    const row = exact(result, ["proofId", "observedAtMs", "protectedIdle", "baselineUnchanged"]);
    if (row.proofId !== config.proof.proofId) throw Error("proof-probe-binding-mismatch");
    if (typeof row.protectedIdle !== "boolean" || typeof row.baselineUnchanged !== "boolean")
      throw Error("proof-invalid-readiness-receipt");
    if (row.baselineUnchanged !== true) throw Error("proof-protected-baseline-changed");
    if (row.protectedIdle !== true) throw new ProofReadinessHold("proof-protected-work-active");
    if (Math.abs(Date.now() - integer(row.observedAtMs)) > 10_000)
      throw new ProofReadinessHold("proof-readiness-receipt-stale");
    return;
  }
  const row = exact(result, [
    "proofId",
    "observedAtMs",
    "loggedIn",
    "appsClosed",
    "screenLocked",
    "protectedIdle",
    "ac",
    "wakeReady",
  ]);
  if (
    row.proofId !== config.proof.proofId ||
    Math.abs(Date.now() - integer(row.observedAtMs)) > 10_000 ||
    [row.loggedIn, row.appsClosed, row.screenLocked, row.protectedIdle, row.ac, row.wakeReady].some(
      (value) => typeof value !== "boolean",
    )
  )
    throw Error("proof-invalid-readiness-receipt");
  if (!row.protectedIdle) throw Error("proof-protected-work-active");
  if (!row.loggedIn) throw new ProofReadinessHold("proof-session-logged-out");
  if (!row.appsClosed) throw new ProofReadinessHold("proof-coding-apps-open");
  if (!row.screenLocked) throw new ProofReadinessHold("proof-screen-unlocked");
  if (config.role === "primary") {
    if (!row.ac) throw new ProofReadinessHold("proof-ac-power-unavailable");
    if (!row.wakeReady) throw new ProofReadinessHold("proof-wake-unverified");
    if (!proofTimeEligible(Date.now(), config.proof))
      throw new ProofReadinessHold(
        config.proof.attendedWindow
          ? "proof-outside-attended-window"
          : "proof-outside-night-window",
      );
  }
}
export function parseProofSnapshot(value: unknown): ProofSnapshot {
  const row = exact(value, ["schema", "serverNowMs", "rows", "events", "accepted"]);
  integer(row.schema);
  integer(row.serverNowMs);
  if (
    !Array.isArray(row.rows) ||
    row.rows.length > 2 ||
    !Array.isArray(row.events) ||
    row.events.length > 256 ||
    !(row.accepted === null || (typeof row.accepted === "string" && row.accepted.length <= 8192))
  )
    throw Error("invalid-proof-snapshot");
  for (const item of row.rows) {
    const r = exact(item, [
      "key",
      "spec",
      "status",
      "attempts",
      "fence",
      "worker",
      "leaseExpires",
      "output",
      "outputFile",
    ]);
    string(r.key, /^[a-f0-9]{64}$/);
    object(r.spec);
    string(r.status, /^(ready|claimed|done|failed)$/);
    integer(r.attempts);
    integer(r.fence);
    for (const key of ["worker", "output", "outputFile"]) if (r[key] !== null) string(r[key]);
    if (r.leaseExpires !== null) integer(r.leaseExpires);
  }
  for (const item of row.events) {
    const e = exact(item, ["seq", "ts", "key", "type", "worker", "fence", "leaseExpiredAtMs"]);
    integer(e.seq);
    integer(e.ts);
    string(e.key, /^[a-f0-9]{64}$/);
    string(e.type);
    if (e.worker !== null) string(e.worker);
    if (e.fence !== null) integer(e.fence);
    if (e.leaseExpiredAtMs !== null) integer(e.leaseExpiredAtMs);
  }
  return row as unknown as ProofSnapshot;
}
async function snapshot(
  config: ProofRuntime,
  journal: ProofJournal,
  verify = true,
  signal?: AbortSignal,
): Promise<ProofSnapshot> {
  const started = Date.now();
  let raw: unknown;
  try {
    raw = await runProofCommand(
      config.commands.snapshot,
      { proofId: config.proof.proofId },
      signal,
    );
  } catch (error) {
    if (error instanceof ProofCommandError) {
      journal.observe("private-command-failure", {
        action: "queue-snapshot",
        ...error.privateReceipt(),
      });
    }
    throw error;
  }
  const value = parseProofSnapshot(raw);
  const ended = Date.now();
  journal.put("snapshot-time", {
    started,
    ended,
    serverNowMs: value.serverNowMs,
    uncertaintyMs: ended - started,
  });
  if (Math.abs(value.serverNowMs - (started + ended) / 2) > 2000 + ended - started)
    throw Error("proof-clock-uncertainty");
  if (verify) verifyAdmission(config.proof, value);
  return value;
}
function failureCode(error: unknown): string {
  return error instanceof Error && /^proof-[a-z0-9-]{1,72}$/.test(error.message)
    ? error.message
    : "proof-operation-failed";
}
function hold(journal: ProofJournal, reason: string): void {
  if (!journal.get("terminal")) {
    journal.put("terminal", { outcome: "HELD", reason, atMs: Date.now() });
    journal.observe("held", { reason });
  }
}
async function post(
  config: ProofRuntime,
  journal: ProofJournal,
  name: string,
  body: unknown,
  frozenCommandId?: string,
): Promise<void> {
  const commandIdName = `${name}-command-id`;
  if (!journal.get(commandIdName)) journal.put(commandIdName, frozenCommandId ?? randomUUID());
  if (frozenCommandId && journal.get(commandIdName) !== frozenCommandId)
    throw Error("proof-report-command-conflict");
  const commandId = string(journal.get(commandIdName));
  const input = { proofId: config.proof.proofId, commandId, body };
  if (journal.reserve(name, input) === "done") return;
  const receipt = object(await runProofCommand(config.commands.post, input));
  if (
    receipt.accepted !== true ||
    receipt.commandId !== commandId ||
    receipt.readbackVerified !== true
  )
    throw Error("proof-report-unacknowledged");
  integer(receipt.sequence);
  journal.finish(name, receipt);
}

async function publishReadiness(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  await probe(config, signal);
  const slotMs = config.proof.faultMode ? 10_000 : 5000;
  const slot = Math.floor(Date.now() / slotMs);
  await post(config, journal, `ready-${String(journal.get("worker-starts"))}-${slot}`, {
    state: "READY",
    role: config.role,
    observedAtMs: slot * slotMs,
    idleRestartVerified: journal.get("idle-stopped") === true,
    code: config.proof.code,
    fixtureSha256: config.proof.fixtureSha256,
  });
}

async function workerStopReadiness(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  const last = journal.get("worker-readiness-at");
  if (typeof last === "number" && Date.now() - last < 5000) return;
  journal.put("worker-readiness-at", Date.now());
  try {
    await publishReadiness(config, journal, signal);
    recordProofStep(journal, "ready");
  } catch (error) {
    recordProofStep(journal, "worker-readiness", failureCode(error));
    if (!retryableEvidence(error)) throw error;
  }
}

function parsePracticeStop(config: ProofRuntime, settingsSha256: string, value: unknown) {
  const input = exact(value, [
    "verified",
    "proofId",
    "role",
    "settingsSha256",
    "commandId",
    "sourceSequence",
  ]);
  if (
    !config.proof.practice ||
    (config.role !== "primary" && config.role !== "fallback") ||
    input.verified !== true ||
    input.proofId !== config.proof.proofId ||
    input.role !== config.role ||
    input.settingsSha256 !== settingsSha256
  )
    throw Error("proof-practice-stop-binding-mismatch");
  return {
    verified: true,
    proofId: config.proof.proofId,
    role: config.role,
    settingsSha256,
    commandId: string(input.commandId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/),
    sourceSequence: integer(input.sourceSequence),
  };
}

export function requestPracticeStop(
  config: ProofRuntime,
  journal: ProofJournal,
  settingsSha256: string,
  value: unknown,
) {
  const stop = parsePracticeStop(config, settingsSha256, value);
  const ready = journal.result("practice-ready");
  const window = config.proof.attendedWindow;
  const now = Date.now();
  if (
    !ready ||
    !window ||
    stop.sourceSequence <= integer(object(ready).sequence) ||
    now < window.notBeforeMs ||
    now >= config.proof.endsAtMs
  )
    throw Error("proof-practice-stop-outside-window");
  if (!journal.recordPracticeStop(stop)) throw Error("proof-practice-stop-already-recorded");
  return stop;
}

async function runPracticeWorker(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
  settingsSha256: string,
): Promise<void> {
  const { proof, role } = config;
  const window = proof.attendedWindow;
  if (
    !window ||
    Date.now() < Math.max(window.notBeforeMs, proof.startsAtMs - ATTENDED_PREARM_LEAD_MS)
  )
    throw Error("proof-prearm-too-early");
  if (journal.get("terminal") || journal.result("practice-ready"))
    throw Error("proof-practice-already-started");
  budget(config);
  const grant = config.settings.kinds["bookcase-ledger-replay"]?.command[3];
  if (!grant) throw Error("proof-installed-command-mismatch");
  const client = fleetClient(
    config.settings.endpoint,
    config.settings.worker,
    config.settings.tokenFile,
    config.settings.generation,
  );
  const slot = openSync(config.cpuSlot, "wx", 0o600);
  try {
    writeFileSync(slot, `${process.pid}\n`);
  } finally {
    closeSync(slot);
  }
  const stopped = new AbortController();
  const cancelled = new Error("proof-practice-operator-stop");
  const combined = AbortSignal.any([signal, stopped.signal]);
  let stop: ReturnType<typeof parsePracticeStop> | undefined;
  const watch = () => {
    if (combined.aborted) return;
    try {
      const now = Date.now();
      if (now >= proof.endsAtMs) {
        stopped.abort(Error("proof-practice-deadline"));
        return;
      }
      const pending = journal.get("practice-stop");
      if (pending !== undefined) {
        journal.advanceClock(now);
        stop = parsePracticeStop(config, settingsSha256, pending);
        stopped.abort(cancelled);
      }
    } catch (error) {
      stopped.abort(error);
    }
  };
  const timer = setInterval(watch, 200);
  try {
    watch();
    combined.throwIfAborted();
    while (true) {
      combined.throwIfAborted();
      journal.advanceClock(Date.now());
      if (existsSync(grant)) throw Error("proof-practice-app-grant-present");
      const control = await client.workerControl(combined);
      if (control?.paused !== false) throw Error("proof-practice-worker-paused");
      const queue = await snapshot(config, journal, false, combined);
      if (
        !proofSnapshotSchema(proof, queue.schema) ||
        queue.rows.length ||
        queue.events.length ||
        queue.accepted !== null
      )
        throw Error("proof-practice-queue-not-empty");
      await probe(config, combined);
      watch();
      combined.throwIfAborted();
      if (!journal.result("practice-ready")) {
        await post(config, journal, "practice-ready", {
          state: "READY",
          role,
          observedAtMs: Date.now(),
          idleRestartVerified: false,
          code: proof.code,
          fixtureSha256: proof.fixtureSha256,
        });
      }
      await delay(config.settings.pollMs, undefined, { signal: combined });
    }
  } catch (error) {
    const aborted =
      error === combined.reason ||
      (error instanceof Error && error.name === "AbortError" && error.cause === combined.reason) ||
      (error instanceof ProofCommandError && error.privateReceipt().reason === "abort");
    if (
      aborted &&
      combined.reason === cancelled &&
      stop &&
      !signal.aborted &&
      Date.now() < proof.endsAtMs
    ) {
      if (
        !journal.setTerminal({
          outcome: "STOPPED",
          reason: "operator-stop",
          stop,
          atMs: Date.now(),
        })
      )
        throw Error("proof-practice-terminal-already-recorded");
    } else {
      const atMs = Date.now();
      if (error instanceof ProofCommandError) {
        const failure = {
          source: "worker-command",
          code: error.message,
          ...error.privateReceipt(),
          atMs,
        };
        journal.recordPracticeFirstFailure(failure);
        journal.observe("practice-command-failure", failure, atMs);
      } else {
        const failure = {
          source: "worker-operation",
          reason: failureCode(error),
          ...(error instanceof Error
            ? { name: error.name, message: error.message.slice(0, 1024) }
            : {}),
          atMs,
        };
        journal.recordPracticeFirstFailure(failure);
        journal.observe("practice-operation-failure", failure, atMs);
      }
      const reason =
        aborted && signal.aborted
          ? "proof-practice-external-stop"
          : aborted && combined.reason === cancelled
            ? "proof-practice-deadline"
            : failureCode(error);
      hold(journal, reason);
      throw Error(reason);
    }
  } finally {
    clearInterval(timer);
    unlinkSync(config.cpuSlot);
  }
}

/** Each machine runs this locally. A pending claim on restart holds rather than launching the app twice. */
export async function runProofWorker(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
  settingsSha256?: string,
): Promise<void> {
  if (config.role !== "primary" && config.role !== "fallback") throw Error("invalid-proof-role");
  if (config.proof.practice) {
    if (!settingsSha256) throw Error("proof-practice-binding-required");
    return runPracticeWorker(config, journal, signal, settingsSha256);
  }
  const role = config.role;
  budget(config);
  if (role === "primary" && config.proof.faultMode && journal.get("worker-stop-exited")) {
    await verifyStoppedWorker(config, journal, signal);
    return;
  }
  const window = config.proof.attendedWindow;
  const prearmAt = window
    ? Math.max(window.notBeforeMs, config.proof.startsAtMs - ATTENDED_PREARM_LEAD_MS)
    : config.proof.startsAtMs - 180_000;
  if (Date.now() < prearmAt) throw Error("proof-prearm-too-early");
  if (journal.get("claimed")) throw Error("proof-attempt-already-started");
  const slot = openSync(config.cpuSlot, "wx", 0o600);
  writeFileSync(slot, `${process.pid}\n`);
  closeSync(slot);
  const stop = new AbortController();
  const combined = AbortSignal.any([signal, stop.signal]);
  const timer = setInterval(() => {
    if (Date.now() >= config.proof.endsAtMs) stop.abort();
  }, 1000);
  const client = fleetClient(
    config.settings.endpoint,
    config.settings.worker,
    config.settings.tokenFile,
    config.settings.generation,
  );
  const command = config.settings.kinds["bookcase-ledger-replay"]!;
  let preserveWakeForIdleRestart = false;
  let renewalsStopped = false;
  let inFlightRenewal: Promise<boolean> | undefined;
  let sleepFailure: string | undefined;
  let renewedAfterCompute = false,
    computed = false;
  let current: Claim | undefined;
  const wrapped: FleetClient = {
    ...client,
    claim: async () => {
      active(config.proof, journal);
      if ((await client.workerControl(combined)).paused) {
        if (config.proof.faultMode && !journal.get("claimed"))
          await workerStopReadiness(config, journal, combined);
        return null;
      }
      let seen: ProofSnapshot;
      try {
        seen = await snapshot(config, journal, false);
      } catch (error) {
        if (!config.proof.faultMode || !retryableEvidence(error)) throw error;
        recordProofStep(journal, "worker-snapshot", failureCode(error));
        return null;
      }
      if (config.proof.faultMode && seen.rows.length === 0)
        await workerStopReadiness(config, journal, combined);
      if (
        !config.proof.faultMode &&
        seen.rows.length === 0 &&
        Date.now() < config.proof.startsAtMs + READY_GRACE_MS
      ) {
        try {
          await publishReadiness(config, journal, combined);
        } catch (error) {
          if (!(error instanceof ProofReadinessHold)) throw error;
          journal.put("readiness-held", error.message);
        }
      }
      if (seen.rows.length < 2) return null;
      verifyAdmission(config.proof, seen);
      const row = seen.rows.find((r) => r.key === jobKey(ledgerSpec(config.proof)))!;
      if (role === "primary" && (row.status !== "ready" || row.attempts !== 0))
        throw Error("proof-primary-not-eligible");
      if (
        role === "fallback" &&
        (row.status !== "claimed" ||
          row.attempts !== 1 ||
          row.worker !== config.proof.primary ||
          row.leaseExpires === null ||
          seen.serverNowMs < row.leaseExpires)
      )
        return null;
      verifyProofCommand({
        program: command.command[0],
        args: command.command.slice(1),
        sha256: config.artifacts[command.command[0]]!,
        files: config.artifacts,
      });
      budget(config);
      try {
        await probe(config, combined);
      } catch (error) {
        if (
          !(config.proof.faultMode ? retryableEvidence(error) : error instanceof ProofReadinessHold)
        )
          throw error;
        if (config.proof.faultMode) recordProofStep(journal, "worker-claim", failureCode(error));
        journal.put("readiness-held", failureCode(error));
        return null;
      }
      active(config.proof, journal);
      if (existsSync(config.pauseFile) || existsSync(config.reservationFile))
        throw Error("proof-local-paused");
      const claim = await client.claim([config.proof.capability], ["bookcase-ledger-replay"]);
      if (claim) {
        verifyClaim(config.proof, claim, role, Date.now());
        current = claim;
        journal.put("claimed", claim);
        journal.observe("claimed", { key: claim.key, fence: claim.fence });
      }
      return claim;
    },
    heartbeat: async (claim) => {
      if (renewalsStopped) return false;
      active(config.proof, journal);
      const started = Date.now(),
        pending = client.heartbeat(claim);
      inFlightRenewal = pending;
      try {
        const accepted = await pending;
        if (accepted) {
          journal.put("last-renewal", { started, ended: Date.now() });
          if (computed) renewedAfterCompute = true;
        }
        return accepted;
      } finally {
        inFlightRenewal = undefined;
      }
    },
    // Only this scripted fault gives up local lease authority while leaving the server lease to expire.
    fail: (...args) => (renewalsStopped ? Promise.resolve(false) : client.fail(...args)),
    release: (...args) => (renewalsStopped ? Promise.resolve(false) : client.release(...args)),
  };
  try {
    journal.put("worker-starts", Number(journal.get("worker-starts") ?? 0) + 1);
    while (Date.now() < config.proof.startsAtMs && !combined.aborted) {
      journal.advanceClock(Date.now());
      if (config.proof.faultMode) {
        await workerStopReadiness(config, journal, combined);
      } else if (Date.now() >= config.proof.startsAtMs - READY_REPORT_LEAD_MS) {
        try {
          await publishReadiness(config, journal, combined);
        } catch (error) {
          journal.put("readiness-held", failureCode(error));
        }
      }
      await delay(1000, undefined, { signal: combined }).catch(() => {});
    }
    if (combined.aborted && !journal.get("claimed")) {
      preserveWakeForIdleRestart =
        role === "primary" &&
        journal.get("worker-starts") === 1 &&
        Date.now() < config.proof.startsAtMs;
      journal.put("idle-stopped", true);
      return;
    }
    while (!combined.aborted) {
      active(config.proof, journal);
      const result = await workOnce(wrapped, {
        caps: [config.proof.capability],
        outDir: config.settings.outDir,
        signal: combined,
        heartbeatMs: 5000,
        handlers: {
          "bookcase-ledger-replay": async (claim, context): Promise<JobOutput> => {
            verifyClaim(config.proof, claim, role, Date.now());
            const output = await commandHandler(command)(claim, context);
            computed = true;
            journal.put("computed", output);
            journal.observe("computed", {
              key: claim.key,
              fence: claim.fence,
              sha256: output.sha256,
            });
            budget(config);
            if (role === "primary") {
              while (!renewedAfterCompute && !context.signal.aborted)
                await delay(20, undefined, { signal: context.signal });
              if (context.signal.aborted) throw new JobError("proof-lease-lost", false);
              active(config.proof, journal);
              await probe(config, context.signal);
              renewalsStopped = true;
              if ((inFlightRenewal && !(await inFlightRenewal)) || context.signal.aborted)
                throw new JobError("proof-lease-lost", false);
              active(config.proof, journal);
              if (config.proof.faultMode) {
                journal.put("worker-stop", { atMs: Date.now(), fence: claim.fence });
                recordProofStep(journal, "primary-renewals-stopped");
                stop.abort();
                throw new JobError("proof-lease-lost", false);
              }
              const input = {
                proofId: config.proof.proofId,
                claim,
                renewal: journal.get("last-renewal"),
                deadlineMs: config.proof.endsAtMs,
              };
              if (journal.reserve("sleep", input) !== "new")
                throw new JobError("proof-sleep-already-started", false);
              try {
                const fault = await runProofCommand(
                  config.commands.fault,
                  input,
                  combined,
                  9 * 60_000,
                );
                journal.finish("sleep", fault);
              } catch (error) {
                sleepFailure = failureCode(error);
                throw error;
              }
              // The real sleep must lose the lease. Never race canonical fallback completion on wake.
              while (!context.signal.aborted)
                await delay(20, undefined, { signal: context.signal });
              throw new JobError("proof-lease-lost", false);
            }
            return output;
          },
        },
      });
      journal.observe("worker-result", { result });
      if (
        config.proof.faultMode &&
        role === "primary" &&
        result === "lease-lost" &&
        journal.get("worker-stop")
      )
        return;
      if (sleepFailure) throw Error(sleepFailure);
      if (result === "idle") {
        await delay(5000, undefined, { signal: combined });
        continue;
      }
      if (role === "primary" && result === "lease-lost" && current && journal.result("sleep")) {
        let accepted = await snapshot(config, journal);
        const completionDeadline = Math.min(config.proof.endsAtMs, Date.now() + 120_000);
        while (accepted.rows.find((r) => r.key === current!.key)?.status !== "done") {
          active(config.proof, journal);
          const row = accepted.rows.find((r) => r.key === current!.key)!;
          if (
            Date.now() >= completionDeadline ||
            row.status !== "claimed" ||
            row.worker !== config.proof.fallback ||
            row.fence !== 2
          )
            throw Error("proof-fallback-not-accepted");
          await delay(5000, undefined, { signal: combined });
          accepted = await snapshot(config, journal);
        }
        verifyAccepted(config.proof, accepted);
        const output = object(journal.get("computed"));
        const bytes = readFileSync(join(config.settings.outDir, string(output.file)));
        const input = { key: current.key, fence: current.fence, sha256: string(output.sha256) };
        if (journal.reserve("stale-complete", input) !== "new")
          throw Error("proof-stale-check-already-started");
        active(config.proof, journal);
        const stale = await client.complete(current, bytes, input.sha256);
        if (stale !== false) throw Error("proof-stale-accepted");
        const unchanged = await snapshot(config, journal);
        verifyAccepted(config.proof, unchanged);
        if (canonicalJson(accepted.rows) !== canonicalJson(unchanged.rows))
          throw Error("proof-canonical-output-changed");
        journal.finish("stale-complete", { rejected: true });
        const fault = object(journal.result("sleep"));
        const facts = {
          proofId: config.proof.proofId,
          staleRejected: true,
          osSleepObserved: fault.osSleepObserved,
          osWakeObserved: fault.osWakeObserved,
          scheduledWakeMatched: fault.scheduledWakeMatched,
          wakeEntryRemoved: fault.wakeEntryRemoved,
          powerPolicyUnchanged: fault.powerPolicyUnchanged,
          protectedServicesUnchanged: fault.protectedServicesUnchanged,
          sleepAtMs: fault.sleepAtMs,
          wakeAtMs: fault.wakeAtMs,
          lastRenewalAtMs: object(journal.get("last-renewal")).started,
        };
        validateFault(config.proof, facts);
        await post(config, journal, "primary-complete", {
          state: "stale-rejected",
          key: current.key,
          fence: current.fence,
          facts,
        });
      } else if (!(role === "fallback" && result === "completed")) throw Error("proof-worker-held");
      journal.put("terminal", { outcome: "COMPLETE", atMs: Date.now() });
      return;
    }
  } catch (error) {
    if (config.proof.faultMode) recordProofStep(journal, "worker-held", failureCode(error));
    hold(journal, failureCode(error));
    try {
      await post(config, journal, "worker-held", {
        state: "HELD",
        role,
        reason: failureCode(error),
        owner: "local-proof-profile",
        nextAction: "retain-evidence-and-stop",
      });
    } catch {
      /* The retained local terminal state is authoritative during an outage. */
    }
    throw Error(failureCode(error));
  } finally {
    clearInterval(timer);
    stop.abort();
    const wakeFlag = join(config.evidenceDir, "wake-active");
    if (role === "primary" && !preserveWakeForIdleRestart && existsSync(wakeFlag))
      unlinkSync(wakeFlag);
    unlinkSync(config.cpuSlot);
  }
}

async function control(
  config: ProofRuntime,
  journal: ProofJournal,
  client: FleetClient,
  name: string,
  worker: string,
  action: "pause" | "resume",
): Promise<void> {
  const input = { worker, action };
  if (journal.reserve(name, input) === "done") return;
  // A repeated pause/resume converges on exactly the same state after an acknowledgement loss.
  if (action === "resume") active(config.proof, journal);
  const receipt = await client.control(worker, action);
  if (receipt.paused !== (action === "pause")) throw Error("proof-control-mismatch");
  journal.finish(name, { paused: receipt.paused });
}
async function admit(
  config: ProofRuntime,
  journal: ProofJournal,
  client: FleetClient,
  sentinel: boolean,
): Promise<void> {
  const spec = ledgerSpec(config.proof, sentinel),
    key = jobKey(spec),
    name = sentinel ? "admit-sentinel" : "admit-job";
  const state = journal.reserve(name, spec);
  if (state === "done") return;
  if (state === "pending") {
    if (sentinel) throw Error("proof-sentinel-admission-unknown");
    // ONE identical admission retry is allowed; a second unknown response is held, never reset.
    if (journal.reserve(`${name}-retry`, spec) !== "new") throw Error("proof-admission-unknown");
  }
  active(config.proof, journal);
  const admitted = await client.enqueue(spec);
  if (admitted.key !== key || (state === "new" && !admitted.created))
    throw Error("proof-admission-mismatch");
  journal.finish(name, { key });
}
async function peerEvidence(
  config: ProofRuntime,
  phase: "ready" | "fault",
): Promise<Record<string, unknown>> {
  const row = object(
    await runProofCommand(config.commands.faultEvidence, { proofId: config.proof.proofId, phase }),
  );
  if (
    row.proofId !== config.proof.proofId ||
    row.authenticatedReadback !== true ||
    row.lineageVerified !== true
  )
    throw Error("proof-peer-evidence-unverified");
  return row;
}
function validateFault(proof: LedgerProof, value: Record<string, unknown>): void {
  if (proof.faultMode === "worker-stop") {
    if (
      value.proofId !== proof.proofId ||
      value.staleRejected !== true ||
      value.workerStopped !== true ||
      value.faultMode !== proof.faultMode
    )
      throw Error("proof-worker-stop-evidence-mismatch");
    return;
  }
  if (
    value.proofId !== proof.proofId ||
    value.staleRejected !== true ||
    value.osSleepObserved !== true ||
    value.osWakeObserved !== true ||
    value.scheduledWakeMatched !== true ||
    value.wakeEntryRemoved !== true ||
    value.powerPolicyUnchanged !== true ||
    value.protectedServicesUnchanged !== true ||
    integer(value.sleepAtMs) >= integer(value.wakeAtMs) ||
    integer(value.sleepAtMs) < proof.startsAtMs ||
    integer(value.wakeAtMs) >= proof.endsAtMs ||
    integer(value.wakeAtMs) - integer(value.sleepAtMs) < 310_000 ||
    integer(value.lastRenewalAtMs) > integer(value.sleepAtMs) ||
    integer(value.sleepAtMs) - integer(value.lastRenewalAtMs) > 10_000
  )
    throw Error("proof-fault-evidence-mismatch");
}

/** The launcher starts this after reaping the claim-capable child. This child never claims. */
async function verifyStoppedWorker(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  try {
    const client = fleetClient(
      config.settings.endpoint,
      config.settings.worker,
      config.settings.tokenFile,
      config.settings.generation,
    );
    const claim = journal.get("claimed") as Claim;
    const stopped = object(journal.get("worker-stop"));
    const exitedAtMs = integer(journal.get("worker-stop-exited"));
    if (
      !claim ||
      stopped.fence !== 1 ||
      claim.fence !== 1 ||
      claim.key !== jobKey(ledgerSpec(config.proof)) ||
      integer(stopped.atMs) > exitedAtMs ||
      exitedAtMs >= config.proof.endsAtMs
    )
      throw Error("proof-worker-stop-unverified");
    const output = object(journal.get("computed"));
    const sha256 = string(output.sha256, /^[a-f0-9]{64}$/);
    const file = `${claim.key}.1.jsonl`;
    if (output.file !== file) throw Error("proof-stale-output-mismatch");
    const bytes = readFileSync(join(config.settings.outDir, file));
    if (proofHash(bytes) !== sha256) throw Error("proof-stale-output-mismatch");
    recordProofStep(journal, "waiting-for-fallback-result");
    for (;;) {
      if (signal.aborted) throw Error("proof-verifier-aborted");
      active(config.proof, journal);
      let seen: ProofSnapshot;
      try {
        seen = await snapshot(config, journal);
      } catch (error) {
        if (!retryableEvidence(error)) throw error;
        recordProofStep(journal, "verifier-snapshot", failureCode(error));
        await delay(5000, undefined, { signal });
        continue;
      }
      const row = seen.rows.find((item) => item.key === claim.key);
      if (row?.status === "failed") throw Error("proof-fallback-failed");
      if (row?.status !== "done") {
        await delay(5000, undefined, { signal });
        continue;
      }
      verifyAccepted(config.proof, seen);
      const input = { key: claim.key, fence: claim.fence, sha256 };
      const effect = journal.reserve("stale-complete", input);
      if (effect === "new") {
        active(config.proof, journal);
        try {
          if ((await client.complete(claim, bytes, sha256)) !== false)
            throw Error("proof-stale-accepted");
        } catch (error) {
          if (failureCode(error) === "proof-stale-accepted") throw error;
          recordProofStep(journal, "stale-complete", "proof-stale-ack-unavailable");
        }
        continue; // The durable server event, not the HTTP response alone, decides this assertion.
      }
      const rejected = seen.events.some(
        (event) =>
          event.key === claim.key &&
          event.type === "rejected-stale" &&
          event.fence === claim.fence &&
          event.worker === config.proof.primary,
      );
      if (!rejected) {
        recordProofStep(journal, "stale-complete", "proof-stale-rejection-not-observed");
        await delay(5000, undefined, { signal });
        continue;
      }
      journal.finish("stale-complete", { rejected: true });
      recordProofStep(journal, "stale-rejected");
      const facts = {
        proofId: config.proof.proofId,
        faultMode: config.proof.faultMode,
        staleRejected: true,
        workerStopped: true,
      };
      try {
        await post(config, journal, "primary-complete", {
          state: "stale-rejected",
          key: claim.key,
          fence: claim.fence,
          facts,
        });
      } catch (error) {
        if (!retryableEvidence(error)) throw error;
        recordProofStep(journal, "verifier-report", failureCode(error));
        await delay(5000, undefined, { signal });
        continue;
      }
      journal.put("terminal", { outcome: "COMPLETE", atMs: Date.now() });
      return;
    }
  } catch (error) {
    recordProofStep(journal, "verifier-held", failureCode(error));
    hold(journal, failureCode(error));
    throw error;
  }
}

/** The always-on local host owns admission and verification; no chat or remote-Mac command is needed. */
export async function runProofSupervisor(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  if (config.role !== "supervisor") throw Error("invalid-proof-role");
  const workerStop = config.proof.faultMode === "worker-stop";
  const client = fleetClient(
    config.settings.endpoint,
    config.settings.worker,
    config.settings.tokenFile,
    config.settings.generation,
  );
  try {
    for (;;) {
      budget(config);
      journal.advanceClock(Date.now());
      journal.put("supervisor-seen", Date.now());
      if (signal.aborted) throw Error("proof-supervisor-aborted");
      if (Date.now() >= config.proof.endsAtMs) throw Error("proof-deadline");
      if (journal.get("terminal")) return;
      const watchdog = journal.get("watchdog-seen");
      if (typeof watchdog !== "number" || Date.now() - watchdog > 15_000)
        throw Error("proof-watchdog-unavailable");
      if (Date.now() < config.proof.startsAtMs) {
        await delay(1000, undefined, { signal });
        continue;
      }
      active(config.proof, journal);
      if (!journal.result("admit-job")) {
        const readyBy = workerStop
          ? config.proof.endsAtMs - WORKER_STOP_REMAINING_MS
          : config.proof.startsAtMs + READY_GRACE_MS;
        if (Date.now() >= readyBy)
          throw Error(workerStop ? "proof-insufficient-time-to-start" : "proof-readiness-deadline");
        try {
          await probe(config, signal);
          const peers = await peerEvidence(config, "ready");
          if (
            peers.primaryReady !== true ||
            peers.fallbackReady !== true ||
            (!workerStop && peers.primaryIdleRestartVerified !== true) ||
            Math.abs(Date.now() - integer(peers.observedAtMs)) >
              (workerStop ? WORKER_STOP_READY_FRESH_MS : 15_000)
          )
            throw new ProofReadinessHold("proof-peer-readiness-held");
        } catch (error) {
          if (!(workerStop ? retryableEvidence(error) : error instanceof ProofReadinessHold))
            throw error;
          if (workerStop) recordProofStep(journal, "peer-readiness", failureCode(error));
          journal.put("readiness-held", failureCode(error));
          await delay(workerStop ? 5000 : 1000, undefined, { signal });
          continue;
        }
        let empty: ProofSnapshot;
        try {
          empty = await snapshot(config, journal, false);
        } catch (error) {
          if (!workerStop || !retryableEvidence(error)) throw error;
          recordProofStep(journal, "empty-queue", failureCode(error));
          await delay(5000, undefined, { signal });
          continue;
        }
        if (Date.now() >= readyBy)
          throw Error(workerStop ? "proof-insufficient-time-to-start" : "proof-readiness-deadline");
        const pending = journal.reserve("empty-queue", { proofId: config.proof.proofId });
        if (pending !== "done") {
          if (
            !proofSnapshotSchema(config.proof, empty.schema) ||
            empty.rows.length !== 0 ||
            empty.events.length !== 0
          )
            throw Error("proof-queue-not-empty");
          if (workerStop) journal.put("snapshot-schema", empty.schema);
          journal.finish("empty-queue", { empty: true });
        }
        if (workerStop) recordProofStep(journal, "ready-to-admit");
        await control(config, journal, client, "pause-primary", config.proof.primary, "pause");
        await control(config, journal, client, "pause-fallback", config.proof.fallback, "pause");
        if (workerStop && Date.now() >= readyBy) throw Error("proof-insufficient-time-to-start");
        await admit(config, journal, client, false);
      }
      await admit(config, journal, client, true);
      let seen: ProofSnapshot;
      try {
        seen = await snapshot(config, journal);
      } catch (error) {
        if (!workerStop || !retryableEvidence(error)) throw error;
        recordProofStep(journal, "running-snapshot", failureCode(error));
        await delay(5000, undefined, { signal });
        continue;
      }
      if (workerStop && seen.schema !== journal.get("snapshot-schema"))
        throw Error("proof-schema-changed");
      verifyAdmission(config.proof, seen);
      if (!journal.result("full-admission-verified")) {
        if (seen.rows.some((r) => r.attempts !== 0 || r.status !== "ready"))
          throw Error("proof-early-claim");
        journal.reserve("full-admission-verified", {
          specs: seen.rows.map((r) => ({ key: r.key, spec: r.spec })),
        });
        journal.finish("full-admission-verified", { verified: true });
      }
      if (workerStop && journal.get("pickup-clock") === undefined)
        journal.put("pickup-clock", seen.serverNowMs);
      await control(config, journal, client, "enable-primary", config.proof.primary, "resume");
      const row = seen.rows.find((r) => r.key === jobKey(ledgerSpec(config.proof)))!;
      const sentinel = seen.rows.find((r) => r.key === jobKey(ledgerSpec(config.proof, true)))!;
      const pickupStart = workerStop
        ? integer(journal.get("pickup-clock"))
        : config.proof.startsAtMs;
      if (workerStop && row.attempts === 0) recordProofStep(journal, "waiting-for-primary-claim");
      if (row.attempts === 0 && seen.serverNowMs > pickupStart + (workerStop ? 60_000 : 30_000))
        throw Error("proof-primary-pickup-held");
      const fallbackClaimed = seen.events.find(
        (e) => e.key === row.key && e.type === "claimed" && e.worker === config.proof.fallback,
      );
      if (
        row.status === "claimed" &&
        fallbackClaimed &&
        seen.serverNowMs > fallbackClaimed.ts + 150_000
      )
        throw Error("proof-fallback-compute-held");
      if (
        sentinel.status !== "ready" ||
        sentinel.attempts !== 0 ||
        row.attempts > 2 ||
        row.status === "failed"
      )
        throw Error("proof-unexpected-attempt");
      if (!journal.get("sentinel-held")) {
        if (!workerStop && Date.now() > config.proof.startsAtMs + 100_000)
          throw Error("proof-sentinel-hold-bound-missed");
        journal.put("sentinel-held", {
          reason: "no-eligible-worker",
          owner: "proof-supervisor",
          nextAction: "retain-unclaimed-until-cleanup",
          atMs: Date.now(),
          observedServerMs: seen.serverNowMs,
        });
      }
      if (!workerStop) {
        await post(config, journal, "sentinel-alert", {
          state: "HELD",
          kind: "unclaimable-sentinel",
          reason: "no-eligible-worker",
          nextAction: "retain-unclaimed-until-cleanup",
        });
        if (!journal.get("sentinel-bound-verified")) {
          if (Date.now() > config.proof.startsAtMs + 120_000)
            throw Error("proof-sentinel-alert-bound-missed");
          journal.put("sentinel-bound-verified", true);
        }
      }
      if (row.status === "claimed" && row.worker === config.proof.primary) {
        if (row.attempts !== 1 || row.fence !== 1 || row.leaseExpires === null)
          throw Error("proof-primary-mismatch");
        journal.put("last-primary-lease", {
          expiresAtMs: row.leaseExpires,
          observedServerMs: seen.serverNowMs,
          uncertainty: journal.get("snapshot-time"),
        });
        if (workerStop)
          recordProofStep(
            journal,
            seen.serverNowMs < row.leaseExpires
              ? "waiting-for-primary-lease-expiry"
              : "lease-expired",
          );
        if (seen.serverNowMs >= row.leaseExpires)
          await control(
            config,
            journal,
            client,
            "enable-fallback",
            config.proof.fallback,
            "resume",
          );
      }
      if (workerStop && row.status === "claimed" && fallbackClaimed)
        recordProofStep(journal, "fallback-claimed");
      if (row.status === "done") {
        verifyAccepted(config.proof, seen);
        const last = object(journal.get("last-primary-lease"));
        const fallbackClaim = seen.events.find(
          (e) => e.key === row.key && e.type === "claimed" && e.worker === config.proof.fallback,
        )!;
        const expiryEvent = seen.events.find(
          (e) =>
            e.key === row.key &&
            e.type === "lease-expired" &&
            e.worker === config.proof.primary &&
            e.fence === 1,
        );
        if (!expiryEvent || !fallbackClaim) throw Error("proof-lease-expiry-evidence-missing");
        const expiresAtMs = integer(expiryEvent.leaseExpiredAtMs);
        const deltaMs = fallbackClaim.ts - expiresAtMs + 300_000;
        if (deltaMs < 300_000 || (!workerStop && deltaMs > 310_000))
          throw Error("proof-reclaim-bound-missed");
        const accepted = {
          key: row.key,
          fence: row.fence,
          sha256: row.output,
          deltaMs,
          uncertainty: last.uncertainty,
        };
        if (!journal.result("accepted")) {
          if (workerStop) recordProofStep(journal, "fallback-output-accepted");
          journal.reserve("accepted", accepted);
          journal.finish("accepted", accepted);
          if (!workerStop) {
            journal.put("restart-required", true);
            return; // The local one-shot launcher restarts the supervisor at this checkpoint.
          }
        }
        if (journal.get("restart-required") === true) {
          journal.put("restart-required", false);
          journal.put("restart-observed", Date.now());
        }
        let fault: Record<string, unknown>;
        try {
          fault = await peerEvidence(config, "fault");
        } catch (error) {
          if (!workerStop || !retryableEvidence(error)) throw error;
          recordProofStep(journal, "worker-stop-evidence", failureCode(error));
          await delay(5000, undefined, { signal });
          continue;
        }
        if (fault.pending === true) {
          if (workerStop)
            recordProofStep(journal, "worker-stop-evidence", "proof-evidence-pending");
          await delay(5000, undefined, { signal });
          continue;
        }
        validateFault(config.proof, fault);
        const after = await snapshot(config, journal);
        verifyAccepted(config.proof, after);
        const staleEvents = after.events.filter(
          (e) => e.key === row.key && e.type === "rejected-stale",
        );
        const completedEvent = after.events.find(
          (e) => e.key === row.key && e.type === "completed",
        );
        if (
          staleEvents.length !== 1 ||
          staleEvents[0]!.fence !== 1 ||
          staleEvents[0]!.worker !== config.proof.primary ||
          !completedEvent ||
          staleEvents[0]!.seq <= completedEvent.seq ||
          staleEvents[0]!.ts < completedEvent.ts
        )
          throw Error("proof-stale-rejection-mismatch");
        active(config.proof, journal);
        const signedEvents = await client.events(0);
        if (
          canonicalJson(signedEvents) !==
          canonicalJson(after.events.map(({ leaseExpiredAtMs: _expiry, ...event }) => event))
        )
          throw Error("proof-signed-events-mismatch");
        if (
          !journal.get("sentinel-held") ||
          (!workerStop &&
            (!journal.result("sentinel-alert") ||
              !journal.get("sentinel-bound-verified") ||
              !journal.get("restart-observed")))
        )
          throw Error("proof-acceptance-incomplete");
        active(config.proof, journal);
        if (workerStop) recordProofStep(journal, "handoff-verified");
        if (!journal.setTerminal({ outcome: "VERIFIED", atMs: Date.now(), accepted, fault }))
          throw Error("proof-terminal-already-held");
        return;
      }
      await delay(5000, undefined, { signal });
    }
  } catch (error) {
    hold(journal, failureCode(error));
    throw Error(failureCode(error));
  }
}

/** Separate launchd-owned process. Stop-only remains valid after expiry; it can never enqueue or resume. */
export async function runProofWatchdog(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  if (config.role !== "watchdog") throw Error("invalid-proof-role");
  for (;;) {
    journal.put("watchdog-seen", Date.now());
    const last = journal.get("supervisor-seen");
    const stale =
      Date.now() >= config.proof.startsAtMs + 30_000 &&
      (typeof last !== "number" || Date.now() - last > 30_000);
    if (signal.aborted || Date.now() >= config.proof.endsAtMs || stale || journal.get("terminal")) {
      if (!journal.get("terminal"))
        hold(journal, stale ? "proof-supervisor-unavailable" : "proof-deadline");
      const input = { proofId: config.proof.proofId, endsAtMs: config.proof.endsAtMs };
      let cleanupVerified = false;
      try {
        const reserved = journal.reserve("stop-isolated-targets", input);
        const stopped = object(
          reserved === "done"
            ? journal.result("stop-isolated-targets")
            : await runProofCommand(config.commands.stop, input),
        );
        if (
          stopped.proofId !== config.proof.proofId ||
          stopped.containerStopped !== true ||
          stopped.localProfileStopped !== true ||
          stopped.capabilitiesRemoved !== true ||
          stopped.baselineUnchanged !== true ||
          stopped.scheduleRemoved !== true
        )
          throw Error("proof-cleanup-unverified");
        if (reserved !== "done") journal.finish("stop-isolated-targets", stopped);
        cleanupVerified = true;
      } catch {
        journal.put("cleanup-held", { reason: "proof-cleanup-unverified", atMs: Date.now() });
      }
      const terminal = object(journal.get("terminal"));
      const outcome =
        terminal.outcome === "VERIFIED" && cleanupVerified && Date.now() < config.proof.endsAtMs
          ? "PASS"
          : "HELD";
      const report = {
        proofId: config.proof.proofId,
        state: outcome,
        code: config.proof.code,
        runnerCode: releaseInfo.commit,
        runnerVersion: releaseInfo.version,
        fixtureSha256: config.proof.fixtureSha256,
        key: jobKey(ledgerSpec(config.proof)),
        resultSha256: object(journal.result("accepted") ?? {}).sha256 ?? null,
        reason: !cleanupVerified
          ? "proof-cleanup-unverified"
          : outcome === "HELD"
            ? (terminal.reason ?? "proof-deadline")
            : null,
        owner: "proof-supervisor",
        nextAction: cleanupVerified ? "consume-retained-report" : "local-operator-cleanup-required",
        runtimeModelCalls: 0,
        ...(config.proof.faultMode
          ? {
              facts: {
                faultMode: config.proof.faultMode,
                progress: journal.get("progress") ?? null,
                jobAdmitted: !!journal.result("admit-job"),
                resultAccepted: !!journal.result("accepted"),
                handoffVerified: terminal.outcome === "VERIFIED",
                cleanupVerified,
                terminalReason: terminal.reason ?? null,
              },
            }
          : {}),
      };
      const frozen = journal.freezeTerminalReport(report);
      if (cleanupVerified) {
        if (!journal.get("cleanup-complete")) journal.put("cleanup-complete", Date.now());
      }
      await post(config, journal, "terminal-report", frozen.body, frozen.commandId);
      if (cleanupVerified) {
        if (frozen.body.state === "HELD" && frozen.body.reason === "proof-cleanup-unverified") {
          await post(config, journal, "cleanup-status", {
            proofId: config.proof.proofId,
            state: "cleanup-complete",
            terminalCommandId: frozen.commandId,
            cleanupVerified: true,
            owner: "proof-supervisor",
            nextAction: "consume-retained-report",
          });
        }
      }
      return;
    }
    await delay(1000, undefined, { signal }).catch(() => {});
  }
}
