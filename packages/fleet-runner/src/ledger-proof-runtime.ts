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
import { workOnce } from "./worker.js";
import { parseWorkerSettings, type WorkerSettings } from "./worker-settings.js";
import { ProofJournal } from "./ledger-proof-state.js";
import {
  parseProofCommand,
  verifyProofCommand,
  runProofCommand,
  type ProofCommand,
} from "./ledger-proof-command.js";
import {
  directoryBytes,
  exact,
  integer,
  ledgerSpec,
  nightEligible,
  object,
  parseLedgerProof,
  privatePath,
  proofHash,
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
async function probe(config: ProofRuntime, signal?: AbortSignal): Promise<void> {
  if (existsSync(config.pauseFile) || existsSync(config.reservationFile))
    throw Error("proof-local-paused");
  const row = exact(
    await runProofCommand(
      config.commands.probe,
      { proofId: config.proof.proofId, role: config.role },
      signal,
    ),
    [
      "proofId",
      "observedAtMs",
      "loggedIn",
      "appsClosed",
      "screenLocked",
      "protectedIdle",
      "ac",
      "wakeReady",
    ],
  );
  if (
    row.proofId !== config.proof.proofId ||
    Math.abs(Date.now() - integer(row.observedAtMs)) > 10_000 ||
    row.loggedIn !== true ||
    row.appsClosed !== true ||
    row.screenLocked !== true ||
    row.protectedIdle !== true ||
    (config.role === "primary" &&
      (row.ac !== true ||
        row.wakeReady !== true ||
        !nightEligible(Date.now(), config.proof.timeZone)))
  )
    throw Error("proof-readiness-held");
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
): Promise<ProofSnapshot> {
  const started = Date.now();
  const value = parseProofSnapshot(
    await runProofCommand(config.commands.snapshot, { proofId: config.proof.proofId }),
  );
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
): Promise<void> {
  const commandIdName = `${name}-command-id`;
  if (!journal.get(commandIdName)) journal.put(commandIdName, randomUUID());
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

/** Each machine runs this locally. A pending claim on restart holds rather than launching the app twice. */
export async function runProofWorker(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  if (config.role !== "primary" && config.role !== "fallback") throw Error("invalid-proof-role");
  const role = config.role;
  budget(config);
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
  let renewedAfterCompute = false,
    computed = false;
  let current: Claim | undefined;
  const wrapped: FleetClient = {
    ...client,
    claim: async () => {
      active(config.proof, journal);
      verifyProofCommand({
        program: command.command[0],
        args: command.command.slice(1),
        sha256: config.artifacts[command.command[0]]!,
        files: config.artifacts,
      });
      budget(config);
      await probe(config, combined);
      const seen = await snapshot(config, journal);
      const row = seen.rows.find((r) => r.key === jobKey(ledgerSpec(config.proof)))!;
      if ((await client.workerControl(combined)).paused) return null;
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
      active(config.proof, journal);
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
      active(config.proof, journal);
      const started = Date.now(),
        accepted = await client.heartbeat(claim);
      if (accepted) {
        journal.put("last-renewal", { started, ended: Date.now() });
        if (computed) renewedAfterCompute = true;
      }
      return accepted;
    },
  };
  try {
    journal.put("worker-starts", Number(journal.get("worker-starts") ?? 0) + 1);
    while (Date.now() < config.proof.startsAtMs && !combined.aborted) {
      journal.advanceClock(Date.now());
      try {
        await probe(config, combined);
        await post(
          config,
          journal,
          `ready-${String(journal.get("worker-starts"))}-${Math.floor(Date.now() / 5000)}`,
          {
            state: "READY",
            role,
            observedAtMs: Math.floor(Date.now() / 5000) * 5000,
            idleRestartVerified: journal.get("idle-stopped") === true,
            code: config.proof.code,
            fixtureSha256: config.proof.fixtureSha256,
          },
        );
      } catch (error) {
        journal.put("readiness-held", failureCode(error));
      }
      await delay(1000, undefined, { signal: combined }).catch(() => {});
    }
    if (combined.aborted && !journal.get("claimed")) {
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
              const input = {
                proofId: config.proof.proofId,
                claim,
                renewal: journal.get("last-renewal"),
                deadlineMs: config.proof.endsAtMs,
              };
              if (journal.reserve("sleep", input) !== "new")
                throw new JobError("proof-sleep-already-started", false);
              const fault = await runProofCommand(
                config.commands.fault,
                input,
                combined,
                9 * 60_000,
              );
              journal.finish("sleep", fault);
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
      if (result === "idle") {
        await delay(5000, undefined, { signal: combined });
        continue;
      }
      if (role === "primary" && result === "lease-lost" && current && journal.result("sleep")) {
        const accepted = await snapshot(config, journal);
        verifyAccepted(config.proof, accepted);
        const output = object(journal.get("computed"));
        const bytes = readFileSync(join(config.settings.outDir, string(output.file)));
        const input = { key: current.key, fence: current.fence, sha256: string(output.sha256) };
        if (journal.reserve("stale-complete", input) !== "new")
          throw Error("proof-stale-check-already-started");
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
    unlinkSync(config.cpuSlot);
  }
}

async function control(
  journal: ProofJournal,
  client: FleetClient,
  name: string,
  worker: string,
  action: "pause" | "resume",
): Promise<void> {
  const input = { worker, action };
  if (journal.reserve(name, input) === "done") return;
  // A repeated pause/resume converges on exactly the same state after an acknowledgement loss.
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
  if (
    value.proofId !== proof.proofId ||
    value.staleRejected !== true ||
    value.osSleepObserved !== true ||
    value.osWakeObserved !== true ||
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

/** The always-on local host owns admission and verification; no chat or remote-Mac command is needed. */
export async function runProofSupervisor(
  config: ProofRuntime,
  journal: ProofJournal,
  signal: AbortSignal,
): Promise<void> {
  if (config.role !== "supervisor") throw Error("invalid-proof-role");
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
      if (signal.aborted || Date.now() >= config.proof.endsAtMs) throw Error("proof-deadline");
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
        await probe(config, signal);
        const peers = await peerEvidence(config, "ready");
        if (
          peers.primaryReady !== true ||
          peers.fallbackReady !== true ||
          peers.primaryIdleRestartVerified !== true ||
          Math.abs(Date.now() - integer(peers.observedAtMs)) > 15_000
        )
          throw Error("proof-peer-readiness-held");
        const empty = await snapshot(config, journal, false);
        const pending = journal.reserve("empty-queue", { proofId: config.proof.proofId });
        if (pending !== "done") {
          if (empty.schema !== 4 || empty.rows.length !== 0 || empty.events.length !== 0)
            throw Error("proof-queue-not-empty");
          journal.finish("empty-queue", { empty: true });
        }
        await control(journal, client, "pause-primary", config.proof.primary, "pause");
        await control(journal, client, "pause-fallback", config.proof.fallback, "pause");
        await admit(config, journal, client, false);
      }
      await admit(config, journal, client, true);
      const seen = await snapshot(config, journal);
      verifyAdmission(config.proof, seen);
      if (!journal.result("full-admission-verified")) {
        if (seen.rows.some((r) => r.attempts !== 0 || r.status !== "ready"))
          throw Error("proof-early-claim");
        journal.reserve("full-admission-verified", {
          specs: seen.rows.map((r) => ({ key: r.key, spec: r.spec })),
        });
        journal.finish("full-admission-verified", { verified: true });
      }
      await control(journal, client, "enable-primary", config.proof.primary, "resume");
      const row = seen.rows.find((r) => r.key === jobKey(ledgerSpec(config.proof)))!;
      const sentinel = seen.rows.find((r) => r.key === jobKey(ledgerSpec(config.proof, true)))!;
      if (row.attempts === 0 && seen.serverNowMs > config.proof.startsAtMs + 30_000)
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
      if (seen.serverNowMs >= config.proof.startsAtMs + 120_000) {
        if (!journal.get("sentinel-held"))
          journal.put("sentinel-held", {
            reason: "no-eligible-worker",
            owner: "proof-supervisor",
            nextAction: "retain-unclaimed-until-cleanup",
            atMs: Date.now(),
          });
        await post(config, journal, "sentinel-alert", {
          state: "HELD",
          kind: "unclaimable-sentinel",
          reason: "no-eligible-worker",
          nextAction: "retain-unclaimed-until-cleanup",
        });
      }
      if (row.status === "claimed" && row.worker === config.proof.primary) {
        if (row.attempts !== 1 || row.fence !== 1 || row.leaseExpires === null)
          throw Error("proof-primary-mismatch");
        journal.put("last-primary-lease", {
          expiresAtMs: row.leaseExpires,
          observedServerMs: seen.serverNowMs,
          uncertainty: journal.get("snapshot-time"),
        });
        if (seen.serverNowMs >= row.leaseExpires)
          await control(journal, client, "enable-fallback", config.proof.fallback, "resume");
      }
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
        if (!expiryEvent) throw Error("proof-lease-expiry-evidence-missing");
        const deltaMs = fallbackClaim.ts - (integer(expiryEvent.leaseExpiredAtMs) - 300_000);
        if (deltaMs < 300_000 || deltaMs > 310_000) throw Error("proof-reclaim-bound-missed");
        const accepted = {
          key: row.key,
          fence: row.fence,
          sha256: row.output,
          deltaMs,
          uncertainty: last.uncertainty,
        };
        if (!journal.result("accepted")) {
          journal.reserve("accepted", accepted);
          journal.finish("accepted", accepted);
          journal.put("restart-required", true);
          return; // The local one-shot launcher restarts the supervisor ONCE at this quiescent checkpoint.
        }
        if (journal.get("restart-required") === true) {
          journal.put("restart-required", false);
          journal.put("restart-observed", Date.now());
        }
        const fault = await peerEvidence(config, "fault");
        if (fault.pending === true) {
          await delay(5000, undefined, { signal });
          continue;
        }
        validateFault(config.proof, fault);
        const after = await snapshot(config, journal);
        verifyAccepted(config.proof, after);
        if (
          !after.events.some(
            (e) =>
              e.key === row.key &&
              e.type === "rejected-stale" &&
              e.fence === 1 &&
              e.worker === config.proof.primary,
          )
        )
          throw Error("proof-stale-rejection-missing");
        if (
          !journal.get("sentinel-held") ||
          !journal.result("sentinel-alert") ||
          !journal.get("restart-observed")
        )
          throw Error("proof-acceptance-incomplete");
        journal.put("terminal", { outcome: "VERIFIED", atMs: Date.now(), accepted, fault });
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
      journal.reserve("stop-isolated-targets", input);
      const stopped = object(await runProofCommand(config.commands.stop, input));
      if (
        stopped.proofId !== config.proof.proofId ||
        stopped.containerStopped !== true ||
        stopped.localProfileStopped !== true ||
        stopped.capabilitiesRemoved !== true ||
        stopped.baselineUnchanged !== true ||
        stopped.scheduleRemoved !== true
      )
        throw Error("proof-cleanup-unverified");
      journal.finish("stop-isolated-targets", stopped);
      const terminal = object(journal.get("terminal"));
      const outcome = terminal.outcome === "VERIFIED" ? "PASS" : "HELD";
      const report = {
        proofId: config.proof.proofId,
        state: outcome,
        code: config.proof.code,
        fixtureSha256: config.proof.fixtureSha256,
        key: jobKey(ledgerSpec(config.proof)),
        resultSha256: object(journal.result("accepted") ?? {}).sha256 ?? null,
        reason: outcome === "HELD" ? terminal.reason : null,
        owner: "proof-supervisor",
        nextAction: "consume-retained-report",
        runtimeModelCalls: 0,
      };
      journal.put("report", report);
      await post(config, journal, "terminal-report", report);
      journal.put("cleanup-complete", Date.now());
      return;
    }
    await delay(1000, undefined, { signal }).catch(() => {});
  }
}
