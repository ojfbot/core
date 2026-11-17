import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JobStore } from "../jobs.js";
import { LEDGER_RESULT, parseLedgerProof, proofHash, readProofSnapshot } from "../ledger-proof.js";
import { ProofJournal } from "../ledger-proof-state.js";
import {
  runProofSupervisor,
  runProofWatchdog,
  type ProofRuntime,
} from "../ledger-proof-runtime.js";

const hooks = vi.hoisted(() => ({ command: vi.fn(), client: vi.fn(), wait: vi.fn() }));
vi.mock("../ledger-proof-command.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ledger-proof-command.js")>()),
  runProofCommand: hooks.command,
}));
vi.mock("../client.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../client.js")>()),
  fleetClient: hooks.client,
}));
vi.mock("node:timers/promises", () => ({ setTimeout: hooks.wait }));
let dir: string, now: number, store: JobStore, journal: ProofJournal, config: ProofRuntime;
let primaryClaimed: boolean, completed: boolean, stopped: boolean;
let oldClaim: ReturnType<JobStore["claim"]>, fallbackClaim: ReturnType<JobStore["claim"]>;
const posts: unknown[] = [];
const start = Date.UTC(2026, 10, 17, 5);
function command(name: string) {
  return { program: `/operator/${name}`, args: [], sha256: "c".repeat(64), files: {} };
}
beforeEach(() => {
  now = start;
  dir = mkdtempSync(join(tmpdir(), "proof-runtime-"));
  mkdirSync(join(dir, "out"), { mode: 0o700 });
  const proof = parseLedgerProof({
    schemaVersion: 1,
    proofId: "12345678-1234-4234-8234-123456789abc",
    startsAtMs: start,
    endsAtMs: start + 90 * 60_000,
    approvalExpiresAtMs: start + 24 * 3600_000,
    code: "a".repeat(40),
    fixtureSha256: "b".repeat(64),
    timeZone: "America/Chicago",
    primary: "cg307-primary-12345678",
    fallback: "cg307-fallback-12345678",
    capability: "cg307-ledger-12345678",
  });
  config = {
    proof,
    role: "supervisor",
    stateFile: join(dir, "control.sqlite"),
    evidenceDir: dir,
    cpuSlot: join(dir, "cpu-slot"),
    pauseFile: join(dir, "pause"),
    reservationFile: join(dir, "reservation"),
    settings: {
      endpoint: "https://localhost:1234/",
      worker: "owner",
      tokenFile: join(dir, "owner.key"),
      outDir: join(dir, "out"),
      statusFile: join(dir, "status.json"),
      pollMs: 5000,
      kinds: {
        "bookcase-ledger-replay": {
          capabilities: [proof.capability],
          command: [process.execPath, "/app/ledger.mjs"],
          timeoutMs: 120_000,
        },
      },
    },
    artifacts: {},
    commands: {
      probe: command("probe"),
      snapshot: command("snapshot"),
      post: command("post"),
      stop: command("stop"),
      fault: command("fault"),
      faultEvidence: command("peers"),
    },
  };
  store = new JobStore(join(dir, "jobs.sqlite"), { now: () => now });
  journal = new ProofJournal(config.stateFile, proof, true);
  journal.put("watchdog-seen", now);
  vi.spyOn(Date, "now").mockImplementation(() => now);
  primaryClaimed = false;
  completed = false;
  stopped = false;
  posts.length = 0;
  oldClaim = undefined;
  fallbackClaim = undefined;
  hooks.client.mockReturnValue({
    enqueue: vi.fn((spec) => store.enqueue(spec)),
    control: vi.fn(async (worker, action) => {
      const result = store.controlWorker(worker, action);
      if (action === "resume" && worker === proof.primary && !primaryClaimed) {
        oldClaim = store.claim(worker, [proof.capability], ["bookcase-ledger-replay"]);
        primaryClaimed = true;
      }
      if (action === "resume" && worker === proof.fallback && !completed) {
        fallbackClaim = store.claim(worker, [proof.capability], ["bookcase-ledger-replay"]);
        expect(fallbackClaim?.fence).toBe(2);
        writeFileSync(join(dir, "out", `${fallbackClaim!.key}.2.jsonl`), LEDGER_RESULT);
        store.complete(fallbackClaim!.key, 2, worker, {
          file: `${fallbackClaim!.key}.2.jsonl`,
          sha256: proofHash(LEDGER_RESULT),
        });
        completed = true;
      }
      return result;
    }),
  });
  hooks.command.mockImplementation(async (cmd, input) => {
    if (cmd.program.endsWith("probe"))
      return {
        proofId: proof.proofId,
        observedAtMs: now,
        loggedIn: true,
        appsClosed: true,
        screenLocked: true,
        protectedIdle: true,
        ac: true,
        wakeReady: true,
      };
    if (cmd.program.endsWith("snapshot")) {
      const seen = readProofSnapshot(join(dir, "jobs.sqlite"), join(dir, "out"));
      return { ...seen, schema: 4, serverNowMs: now };
    }
    if (cmd.program.endsWith("post")) {
      posts.push(input);
      return {
        accepted: true,
        commandId: input.commandId,
        sequence: posts.length,
        readbackVerified: true,
      };
    }
    if (cmd.program.endsWith("peers")) {
      if (input.phase === "ready")
        return {
          proofId: proof.proofId,
          authenticatedReadback: true,
          lineageVerified: true,
          primaryReady: true,
          fallbackReady: true,
          primaryIdleRestartVerified: true,
          observedAtMs: now,
        };
      if (oldClaim)
        store.complete(oldClaim.key, 1, proof.primary, {
          file: `${oldClaim.key}.1.jsonl`,
          sha256: proofHash("old"),
        });
      return {
        proofId: proof.proofId,
        authenticatedReadback: true,
        lineageVerified: true,
        staleRejected: true,
        osSleepObserved: true,
        osWakeObserved: true,
        wakeEntryRemoved: true,
        powerPolicyUnchanged: true,
        protectedServicesUnchanged: true,
        sleepAtMs: start + 5000,
        wakeAtMs: start + 420_000,
        lastRenewalAtMs: start,
      };
    }
    if (cmd.program.endsWith("stop")) {
      stopped = true;
      return {
        proofId: proof.proofId,
        containerStopped: true,
        localProfileStopped: true,
        capabilitiesRemoved: true,
        baselineUnchanged: true,
        scheduleRemoved: true,
      };
    }
    throw Error("unexpected command");
  });
  hooks.wait.mockImplementation(async (ms) => {
    now += ms;
    journal.put("watchdog-seen", now);
  });
});
afterEach(() => {
  journal?.close();
  store?.close();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

it("admits exactly two jobs, holds the sentinel, recovers after accepted-output restart and cleans up once", async () => {
  await runProofSupervisor(config, journal, new AbortController().signal);
  expect(completed).toBe(true);
  expect(journal.get("restart-required")).toBe(true);
  expect(journal.result("sentinel-alert")).toBeDefined();
  const client = hooks.client.mock.results[0]!.value;
  expect(client.enqueue).toHaveBeenCalledTimes(2);
  // Ordinary process restart, same durable binding and exact effect keys.
  journal.close();
  journal = new ProofJournal(config.stateFile, config.proof);
  await runProofSupervisor(config, journal, new AbortController().signal);
  expect((journal.get("terminal") as { outcome: string }).outcome).toBe("VERIFIED");
  expect(client.enqueue).toHaveBeenCalledTimes(2);
  await runProofWatchdog({ ...config, role: "watchdog" }, journal, new AbortController().signal);
  expect(stopped).toBe(true);
  expect(journal.get("cleanup-complete")).toBeDefined();
  expect((journal.get("report") as { state: string }).state).toBe("PASS");
  expect(posts).toHaveLength(2);
  expect(store.events(0).filter((e) => e.type === "claimed")).toHaveLength(2);
});
it("refuses an occupied queue without admission or enabling a worker", async () => {
  store.enqueue({ kind: "other", inputs: [], payload: null });
  await expect(runProofSupervisor(config, journal, new AbortController().signal)).rejects.toThrow(
    "proof-queue-not-synthetic",
  );
  expect(hooks.client.mock.results[0]!.value.enqueue).not.toHaveBeenCalled();
});
it("independently stops on missing supervisor heartbeat and reports a retained hold", async () => {
  now += 31_000;
  await runProofWatchdog({ ...config, role: "watchdog" }, journal, new AbortController().signal);
  expect(stopped).toBe(true);
  expect((journal.get("report") as { state: string }).state).toBe("HELD");
  expect(hooks.client).not.toHaveBeenCalled();
});
it("does not enqueue, resume or extend the epoch after the original deadline", async () => {
  now = config.proof.endsAtMs;
  await expect(runProofSupervisor(config, journal, new AbortController().signal)).rejects.toThrow(
    "proof-deadline",
  );
  expect(hooks.client.mock.results[0]!.value.enqueue).not.toHaveBeenCalled();
  await runProofWatchdog({ ...config, role: "watchdog" }, journal, new AbortController().signal);
  expect(stopped).toBe(true);
});
