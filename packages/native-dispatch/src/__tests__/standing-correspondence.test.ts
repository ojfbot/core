import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DatabaseSync as Database } from "node:sqlite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  digest,
  initializeStandingCorrespondenceJournal,
  openStandingCorrespondenceEmulation,
  prepareStandingCorrespondenceEmulationPolicy,
  prepareStandingCorrespondencePolicy,
  prepareStandingCorrespondenceQualificationPolicy,
  standingCorrespondenceGrantRevision,
  qualifyStandingClaudeCorrespondenceEmulation,
  openCorrespondenceEmulation,
  prepareCorrespondenceEmulationPlan,
  openStandingCorrespondence,
  reviewCorrespondenceJournal,
  readStandingCorrespondenceRecovery,
} from "../index.js";
import type {
  PreparedStandingCorrespondencePolicy,
  StandingCorrespondenceDispatcher,
  CorrespondencePacket,
  CorrespondenceEmulatorScript,
} from "../index.js";
import { readPrivateFile } from "../supervised-files.js";
const lateLaunch = vi.hoisted(() => ({
  run: undefined as (() => void) | undefined,
  calls: 0,
  transports: new WeakSet<object>(),
}));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});
vi.mock("../correspondence-native.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../correspondence-native.js")>();
  return {
    ...actual,
    isCorrespondenceTransport: (value: unknown) =>
      (typeof value === "object" && value !== null && lateLaunch.transports.has(value)) ||
      actual.isCorrespondenceTransport(value),
    createCorrespondenceTransport: (
      ...args: Parameters<typeof actual.createCorrespondenceTransport>
    ) => {
      if (!lateLaunch.run) return actual.createCorrespondenceTransport(...args);
      const emulator = actual.createCorrespondenceEmulator(() => {
        lateLaunch.calls++;
        return { kind: "lost" };
      });
      const transport: ReturnType<typeof actual.createCorrespondenceTransport> = {
        mode: "supervised",
        resume: async (request) => {
          lateLaunch.run?.();
          try {
            args[3]();
          } catch {
            throw new actual.CorrespondencePrelaunchError("held");
          }
          return emulator.transport.resume(request);
        },
      };
      lateLaunch.transports.add(transport);
      return transport;
    },
  };
});
vi.mock("../correspondence-qualification.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../correspondence-qualification.js")>();
  return {
    ...actual,
    checkCorrespondenceQualification: (
      ...args: Parameters<typeof actual.checkCorrespondenceQualification>
    ) => {
      if (!lateLaunch.run) return actual.checkCorrespondenceQualification(...args);
    },
  };
});
vi.mock("../supervised-files.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../supervised-files.js")>();
  return {
    ...actual,
    readPrivateFile: vi.fn(actual.readPrivateFile),
    checkBinary: (...args: Parameters<typeof actual.checkBinary>) => {
      if (!lateLaunch.run) return actual.checkBinary(...args);
    },
    checkNativeEnvironment: (...args: Parameters<typeof actual.checkNativeEnvironment>) => {
      if (!lateLaunch.run) return actual.checkNativeEnvironment(...args);
    },
    checkNativeProfile: (...args: Parameters<typeof actual.checkNativeProfile>) => {
      if (!lateLaunch.run) return actual.checkNativeProfile(...args);
    },
  };
});
const readOriginal = vi.mocked(readPrivateFile).getMockImplementation()!;
const spawnOriginal = vi.mocked(spawnSync).getMockImplementation()!;
const realProcess = process;
let aclPaths: string[];
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const origin = { deviceId: "origin-device", sessionId: "sender-session" };
const HOUR = 3600000,
  DAY = 24 * HOUR;
let dir: string, state: string, approvalPath: string, revokePath: string, clock: number;
let opened: StandingCorrespondenceDispatcher[];
beforeEach(() => {
  // Match the existing correspondence fixtures: emulate only macOS ACL observations, while
  // retaining the real private-file, ownership, mode, symlink and native authority checks.
  aclPaths = [];
  vi.stubGlobal(
    "process",
    new Proxy(realProcess, {
      get: (target, key) => (key === "platform" ? "darwin" : Reflect.get(target, key)),
    }),
  );
  vi.mocked(spawnSync).mockImplementation((file, args, options) => {
    if (file === "/bin/ls")
      return {
        pid: 0,
        output: [],
        status: 0,
        signal: null,
        stdout: (args ?? [])
          .slice(1)
          .map((path) =>
            aclPaths.includes(String(path))
              ? "drwx------+ 1 fixture\n 0: user:other allow write\n"
              : "drwx------ 1 fixture\n",
          )
          .join(""),
        stderr: "",
      };
    return spawnOriginal(file, args, options);
  });
  dir = realpathSync(mkdtempSync(join(tmpdir(), "standing-correspondence-")));
  for (const name of ["empty", "home", "temp"]) mkdirSync(join(dir, name), { mode: 0o700 });
  state = join(dir, "invocations.sqlite");
  approvalPath = join(dir, "approval.json");
  revokePath = join(dir, "revocation.json");
  clock = 100000;
  opened = [];
});
afterEach(() => {
  lateLaunch.run = undefined;
  lateLaunch.calls = 0;
  vi.mocked(readPrivateFile).mockImplementation(readOriginal);
  for (const dispatcher of opened) dispatcher.close();
  rmSync(dir, { recursive: true, force: true });
  vi.mocked(spawnSync).mockImplementation(spawnOriginal);
  vi.unstubAllGlobals();
});
function raw() {
  return {
    schemaVersion: 1,
    kind: "standing-correspondence-policy",
    revision: "revision-1",
    lineageId: "lineage-1",
    deviceId: "local-device",
    profiles: [
      {
        provider: "claude-code",
        revision: "claude-profile",
        binaryRealPath: join(dir, "never-run"),
        binarySHA256: "a".repeat(64),
        nativeVersion: "2.1.286",
        model: "test-model",
        effort: "low",
        authMode: "existing-subscription",
        customizationPolicy: "none",
      },
    ],
    bindings: ["first-duty", "second-duty"].map((alias) => ({
      alias,
      revision: "binding-1",
      deviceId: "local-device",
      provider: "claude-code",
      profileRevision: "claude-profile",
      sessionPolicy: "fresh-per-dispatch",
      cwd: join(dir, "empty"),
      resources: [`helpdesk:thread:${uuid(900)}`],
    })),
    origins: [origin],
    capabilities: ["correspondence", "listener-status"],
    environment: { HOME: join(dir, "home"), CODEX_HOME: null, TMPDIR: join(dir, "temp") },
    sourceRevision: "b".repeat(40),
    limits: { hourlyTurns: 2, dailyTurns: 3, requestTimeoutMs: 120000 },
  };
}
function grant(
  p: PreparedStandingCorrespondencePolicy,
  purpose = "duty",
  grantId = "grant-1",
  start = 0,
) {
  const revocation = JSON.stringify({
    schemaVersion: 1,
    deviceId: p.policy.deviceId,
    lineageId: p.policy.lineageId,
    revoked: false,
  });
  writeFileSync(revokePath, revocation, { mode: 0o600 });
  writeFileSync(
    approvalPath,
    JSON.stringify({
      kind: "owner-approved-standing-correspondence",
      purpose,
      grantId,
      policyDigest: p.policyDigest,
      lineageId: p.policy.lineageId,
      deviceId: p.policy.deviceId,
      invocationStateFile: state,
      startsAtMs: start,
      expiresAtMs: start + (purpose === "qualification" ? 1800000 : DAY),
      ownerNativeApprovalRef: "synthetic-owner-authority",
      revocationFile: revokePath,
      revocationDigest: digest(revocation),
    }),
    { mode: 0o600 },
  );
}
function packet(n: number, alias = "first-duty"): CorrespondencePacket {
  return {
    kind: "correspondence-packet",
    version: 1,
    duty: { device_id: "local-device", session_id: alias },
    request: {
      message_id: uuid(n),
      thread_id: uuid(900),
      sequence: n,
      subject: "Synthetic request",
      sender: { device_id: origin.deviceId, session_id: origin.sessionId },
      body: "What is the recorded status?",
    },
    thread: [],
    omitted: { earlier_messages: 0, truncated_bodies: 0 },
    context_round: { used: 0, limit: 3 },
    best_effort: false,
  };
}
function request(
  p: PreparedStandingCorrespondencePolicy,
  n: number,
  alias = "first-duty",
  body = packet(n, alias),
) {
  const binding = p.policy.bindings.find((b) => b.alias === alias)!;
  const input = JSON.stringify(body);
  return {
    deliveryId: `delivery-${n}-${alias}`,
    streamId: uuid(800),
    eventId: uuid(n + 1000),
    messageId: uuid(n),
    threadId: uuid(900),
    sequence: n,
    recipient: alias,
    bindingRevision: binding.revision,
    charterId: p.policy.lineageId,
    grantRevision: standingCorrespondenceGrantRevision(p, alias),
    profileRevision: binding.profileRevision,
    workflow: "correspondence",
    resources: [`helpdesk:thread:${uuid(900)}`],
    task: { input, inputDigest: digest(input) },
  };
}
const answer = (_: unknown, turn: { packetDigest: string }) => ({
  kind: "answer" as const,
  answer: {
    packetDigest: turn.packetDigest,
    decision: "reply",
    reason: null,
    text: "Synthetic reply",
    needs: null,
    gaps: null,
  },
});
function start(
  p = prepareStandingCorrespondenceEmulationPolicy(raw()),
  initialize = true,
  script: CorrespondenceEmulatorScript = answer,
) {
  if (initialize) {
    initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" });
    grant(p);
  }
  const result = openStandingCorrespondenceEmulation({
    prepared: p,
    stateFile: state,
    runtimeApprovalFile: approvalPath,
    deviceId: p.policy.deviceId,
    now: () => clock,
    script,
  });
  expect(result.kind).toBe("ready");
  if (result.kind !== "ready") throw Error(JSON.stringify(result));
  opened.push(result.dispatcher);
  return { p, ...result };
}
function close(d: StandingCorrespondenceDispatcher) {
  d.close();
  opened = opened.filter((x) => x !== d);
}
const send = (d: StandingCorrespondenceDispatcher, req: unknown) =>
  d.dispatch(req, { authenticatedOrigin: origin });
function query(sql: string) {
  const db = new DatabaseSync(state);
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

it("keeps exact address/thread rules local to standing policy", () => {
  for (const alias of ["ab", "Bad-Alias", "has.dot", "a".repeat(33)]) {
    const v = raw();
    v.bindings[0].alias = alias;
    expect(() => prepareStandingCorrespondenceEmulationPolicy(v)).toThrow(
      "invalid-standing-policy",
    );
  }
  const wildcard = raw();
  wildcard.bindings[0].resources = ["helpdesk:thread:*"];
  expect(() => prepareStandingCorrespondenceEmulationPolicy(wildcard)).toThrow(
    "invalid-standing-policy",
  );
  const v = raw();
  v.bindings[0].revision = "revision.with.dots";
  expect(prepareStandingCorrespondenceEmulationPolicy(v).policy.bindings).toHaveLength(2);
  v.profiles[0].provider = "codex";
  expect(() => prepareStandingCorrespondenceEmulationPolicy(v)).toThrow("revoked-provider");
});
it("runtime cannot create missing accounting; bootstrap refuses existing journals", () => {
  const p = prepareStandingCorrespondenceEmulationPolicy(raw());
  grant(p);
  expect(
    openStandingCorrespondenceEmulation({
      prepared: p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: p.policy.deviceId,
      now: () => clock,
      script: answer,
    }),
  ).toMatchObject({ kind: "held", holds: ["standing-budget-missing"] });
  expect(existsSync(state)).toBe(false);
  initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" });
  expect(() =>
    initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" }),
  ).toThrow("standing-budget-already-initialized");
});
it("binds authenticated journal origin separately from packet claims before spending", async () => {
  const { p, dispatcher, invocations } = start();
  expect(await dispatcher.dispatch(request(p, 1))).toEqual({
    kind: "refused",
    reason: "standing-origin-denied",
  });
  expect(
    await dispatcher.dispatch(request(p, 1), {
      authenticatedOrigin: { deviceId: "forged", sessionId: origin.sessionId },
    }),
  ).toEqual({ kind: "refused", reason: "standing-origin-denied" });
  expect(invocations?.()).toBe(0);
  expect(await send(dispatcher, request(p, 1))).toMatchObject({
    kind: "observed",
    outcome: "completed",
  });
});
it("deduplicates one received message across aliases and rejects changed content", async () => {
  const { p, dispatcher, invocations } = start();
  const first = await send(dispatcher, request(p, 1));
  expect(await send(dispatcher, request(p, 1, "second-duty"))).toEqual(first);
  expect(dispatcher.agentProposal("delivery-1-second-duty")?.correspondence.text).toBe(
    "Synthetic reply",
  );
  const changed = packet(1, "second-duty");
  changed.request.body = "Changed";
  expect(await send(dispatcher, request(p, 1, "second-duty", changed))).toEqual({
    kind: "refused",
    reason: "delivery-conflict",
  });
  expect(invocations?.()).toBe(1);
  close(dispatcher);
  expect(query("SELECT count(*) AS n FROM standing_budget_reservations")).toEqual([{ n: 1 }]);
  expect(query("SELECT count(*) AS n FROM invocations")).toEqual([{ n: 1 }]);
});
it("shares rolling counters across aliases, restart, revision, grant and alias renewal", async () => {
  const first = start();
  await send(first.dispatcher, request(first.p, 1));
  await send(first.dispatcher, request(first.p, 2, "second-duty"));
  expect(await send(first.dispatcher, request(first.p, 3))).toEqual({
    kind: "refused",
    reason: "standing-hourly-limit",
  });
  close(first.dispatcher);
  const v = raw();
  v.revision = "revision-2";
  v.bindings[0].alias = "renewed-duty";
  const p = prepareStandingCorrespondenceEmulationPolicy(v);
  grant(p, "duty", "renewed-grant");
  const renewed = start(p, false);
  expect(await send(renewed.dispatcher, request(p, 3, "renewed-duty"))).toEqual({
    kind: "refused",
    reason: "standing-hourly-limit",
  });
  clock += HOUR;
  expect(await send(renewed.dispatcher, request(p, 3, "renewed-duty"))).toMatchObject({
    kind: "observed",
  });
  clock += HOUR;
  expect(await send(renewed.dispatcher, request(p, 4, "renewed-duty"))).toEqual({
    kind: "refused",
    reason: "standing-daily-limit",
  });
});
it("retains one host controller across aliases and charges an unknown result", async () => {
  const p = prepareStandingCorrespondenceEmulationPolicy(raw());
  let finish!: () => void;
  const wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const r = start(p, true, async () => {
    await wait;
    return { kind: "lost" };
  });
  const active = send(r.dispatcher, request(p, 1));
  expect(await send(r.dispatcher, request(p, 2, "second-duty"))).toMatchObject({ kind: "busy" });
  finish();
  expect(await active).toMatchObject({ kind: "unknown" });
  close(r.dispatcher);
  const next = start(p, false);
  expect(await send(next.dispatcher, request(p, 2, "second-duty"))).toMatchObject({ kind: "busy" });
  close(next.dispatcher);
  expect(query("SELECT state FROM standing_budget_reservations")).toEqual([{ state: "started" }]);
});
it("refunds a proven prelaunch revocation with the terminal refusal and persists closure", async () => {
  const { p, dispatcher, invocations } = start();
  const original = readFileSync(revokePath, "utf8");
  let reads = 0;
  vi.mocked(readPrivateFile).mockImplementation((path, bytes) => {
    const value = readOriginal(path, bytes);
    if (path === revokePath && ++reads === 2) {
      writeFileSync(revokePath, JSON.stringify({ ...JSON.parse(original), revoked: true }));
    }
    return value;
  });
  expect(await send(dispatcher, request(p, 1))).toEqual({
    kind: "refused",
    reason: "standing-policy-revoked",
  });
  expect(invocations?.()).toBe(0);
  close(dispatcher);
  expect(query("SELECT state FROM standing_budget_reservations")).toEqual([{ state: "refunded" }]);
  expect(query("SELECT state FROM invocations")).toEqual([{ state: "observed" }]);
  vi.mocked(readPrivateFile).mockImplementation(readOriginal);
  writeFileSync(revokePath, original);
  expect(reopen(p)).toMatchObject({ kind: "held", holds: ["standing-policy-revoked"] });
});
it("holds corrupt/missing quota or invocation rows instead of recreating an allowance", async () => {
  const first = start();
  await send(first.dispatcher, request(first.p, 1));
  close(first.dispatcher);
  const db = new DatabaseSync(state);
  db.exec("DELETE FROM invocations");
  db.close();
  expect(
    openStandingCorrespondenceEmulation({
      prepared: first.p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: first.p.policy.deviceId,
      now: () => clock,
      script: answer,
    }),
  ).toMatchObject({ kind: "held", holds: ["standing-budget-corrupt"] });
});
it("rejects lineage/device allocation changes and clock rollback", async () => {
  const first = start();
  await send(first.dispatcher, request(first.p, 1));
  clock--;
  expect(await send(first.dispatcher, request(first.p, 2))).toEqual({
    kind: "refused",
    reason: "standing-clock-rollback",
  });
  close(first.dispatcher);
  const v = raw();
  v.limits.hourlyTurns = 3;
  const p = prepareStandingCorrespondenceEmulationPolicy(v);
  grant(p);
  expect(
    openStandingCorrespondenceEmulation({
      prepared: p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: p.policy.deviceId,
      now: () => clock,
      script: answer,
    }),
  ).toMatchObject({ kind: "held", holds: ["standing-budget-policy-mismatch"] });
});
it("requires current approval and revocation records at reservation", async () => {
  const { p, dispatcher, invocations } = start();
  rmSync(revokePath);
  expect(await send(dispatcher, request(p, 1))).toEqual({
    kind: "refused",
    reason: "standing-policy-changed",
  });
  expect(invocations?.()).toBe(0);
});
it("aborts an active synthetic turn on revocation, leaving an unknown charged effect", async () => {
  const r = start(undefined, true, () => ({ kind: "hang" }) as never);
  const pending = send(r.dispatcher, request(r.p, 1));
  writeFileSync(
    revokePath,
    JSON.stringify({
      schemaVersion: 1,
      deviceId: r.p.policy.deviceId,
      lineageId: r.p.policy.lineageId,
      revoked: true,
    }),
  );
  expect(await pending).toMatchObject({ kind: "unknown" });
  expect(await send(r.dispatcher, request(r.p, 2))).toEqual({
    kind: "refused",
    reason: "standing-policy-revoked",
  });
});
it("standing qualification consumes the same host quota and controller under a separate one-turn grant", async () => {
  const p = prepareStandingCorrespondenceQualificationPolicy(raw());
  initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" });
  grant(p, "qualification", "qualification-one");
  const qualification = await qualifyStandingClaudeCorrespondenceEmulation({
    prepared: p,
    stateFile: state,
    runtimeApprovalFile: approvalPath,
    deviceId: p.policy.deviceId,
    now: () => clock,
    frames: () => [],
  });
  expect(qualification.kind).toBe("ran");
  if (qualification.kind !== "ran" || qualification.disposition.kind !== "unknown")
    throw Error(JSON.stringify(qualification));
  const duty = prepareStandingCorrespondenceEmulationPolicy(raw());
  grant(duty);
  const r = start(duty, false);
  expect(await send(r.dispatcher, request(duty, 1))).toMatchObject({ kind: "busy" });
  r.dispatcher.reconcile({
    dispatchId: qualification.disposition.dispatchId,
    nativeSessionId: qualification.disposition.nativeSessionId,
    nativeTurnId: null,
    outcome: "failed",
  });
  expect(await send(r.dispatcher, request(duty, 1))).toMatchObject({ kind: "observed" });
  expect(await send(r.dispatcher, request(duty, 2))).toEqual({
    kind: "refused",
    reason: "standing-hourly-limit",
  });
  close(r.dispatcher);
  clock += HOUR;
  grant(p, "qualification", "qualification-one", clock);
  expect(
    await qualifyStandingClaudeCorrespondenceEmulation({
      prepared: p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: p.policy.deviceId,
      now: () => clock,
      frames: () => [],
    }),
  ).toMatchObject({
    kind: "not-run",
    disposition: { kind: "refused", reason: "budget-exhausted" },
  });
});
it("legacy window openers cannot reuse a standing journal", () => {
  const r = start();
  close(r.dispatcher);
  const v = raw();
  const finite = prepareCorrespondenceEmulationPlan({
    schemaVersion: 1,
    kind: "correspondence",
    revision: "finite",
    windowId: "finite-window",
    deviceId: v.deviceId,
    profiles: v.profiles,
    bindings: [v.bindings[0]],
    environment: v.environment,
    limits: { topLevelTurns: 1, windowMs: 60000, requestTimeoutMs: 120000 },
    supervision: { kind: "owner-attended" },
    declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
  });
  expect(() =>
    openCorrespondenceEmulation({
      prepared: finite,
      stateFile: state,
      now: () => clock,
      script: answer,
    }),
  ).toThrow("journal-source-mismatch");
});

it("refuses a second controller and reports the standing source without running a provider", () => {
  const r = start();
  expect(
    openStandingCorrespondenceEmulation({
      prepared: r.p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: r.p.policy.deviceId,
      now: () => clock,
      script: answer,
    }),
  ).toMatchObject({ kind: "held", holds: ["dispatcher-already-open"] });
  expect(() =>
    openStandingCorrespondence({
      prepared: r.p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: r.p.policy.deviceId,
    }),
  ).toThrow("live-not-armed");
  close(r.dispatcher);
  expect(reviewCorrespondenceJournal(state).source).toBe("standing-emulated");
});
it("rolls back the actual invocation intent and quota together on an insert failure", async () => {
  const p = prepareStandingCorrespondenceEmulationPolicy(raw());
  initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" });
  grant(p);
  const db = new DatabaseSync(state);
  db.exec(
    "CREATE TRIGGER synthetic_crash BEFORE INSERT ON invocations BEGIN SELECT RAISE(ABORT,'synthetic-crash'); END",
  );
  db.close();
  const r = start(p, false);
  await expect(send(r.dispatcher, request(p, 1))).rejects.toThrow("synthetic-crash");
  expect(r.invocations?.()).toBe(0);
  close(r.dispatcher);
  expect(query("SELECT count(*) AS n FROM standing_budget_reservations")).toEqual([{ n: 0 }]);
  expect(query("SELECT count(*) AS n FROM invocations")).toEqual([{ n: 0 }]);
});
it("refunds expiry between reservation and launch and keeps the grant closed across rollback/restart", async () => {
  const r = start();
  let reads = 0;
  vi.mocked(readPrivateFile).mockImplementation((path, bytes) => {
    const value = readOriginal(path, bytes);
    if (path === revokePath && ++reads === 2) clock = DAY;
    return value;
  });
  expect(await send(r.dispatcher, request(r.p, 1))).toEqual({ kind: "refused", reason: "expired" });
  expect(r.invocations?.()).toBe(0);
  close(r.dispatcher);
  expect(query("SELECT state FROM standing_budget_reservations")).toEqual([{ state: "refunded" }]);
  vi.mocked(readPrivateFile).mockImplementation(readOriginal);
  clock = 100000;
  expect(reopen(r.p)).toMatchObject({ kind: "held", holds: ["expired"] });
});
it.each([
  "DELETE FROM controllers",
  "DELETE FROM budgets",
  "DELETE FROM grant_usage",
  "UPDATE standing_budget_reservations SET admitted_at=0",
  "DROP TABLE standing_budget_reservations",
])("fails closed after accounting/controller corruption: %s", async (sql) => {
  const r = start(undefined, true, () => ({ kind: "lost" }) as never);
  await send(r.dispatcher, request(r.p, 1));
  close(r.dispatcher);
  const db = new DatabaseSync(state);
  db.exec(sql);
  db.close();
  expect(
    openStandingCorrespondenceEmulation({
      prepared: r.p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: r.p.policy.deviceId,
      now: () => clock,
      script: answer,
    }),
  ).toMatchObject({ kind: "held", holds: ["standing-budget-corrupt"] });
});
it("detaches opened capability/origin authority from caller-owned arrays", async () => {
  const v = raw();
  v.capabilities = ["listener-status"];
  const p = prepareStandingCorrespondenceEmulationPolicy(v);
  const r = start(p);
  p.policy.capabilities.push("correspondence");
  p.policy.origins.push({ deviceId: "extra-device", sessionId: "extra-session" });
  const pristine = prepareStandingCorrespondenceEmulationPolicy(v);
  expect(await send(r.dispatcher, request(pristine, 1))).toEqual({
    kind: "refused",
    reason: "resource-denied",
  });
  expect(r.invocations?.()).toBe(0);
});

function reopen(p: PreparedStandingCorrespondencePolicy) {
  return openStandingCorrespondenceEmulation({
    prepared: p,
    stateFile: state,
    runtimeApprovalFile: approvalPath,
    deviceId: p.policy.deviceId,
    now: () => clock,
    script: answer,
  });
}
function recover(
  p: PreparedStandingCorrespondencePolicy,
  n = 1,
  inputDigest = request(p, n).task.inputDigest,
) {
  return readStandingCorrespondenceRecovery({
    prepared: p,
    stateFile: state,
    deviceId: p.policy.deviceId,
    deliveryId: request(p, n).deliveryId,
    inputDigest,
  });
}
it.each(["revoked", "expired", "missing", "changed", "corrupt-revocation"])(
  "persists closure observed on reopen: %s",
  (change) => {
    const r = start();
    close(r.dispatcher);
    const approval = readFileSync(approvalPath),
      revocation = readFileSync(revokePath);
    if (change === "revoked")
      writeFileSync(
        revokePath,
        JSON.stringify({ ...JSON.parse(revocation.toString()), revoked: true }),
      );
    if (change === "expired") clock = DAY;
    if (change === "missing") rmSync(approvalPath);
    if (change === "changed") writeFileSync(approvalPath, "{}");
    if (change === "corrupt-revocation") writeFileSync(revokePath, "{}");
    expect(reopen(r.p).kind).toBe("held");
    clock = 100000;
    writeFileSync(approvalPath, approval, { mode: 0o600 });
    writeFileSync(revokePath, revocation);
    expect(reopen(r.p).kind).toBe("held");
    expect(query("SELECT count(*) AS n FROM invocations")).toEqual([{ n: 0 }]);
  },
);
it("persists revocation on the first authority observation, before any ready opener", () => {
  const p = prepareStandingCorrespondenceEmulationPolicy(raw());
  initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" });
  grant(p);
  const original = readFileSync(revokePath, "utf8");
  writeFileSync(revokePath, JSON.stringify({ ...JSON.parse(original), revoked: true }));
  expect(reopen(p)).toMatchObject({ kind: "held", holds: ["standing-policy-revoked"] });
  writeFileSync(revokePath, original);
  expect(reopen(p)).toMatchObject({ kind: "held", holds: ["standing-policy-revoked"] });
});
it.each([
  "{}",
  '{"kind":null}',
  '{"kind":"other"}',
  '{"kind":"observed","outcome":"completed"}',
  '{"kind":"refused","reason":null}',
])("rejects malformed persisted disposition without refunding or replay: %s", async (value) => {
  const r = start();
  await send(r.dispatcher, request(r.p, 1));
  close(r.dispatcher);
  const db = new DatabaseSync(state);
  db.prepare("UPDATE invocations SET disposition=?").run(value);
  db.close();
  const before = readFileSync(state);
  expect(reopen(r.p)).toMatchObject({ kind: "held", holds: ["standing-budget-corrupt"] });
  expect(recover(r.p)).toMatchObject({ kind: "held", holds: ["standing-budget-corrupt"] });
  expect(query("SELECT state FROM standing_budget_reservations")).toEqual([{ state: "started" }]);
  expect(readFileSync(state)).toEqual(before);
});
it.each(["expired", "revoked", "missing"])(
  "recovers completed evidence read-only after %s with no invocation rights",
  async (change) => {
    const r = start();
    const req = request(r.p, 1);
    const result = await send(r.dispatcher, req);
    const proposal = r.dispatcher.agentProposal(req.deliveryId);
    close(r.dispatcher);
    if (change === "expired") clock = DAY;
    if (change === "revoked") {
      const revocation = JSON.parse(readFileSync(revokePath, "utf8"));
      writeFileSync(revokePath, JSON.stringify({ ...revocation, revoked: true }));
    }
    if (change === "missing") rmSync(approvalPath);
    expect(reopen(r.p).kind).toBe("held");
    const before = readFileSync(state);
    expect(recover(r.p)).toEqual({ kind: "recorded", disposition: result, proposal });
    expect(recover(r.p)).toEqual({ kind: "recorded", disposition: result, proposal });
    expect(readFileSync(state)).toEqual(before);
    expect(query("SELECT count(*) AS n FROM invocations")).toEqual([{ n: 1 }]);
    expect(recover(r.p, 1, "a".repeat(64))).toMatchObject({
      kind: "held",
      holds: ["delivery-conflict"],
    });
  },
);
it("recovery preserves unknown and holds malformed proposal or missing history", async () => {
  const r = start(undefined, true, () => ({ kind: "lost" }));
  await send(r.dispatcher, request(r.p, 1));
  close(r.dispatcher);
  expect(recover(r.p)).toMatchObject({ kind: "recorded", disposition: { kind: "unknown" } });
  const db = new DatabaseSync(state);
  db.exec("DROP TABLE standing_inputs");
  db.close();
  expect(recover(r.p)).toMatchObject({ kind: "held", holds: ["standing-budget-corrupt"] });
});
it("recovery rejects a malformed completed proposal", async () => {
  const r = start();
  await send(r.dispatcher, request(r.p, 1));
  close(r.dispatcher);
  const db = new DatabaseSync(state);
  db.exec("UPDATE advisory_proposals SET proposal='{}'");
  db.close();
  expect(recover(r.p)).toMatchObject({ kind: "held", holds: ["standing-budget-corrupt"] });
});

it.each(["revoked", "missing", "changed", "expired"])(
  "persists authority loss at the final native pre-spawn callback: %s",
  async (change) => {
    const p = prepareStandingCorrespondencePolicy(raw());
    initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "live" });
    grant(p, "duty", "grant-final-check", clock);
    const approval = readFileSync(approvalPath),
      revocation = readFileSync(revokePath);
    let liveClock = clock;
    const mockedNow = vi.spyOn(Date, "now").mockImplementation(() => liveClock);
    lateLaunch.run = () => {
      if (change === "revoked")
        writeFileSync(
          revokePath,
          JSON.stringify({ ...JSON.parse(revocation.toString()), revoked: true }),
        );
      if (change === "missing") rmSync(approvalPath);
      if (change === "changed") writeFileSync(approvalPath, "{}");
      if (change === "expired") liveClock += DAY;
    };
    try {
      const result = openStandingCorrespondence({
        prepared: p,
        stateFile: state,
        runtimeApprovalFile: approvalPath,
        deviceId: p.policy.deviceId,
      });
      expect(result.kind).toBe("ready");
      if (result.kind !== "ready") throw Error(JSON.stringify(result));
      opened.push(result.dispatcher);
      expect(await send(result.dispatcher, request(p, 1))).toEqual({
        kind: "refused",
        reason: "held",
      });
      expect(lateLaunch.calls).toBe(0);
      close(result.dispatcher);
      liveClock = clock;
      writeFileSync(approvalPath, approval, { mode: 0o600 });
      writeFileSync(revokePath, revocation);
      expect(
        openStandingCorrespondence({
          prepared: p,
          stateFile: state,
          runtimeApprovalFile: approvalPath,
          deviceId: p.policy.deviceId,
        }).kind,
      ).toBe("held");
      expect(query("SELECT state FROM standing_budget_reservations")).toEqual([
        { state: "refunded" },
      ]);
      expect(query("SELECT count(*) AS n FROM standing_closed_grants")).toEqual([{ n: 1 }]);
    } finally {
      mockedNow.mockRestore();
    }
  },
);

it("retains strict ACL refusal at bootstrap and runtime reopening", () => {
  const p = prepareStandingCorrespondenceEmulationPolicy(raw());
  aclPaths.push(dir);
  expect(() =>
    initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "emulated" }),
  ).toThrow("acl-unqualified");
  expect(existsSync(state)).toBe(false);
  aclPaths.length = 0;
  const r = start(p);
  close(r.dispatcher);
  aclPaths.push(dir);
  expect(reopen(p)).toMatchObject({ kind: "held", holds: ["acl-unqualified"] });
  expect(recover(p)).toMatchObject({ kind: "held", holds: ["acl-unqualified"] });
  expect(query("SELECT count(*) AS n FROM invocations")).toEqual([{ n: 0 }]);
});

it("keeps the production native opener unqualified on non-Darwin hosts", () => {
  const p = prepareStandingCorrespondencePolicy(raw());
  initializeStandingCorrespondenceJournal({ prepared: p, stateFile: state, source: "live" });
  grant(p, "duty", "non-darwin-fixture", Date.now() - 1000);
  vi.stubGlobal(
    "process",
    new Proxy(realProcess, {
      get: (target, key) => (key === "platform" ? "linux" : Reflect.get(target, key)),
    }),
  );
  expect(
    openStandingCorrespondence({
      prepared: p,
      stateFile: state,
      runtimeApprovalFile: approvalPath,
      deviceId: p.policy.deviceId,
    }),
  ).toMatchObject({ kind: "held", holds: ["acl-unqualified"] });
  expect(query("SELECT count(*) AS n FROM invocations")).toEqual([{ n: 0 }]);
});
