import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JobStore, jobKey, type Claim } from "../jobs.js";
import {
  LEDGER_RESULT,
  ledgerSpec,
  parseLedgerProof,
  proofHash,
  readProofSnapshot,
} from "../ledger-proof.js";
import { ProofJournal } from "../ledger-proof-state.js";
import { launchLedgerProof } from "../ledger-proof-launcher.js";
import {
  runProofSupervisor,
  runProofWatchdog,
  runProofWorker,
  type ProofRuntime,
} from "../ledger-proof-runtime.js";

const hooks = vi.hoisted(() => ({
  command: vi.fn(),
  client: vi.fn(),
  wait: vi.fn(),
  verify: vi.fn(),
  handler: vi.fn(),
  spawn: vi.fn(),
}));
vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof import("node:child_process")>()),
  spawn: hooks.spawn,
}));
vi.mock("../ledger-proof-command.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ledger-proof-command.js")>()),
  runProofCommand: hooks.command,
  verifyProofCommand: hooks.verify,
}));
vi.mock("../declared-worker.js", async (original) => ({
  ...(await original<typeof import("../declared-worker.js")>()),
  commandHandler: hooks.handler,
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
it("revokes the primary wake when the launcher is stopped after its first idle child", async () => {
  config = { ...config, role: "primary" };
  now = start - 60_000;
  const flag = join(config.evidenceDir, "wake-active");
  writeFileSync(flag, "active");
  const stop = new AbortController();
  hooks.spawn.mockImplementationOnce(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
    });
    queueMicrotask(() => {
      journal.put("idle-stopped", true);
      stop.abort();
      child.emit("close", 0);
    });
    return child;
  });
  await expect(
    launchLedgerProof(config, journal, "/private/settings", "digest", stop.signal),
  ).rejects.toThrow("proof-launcher-expired");
  expect(existsSync(flag)).toBe(false);
});
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
    events: async () => store.events(0),
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
        scheduledWakeMatched: true,
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

it("preserves the approved wake through the first idle stop and revokes it on later shutdown", async () => {
  now = start - 60_000;
  const wakeFlag = join(dir, "wake-active");
  writeFileSync(wakeFlag, "approved wake");
  const workerConfig = {
    ...config,
    role: "primary" as const,
    settings: { ...config.settings, worker: config.proof.primary },
  };
  const runUntilIdleStop = async () => {
    const stop = new AbortController();
    hooks.wait.mockImplementationOnce(async () => stop.abort());
    await runProofWorker(workerConfig, journal, stop.signal);
  };
  await runUntilIdleStop();
  expect(journal.get("idle-stopped")).toBe(true);
  expect(existsSync(wakeFlag)).toBe(true);
  await runUntilIdleStop();
  expect(existsSync(wakeFlag)).toBe(false);
  expect(journal.get("claimed")).toBeUndefined();
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

it("keeps an actual worker idle through empty, partial and paused admission before running exactly one eligible attempt", async () => {
  const proof = config.proof;
  const workerConfig = {
    ...config,
    role: "fallback" as const,
    settings: { ...config.settings, worker: proof.fallback },
  };
  now = start + 300_001;
  store.controlWorker(proof.fallback, "pause");
  let polls = 0;
  const probePolls: number[] = [];
  const checkedCommand = hooks.command.getMockImplementation()!;
  hooks.command.mockImplementation(async (cmd, input) => {
    const result = await checkedCommand(cmd, input);
    if (!cmd.program.endsWith("probe")) return result;
    probePolls.push(polls);
    return { ...result, screenLocked: polls >= 4 };
  });
  hooks.wait.mockImplementation(async (ms) => {
    now += ms;
    polls++;
    if (polls === 1) store.enqueue(ledgerSpecForWorker());
    if (polls === 2) {
      store.enqueue({
        ...ledgerSpecForWorker(),
        kind: "bookcase-ledger-sentinel",
        requires: [`${proof.capability}-unreachable`],
        maxAttempts: 1,
      });
      const actualNow = now;
      now = start;
      store.claim(proof.primary, [proof.capability], ["bookcase-ledger-replay"]);
      now = actualNow;
    }
    if (polls === 3) store.controlWorker(proof.fallback, "resume");
    if (polls === 4) {
      expect(claim).not.toHaveBeenCalled();
      expect(journal.get("readiness-held")).toBe("proof-screen-unlocked");
    }
  });
  function ledgerSpecForWorker() {
    return {
      kind: "bookcase-ledger-replay",
      inputs: [],
      params: { fixtureVersion: 1, fixtureSha256: proof.fixtureSha256, proofId: proof.proofId },
      code: proof.code,
      payload: null,
      requires: [proof.capability],
      priority: 0,
      maxAttempts: 2,
    };
  }
  const claim = vi.fn(
    async () => store.claim(proof.fallback, [proof.capability], ["bookcase-ledger-replay"]) ?? null,
  );
  hooks.client.mockReturnValue({
    claim,
    workerControl: async () => store.workerControl(proof.fallback),
    heartbeat: async () => true,
    complete: async (job: Claim, _bytes: Buffer, sha256: string) =>
      store.complete(job.key, job.fence, proof.fallback, {
        file: `${job.key}.${job.fence}.jsonl`,
        sha256,
      }),
    fail: async (job: Claim, code: string, retryable: boolean) =>
      store.fail(job.key, job.fence, proof.fallback, code, retryable),
    release: async (job: Claim) => store.release(job.key, job.fence, proof.fallback),
  });
  const app = vi.fn(async (job, context) => {
    expect(polls).toBe(4);
    expect(job.fence).toBe(2);
    const file = `${job.key}.${job.fence}.jsonl`;
    writeFileSync(join(context.outDir, file), LEDGER_RESULT);
    return { file, sha256: proofHash(LEDGER_RESULT) };
  });
  hooks.handler.mockReturnValue(app);
  await runProofWorker(workerConfig, journal, new AbortController().signal);
  expect(app).toHaveBeenCalledTimes(1);
  expect(claim).toHaveBeenCalledTimes(1);
  expect(probePolls).toEqual([3, 4]);
  expect((journal.get("terminal") as { outcome: string }).outcome).toBe("COMPLETE");
});

it.each([
  ["unlocked", "proof-not-active", "proof-screen-unlocked"],
  ["stale", "proof-invalid-readiness-receipt", undefined],
  ["protected", "proof-protected-work-active", undefined],
])("never claims an eligible fallback with %s readiness", async (state, outcome, reason) => {
  const proof = { ...config.proof, endsAtMs: start + 310_001 };
  const fallback = {
    ...config,
    proof,
    role: "fallback" as const,
    settings: { ...config.settings, worker: proof.fallback },
  };
  store.enqueue(ledgerSpec(proof));
  store.enqueue(ledgerSpec(proof, true));
  store.claim(proof.primary, [proof.capability], ["bookcase-ledger-replay"]);
  now = start + 300_001;
  const claim = vi.fn();
  hooks.client.mockReturnValue({
    claim,
    workerControl: async () => store.workerControl(proof.fallback),
  });
  const checkedCommand = hooks.command.getMockImplementation()!;
  hooks.command.mockImplementation(async (cmd, input) => {
    const result = await checkedCommand(cmd, input);
    if (!cmd.program.endsWith("probe")) return result;
    if (state === "stale") return { ...result, observedAtMs: now - 10_001 };
    if (state === "protected") return { ...result, protectedIdle: false };
    return { ...result, screenLocked: false };
  });
  await expect(runProofWorker(fallback, journal, new AbortController().signal)).rejects.toThrow(
    outcome,
  );
  expect(claim).not.toHaveBeenCalled();
  expect(journal.get("readiness-held")).toBe(reason);
  expect(journal.get("terminal")).toMatchObject({ outcome: "HELD", reason: outcome });
});

it.each(["wake verified", "helper failure"])(
  "preserves server expiry without sleeping: %s",
  async (scenario) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const proof = config.proof;
    const primary = {
      ...config,
      role: "primary" as const,
      settings: { ...config.settings, worker: proof.primary },
    };
    const key = jobKey(ledgerSpec(proof));
    store.enqueue(ledgerSpec(proof));
    store.enqueue(ledgerSpec(proof, true));
    const stop = new AbortController();
    const checkedCommand = hooks.command.getMockImplementation()!;
    let executeSleep: (() => void) | undefined;
    let resumeProbe: (() => void) | undefined;
    let finishRenewal: (() => void) | undefined;
    let probes = 0;
    let simulatedSleepAt = 0;
    hooks.command.mockImplementation(async (cmd, input) => {
      if (cmd.program.endsWith("probe") && ++probes === 2 && scenario === "helper failure") {
        const receipt = await checkedCommand(cmd, input);
        return new Promise((resolve) => {
          resumeProbe = () => resolve({ ...receipt, observedAtMs: now });
        });
      }
      if (!cmd.program.endsWith("fault")) return checkedCommand(cmd, input);
      simulatedSleepAt = now;
      return new Promise((resolve, reject) => {
        executeSleep = () => {
          if (scenario === "helper failure") {
            reject(Error("proof-command-failed"));
            return;
          }
          resolve({
            osSleepObserved: true,
            osWakeObserved: true,
            scheduledWakeMatched: true,
            wakeEntryRemoved: true,
            powerPolicyUnchanged: true,
            protectedServicesUnchanged: true,
            sleepAtMs: simulatedSleepAt,
            wakeAtMs: now,
          });
        };
      });
    });
    hooks.wait.mockImplementation(
      (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    );
    let renewals = 0;
    const heartbeat = vi.fn(async (job: Claim) => {
      const renew = () => store.heartbeat(job.key, job.fence, proof.primary);
      if (++renewals === 2 && scenario === "helper failure")
        return new Promise<boolean>((resolve) => {
          finishRenewal = () => resolve(renew());
        });
      return renew();
    });
    const complete = vi.fn(async (job: Claim, _bytes: Buffer, sha256: string) =>
      store.complete(job.key, job.fence, proof.primary, {
        file: `${job.key}.${job.fence}.jsonl`,
        sha256,
      }),
    );
    const fail = vi.fn(async (job: Claim, code: string, retryable: boolean) =>
      store.fail(job.key, job.fence, proof.primary, code, retryable),
    );
    const release = vi.fn(async (job: Claim) => store.release(job.key, job.fence, proof.primary));
    hooks.client.mockReturnValue({
      claim: async () => store.claim(proof.primary, [proof.capability], ["bookcase-ledger-replay"]),
      workerControl: async () => store.workerControl(proof.primary),
      heartbeat,
      complete,
      fail,
      release,
    });
    hooks.handler.mockReturnValue(async (job: Claim) => {
      const file = `${job.key}.${job.fence}.jsonl`;
      writeFileSync(join(primary.settings.outDir, file), LEDGER_RESULT);
      return { file, sha256: proofHash(LEDGER_RESULT) };
    });
    const tick = async (ms: number) => {
      now += ms;
      await vi.advanceTimersByTimeAsync(ms);
    };
    const run = runProofWorker(primary, journal, stop.signal);
    const settled = run.catch(() => {});
    try {
      await tick(0);
      await tick(5000);
      await tick(40);
      if (scenario === "helper failure") {
        expect(resumeProbe).toBeTypeOf("function");
        await tick(5000);
        expect(finishRenewal).toBeTypeOf("function");
        resumeProbe?.();
        await tick(0);
        expect(executeSleep).toBeUndefined();
        finishRenewal?.();
        await tick(0);
      }
      expect(executeSleep).toBeTypeOf("function");
      const expectedRenewals = scenario === "helper failure" ? 2 : 1;
      expect(heartbeat).toHaveBeenCalledTimes(expectedRenewals);
      const expires = readProofSnapshot(join(dir, "jobs.sqlite"), join(dir, "out")).rows.find(
        (row) => row.key === key,
      )!.leaseExpires!;
      if (scenario === "helper failure") {
        executeSleep?.();
        await expect(run).rejects.toThrow("proof-command-failed");
        const row = readProofSnapshot(join(dir, "jobs.sqlite"), join(dir, "out")).rows.find(
          (row) => row.key === key,
        );
        expect(row).toMatchObject({ status: "claimed", fence: 1, leaseExpires: expires });
        expect(fail).not.toHaveBeenCalled();
        expect(release).not.toHaveBeenCalled();
        expect(complete).not.toHaveBeenCalled();
        return;
      }
      await tick(10_000);
      expect(heartbeat).toHaveBeenCalledTimes(expectedRenewals);
      expect(
        store.claim(proof.fallback, [proof.capability], ["bookcase-ledger-replay"]),
      ).toBeFalsy();
      await tick(expires - now);
      const fallback = store.claim(proof.fallback, [proof.capability], ["bookcase-ledger-replay"]);
      expect(fallback?.fence).toBe(2);
      const file = `${key}.2.jsonl`;
      writeFileSync(join(dir, "out", file), LEDGER_RESULT);
      expect(
        store.complete(key, 2, proof.fallback, { file, sha256: proofHash(LEDGER_RESULT) }),
      ).toBe(true);
      await tick(start + 420_000 - now);
      executeSleep?.();
      await run;
      expect(complete).toHaveBeenCalledTimes(1);
      expect(complete.mock.calls[0]?.[0].fence).toBe(1);
      expect(fail).not.toHaveBeenCalled();
      expect(release).not.toHaveBeenCalled();
      expect(store.events(0).filter((event) => event.type === "rejected-stale")).toHaveLength(1);
    } finally {
      stop.abort();
      resumeProbe?.();
      finishRenewal?.();
      executeSleep?.();
      await tick(1000);
      await settled;
      vi.useRealTimers();
    }
  },
);

it("cannot replace a concurrent deadline hold with a verified terminal result", async () => {
  await runProofSupervisor(config, journal, new AbortController().signal);
  const original = hooks.command.getMockImplementation()!;
  hooks.command.mockImplementation(async (cmd, input) => {
    if (cmd.program.endsWith("peers") && input.phase === "fault")
      journal.put("terminal", { outcome: "HELD", reason: "proof-deadline" });
    return original(cmd, input);
  });
  await expect(runProofSupervisor(config, journal, new AbortController().signal)).rejects.toThrow(
    "proof-not-active",
  );
  expect(journal.get("terminal")).toEqual({ outcome: "HELD", reason: "proof-deadline" });
  await runProofWatchdog({ ...config, role: "watchdog" }, journal, new AbortController().signal);
  expect((journal.get("report") as { state: string }).state).toBe("HELD");
});

it("retains and sends a cleanup hold even when the stop route fails", async () => {
  journal.put("terminal", { outcome: "VERIFIED" });
  const original = hooks.command.getMockImplementation()!;
  hooks.command.mockImplementation(async (cmd, input) => {
    if (cmd.program.endsWith("stop")) throw Error("unavailable");
    return original(cmd, input);
  });
  await runProofWatchdog({ ...config, role: "watchdog" }, journal, new AbortController().signal);
  expect(journal.get("report")).toMatchObject({
    state: "HELD",
    reason: "proof-cleanup-unverified",
  });
  expect(posts).toHaveLength(1);
  expect(journal.get("cleanup-complete")).toBeUndefined();
});

it("recovers an acknowledged stop without executing it again", async () => {
  journal.put("terminal", { outcome: "HELD", reason: "proof-deadline" });
  const watchdog = { ...config, role: "watchdog" as const };
  await runProofWatchdog(watchdog, journal, new AbortController().signal);
  const stopCalls = () =>
    hooks.command.mock.calls.filter(([cmd]) => cmd.program.endsWith("stop")).length;
  expect(stopCalls()).toBe(1);
  journal.close();
  journal = new ProofJournal(config.stateFile, config.proof);
  await runProofWatchdog(watchdog, journal, new AbortController().signal);
  expect(stopCalls()).toBe(1);
  expect(posts).toHaveLength(1);
});

it("replays the identical accepted terminal report and command after an ACK loss and expiry", async () => {
  journal.put("terminal", { outcome: "VERIFIED", atMs: now });
  const original = hooks.command.getMockImplementation()!;
  const accepted = new Map<string, unknown>();
  let lost = true;
  hooks.command.mockImplementation(async (cmd, input) => {
    if (!cmd.program.endsWith("post")) return original(cmd, input);
    posts.push(input);
    if (!accepted.has(input.commandId)) accepted.set(input.commandId, input.body);
    else expect(input.body).toEqual(accepted.get(input.commandId));
    if (lost) {
      lost = false;
      throw Error("accepted-response-lost");
    }
    return { accepted: true, commandId: input.commandId, sequence: 1, readbackVerified: true };
  });
  const dog = { ...config, role: "watchdog" as const };
  await expect(runProofWatchdog(dog, journal, new AbortController().signal)).rejects.toThrow(
    "accepted-response-lost",
  );
  const frozen = journal.get("report");
  expect(frozen).toMatchObject({ state: "PASS" });
  journal.close();
  journal = new ProofJournal(config.stateFile, config.proof);
  now = config.proof.endsAtMs + 1000;
  await runProofWatchdog(dog, journal, new AbortController().signal);
  expect(journal.get("report")).toEqual(frozen);
  expect(posts[0]).toEqual(posts[1]);
  expect(accepted.size).toBe(1);
  expect(hooks.command.mock.calls.filter(([cmd]) => cmd.program.endsWith("stop"))).toHaveLength(1);
  expect(() => journal.put("report", { state: "HELD" })).toThrow("proof-report-is-immutable");
});

it("keeps the first cleanup-held terminal report and publishes only a separate later cleanup status", async () => {
  journal.put("terminal", { outcome: "VERIFIED", atMs: now });
  const original = hooks.command.getMockImplementation()!;
  let unavailable = true;
  hooks.command.mockImplementation(async (cmd, input) => {
    if (cmd.program.endsWith("stop") && unavailable) throw Error("stop-unavailable");
    return original(cmd, input);
  });
  const dog = { ...config, role: "watchdog" as const };
  await runProofWatchdog(dog, journal, new AbortController().signal);
  const first = journal.get("report");
  expect(first).toMatchObject({ state: "HELD", reason: "proof-cleanup-unverified" });
  unavailable = false;
  await runProofWatchdog(dog, journal, new AbortController().signal);
  expect(journal.get("report")).toEqual(first);
  expect(posts.map((input) => (input as { body: { state: string } }).body.state)).toEqual([
    "HELD",
    "cleanup-complete",
  ]);
  expect(journal.get("cleanup-complete")).toBeDefined();
});
