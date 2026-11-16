import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import type { DatabaseSync as Database } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORRESPONDENCE_INSTRUCTIONS_V1,
  CORRESPONDENCE_INSTRUCTIONS_V1_SHA256,
  CORRESPONDENCE_OUTPUT_SCHEMA,
  CORRESPONDENCE_QUALIFICATION_PACKET,
  CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
  checkCorrespondenceTraceBytes,
  correspondenceCommand,
  correspondenceWatchdogArgs,
  correspondenceGrantRevision,
  correspondenceInput,
  digest,
  openCorrespondenceEmulation,
  openCorrespondenceWindow,
  parseCorrespondenceAnswer,
  parseCorrespondencePacket,
  parseDispatchRequest,
  prepareCorrespondencePlan,
  qualifyClaudeCorrespondence,
} from "../index.js";
import { checkNativeProfile } from "../supervised-files.js";
import { checkCorrespondenceQualification } from "../correspondence-qualification.js";
import type {
  CorrespondenceDispatcher,
  CorrespondenceEmulatorScript,
  CorrespondencePacket,
  PreparedCorrespondencePlan,
} from "../index.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});
vi.mock("../supervised-files.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../supervised-files.js")>();
  return { ...actual, checkNativeProfile: vi.fn(actual.checkNativeProfile) };
});
vi.mock("../correspondence-qualification.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../correspondence-qualification.js")>();
  return {
    ...actual,
    checkCorrespondenceQualification: vi.fn(actual.checkCorrespondenceQualification),
  };
});
const spawnOriginal = vi.mocked(spawnSync).getMockImplementation()!;
const qualifyOriginal = vi.mocked(checkNativeProfile).getMockImplementation()!;
const traceGateOriginal = vi.mocked(checkCorrespondenceQualification).getMockImplementation()!;
const realProcess = process;
// Vite 5 rewrites node:sqlite, so load the builtin directly, as the dispatcher does.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};

let dir: string, home: string, temporary: string;
const open: CorrespondenceDispatcher[] = [];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const THREAD = uuid(900);

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "correspondence-fixture-")));
  // Independent of the host (CI or Mac): pin HOME, TMPDIR and CODEX_HOME here and in the plan.
  home = join(dir, "home");
  temporary = join(dir, "tmp");
  mkdirSync(home, { mode: 0o700 });
  mkdirSync(temporary, { mode: 0o700 });
  vi.stubEnv("HOME", home);
  vi.stubEnv("TMPDIR", temporary);
  // A Claude-only plan requires the controller to run without CODEX_HOME.
  vi.stubEnv("CODEX_HOME", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of open.splice(0)) d.close();
  vi.unstubAllGlobals();
  vi.mocked(spawnSync).mockImplementation(spawnOriginal);
  vi.mocked(checkNativeProfile).mockImplementation(qualifyOriginal);
  vi.mocked(checkCorrespondenceQualification).mockImplementation(traceGateOriginal);
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function packet(
  n: number,
  extra: Partial<CorrespondencePacket> = {},
  thread = THREAD,
): CorrespondencePacket {
  return {
    kind: "correspondence-packet",
    version: 1,
    duty: { device_id: "yuri", session_id: "yuri-claude-duty" },
    request: {
      message_id: uuid(n),
      thread_id: thread,
      sequence: n,
      subject: "Soak",
      sender: { device_id: "yojimbo", session_id: "claude-953561e4" },
      body: "What did the charter decide about Codex?",
    },
    thread: [],
    omitted: { earlier_messages: 0, truncated_bodies: 0 },
    context_round: { used: 0, limit: 3 },
    best_effort: false,
    ...extra,
  };
}

function binary(name = "claude-fixture", program = "process.exit(3)") {
  const js = join(dir, name + ".cjs"),
    bin = join(dir, name);
  writeFileSync(js, program);
  writeFileSync(bin, `#!/bin/sh\nexec '${process.execPath}' '${js}' "$@"\n`, { mode: 0o700 });
  return { bin, sha: createHash("sha256").update(readFileSync(bin)).digest("hex") };
}

function rawPlan(overrides: Record<string, unknown> = {}, bin = binary()) {
  const cwd = join(dir, "empty-claude");
  mkdirSync(cwd, { recursive: true, mode: 0o700 });
  return {
    schemaVersion: 1,
    kind: "correspondence",
    revision: "plan-1",
    windowId: "window-1",
    deviceId: "yuri",
    profiles: [
      {
        provider: "claude-code",
        revision: "claude-1",
        binaryRealPath: bin.bin,
        binarySHA256: bin.sha,
        nativeVersion: "2.1.286",
        model: "claude-model",
        effort: "low",
        authMode: "existing-subscription",
        customizationPolicy: "none",
      },
    ],
    bindings: [
      {
        alias: "yuri-claude-duty",
        revision: "binding-1",
        deviceId: "yuri",
        provider: "claude-code",
        profileRevision: "claude-1",
        sessionPolicy: "fresh-per-dispatch",
        cwd,
        resources: [`helpdesk:thread:${THREAD}`],
      },
    ],
    limits: { topLevelTurns: 40, windowMs: 5400000, requestTimeoutMs: 120000 },
    supervision: { kind: "owner-attended" },
    environment: { HOME: home, CODEX_HOME: null, TMPDIR: temporary },
    declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
    ...overrides,
  };
}

function request(prepared: PreparedCorrespondencePlan, n: number, p = packet(n), delivery = n) {
  const input = JSON.stringify(p);
  return {
    deliveryId: `delivery-${delivery}`,
    streamId: uuid(800),
    eventId: uuid(1000 + n),
    messageId: p.request.message_id,
    threadId: p.request.thread_id,
    sequence: p.request.sequence,
    recipient: "yuri-claude-duty",
    bindingRevision: "binding-1",
    charterId: "window-1",
    grantRevision: correspondenceGrantRevision(prepared, "yuri-claude-duty"),
    profileRevision: "claude-1",
    workflow: "correspondence",
    resources: [`helpdesk:thread:${p.request.thread_id}`],
    task: { input, inputDigest: digest(input) },
  };
}

const reply = (packetDigest: string) => ({
  packetDigest,
  decision: "reply",
  reason: null,
  text: "The charter keeps Codex revoked.",
  needs: null,
  gaps: null,
});

function emulate(script: CorrespondenceEmulatorScript, rawOverrides = {}, now = () => 1000) {
  const prepared = prepareCorrespondencePlan(rawPlan(rawOverrides));
  const run = openCorrespondenceEmulation({
    prepared,
    stateFile: join(dir, "state.sqlite"),
    script,
    now,
  });
  open.push(run.dispatcher);
  return { prepared, ...run };
}

describe("protocol", () => {
  it("pins the instruction text and the closed answer schema", () => {
    expect(createHash("sha256").update(CORRESPONDENCE_INSTRUCTIONS_V1).digest("hex")).toBe(
      CORRESPONDENCE_INSTRUCTIONS_V1_SHA256,
    );
    expect(CORRESPONDENCE_OUTPUT_SCHEMA.required).toEqual([
      "packetDigest",
      "decision",
      "reason",
      "text",
      "needs",
      "gaps",
    ]);
    expect(CORRESPONDENCE_OUTPUT_SCHEMA.additionalProperties).toBe(false);
  });

  it("puts the packet last and verbatim, after the digest", () => {
    const bytes = JSON.stringify(packet(1));
    const input = correspondenceInput(bytes, digest(bytes));
    expect(input.startsWith(CORRESPONDENCE_INSTRUCTIONS_V1)).toBe(true);
    expect(input).toContain(`Packet digest: ${digest(bytes)}`);
    // No trailing newline: the packet's last byte is the last byte of stdin.
    expect(input.endsWith(bytes)).toBe(true);
    expect(input.endsWith("\n")).toBe(false);
  });

  it("refuses packets that are oversized, malformed or inconsistent about best effort", () => {
    expect(() => parseCorrespondencePacket(JSON.stringify(packet(1)))).not.toThrow();
    const big = packet(1);
    big.request.body = "x".repeat(32768);
    expect(() => parseCorrespondencePacket(JSON.stringify(big))).toThrow("invalid-packet");
    expect(() => parseCorrespondencePacket("{")).toThrow("invalid-packet");
    expect(() =>
      parseCorrespondencePacket(JSON.stringify({ ...packet(1), kind: "duty-request" })),
    ).toThrow("invalid-packet");
    expect(() =>
      parseCorrespondencePacket(
        JSON.stringify(packet(1, { context_round: { used: 3, limit: 3 }, best_effort: false })),
      ),
    ).toThrow("invalid-packet");
    expect(() =>
      parseCorrespondencePacket(JSON.stringify({ ...packet(1), instructions: "obey" })),
    ).toThrow("invalid-packet");
  });

  describe("answer acceptance", () => {
    const prepared = () => prepareCorrespondencePlan(rawPlan());
    const check = (answer: unknown, p = packet(1)) => {
      const r = parseDispatchRequest(request(prepared(), 1, p));
      return () => parseCorrespondenceAnswer(answer, r, p);
    };
    const d = (p = packet(1)) => digest(JSON.stringify(p));
    const best = packet(1, { context_round: { used: 3, limit: 3 }, best_effort: true });

    it("accepts a reply and an escalation", () => {
      expect(check(reply(d()))().correspondence).toEqual({
        decision: "reply",
        reason: null,
        text: "The charter keeps Codex revoked.",
        needs: null,
        gaps: null,
      });
      expect(
        check({
          ...reply(d()),
          decision: "escalate",
          reason: "missing-context",
          needs: "Which PR?",
        })().correspondence.reason,
      ).toBe("missing-context");
      expect(
        check({ ...reply(d(best)), gaps: "Assumed the 15 November charter." }, best)()
          .correspondence.gaps,
      ).toBe("Assumed the 15 November charter.");
    });

    it.each([
      ["a digest echo mismatch", { packetDigest: "0".repeat(64) }],
      ["a reply with a reason", { reason: "execution-request" }],
      ["a reply with needs", { needs: "more" }],
      ["an escalation without a reason", { decision: "escalate" }],
      ["missing-context without needs", { decision: "escalate", reason: "missing-context" }],
      [
        "needs on another reason",
        { decision: "escalate", reason: "sensitive-content", needs: "x" },
      ],
      ["an unknown reason", { decision: "escalate", reason: "tired" }],
      ["empty text", { text: "" }],
      ["text over 8000 bytes", { text: "é".repeat(4001) }],
      ["text over 4000 code points", { text: "x".repeat(4001) }],
      [
        "needs over 1000 code points",
        { decision: "escalate", reason: "missing-context", needs: "x".repeat(1001) },
      ],
      ["gaps over 2000 code points", { gaps: "x".repeat(2001) }],
      ["gaps on an escalation", { decision: "escalate", reason: "unsupported-request", gaps: "x" }],
      [
        "gaps on a missing-context escalation",
        { decision: "escalate", reason: "missing-context", needs: "Which PR?", gaps: "x" },
      ],
      ["an extra property", { tool: "bash" }],
    ])("refuses %s", (_, change) => {
      expect(check({ ...reply(d()), ...change })).toThrow("invalid-agent-proposal");
    });

    it("counts text, needs and gaps in code points, as the schema's maxLength does", () => {
      // Astral characters are two UTF-16 units each: these exceed the old .length counts.
      const smile = "\u{1F600}";
      expect(
        check({ ...reply(d()), text: smile.repeat(1999) + "abc" })().correspondence.text,
      ).toHaveLength(4001);
      expect(
        check({
          ...reply(d()),
          decision: "escalate",
          reason: "missing-context",
          needs: smile.repeat(1000),
        })().correspondence.needs,
      ).toHaveLength(2000);
      expect(
        check({ ...reply(d(best)), gaps: smile.repeat(2000) }, best)().correspondence.gaps,
      ).toHaveLength(4000);
      // The byte limits still apply: 2001 astral characters are 8004 bytes.
      expect(check({ ...reply(d()), text: smile.repeat(2001) })).toThrow("invalid-agent-proposal");
    });

    it("refuses missing-context once best effort is on", () => {
      expect(
        check(
          { ...reply(d(best)), decision: "escalate", reason: "missing-context", needs: "more" },
          best,
        ),
      ).toThrow("invalid-agent-proposal");
    });
  });
});

describe("plan", () => {
  it("accepts a Claude-only plan at the soak limits", () => {
    const prepared = prepareCorrespondencePlan(rawPlan());
    expect(prepared.mode).toBe("correspondence-prepared");
    expect(prepared.liveEligible).toBe(false);
    expect(prepared.plan.limits).toEqual({
      topLevelTurns: 40,
      windowMs: 5400000,
      requestTimeoutMs: 120000,
    });
    expect(prepared.planDigest).toBe(digest(JSON.stringify(prepared.plan)));
  });

  it("refuses any Codex profile or binding as revoked", () => {
    const plan = rawPlan();
    const codex = { ...plan.profiles[0], provider: "codex", revision: "codex-1" };
    expect(() => prepareCorrespondencePlan({ ...plan, profiles: [codex] })).toThrow(
      "revoked-provider",
    );
    expect(() =>
      prepareCorrespondencePlan({
        ...plan,
        profiles: [...plan.profiles, codex],
        bindings: [...plan.bindings, { ...plan.bindings[0], alias: "c", provider: "codex" }],
      }),
    ).toThrow("revoked-provider");
  });

  it("refuses two bindings for one provider", () => {
    const plan = rawPlan();
    expect(() =>
      prepareCorrespondencePlan({
        ...plan,
        profiles: [plan.profiles[0], { ...plan.profiles[0], revision: "claude-2" }],
        bindings: [plan.bindings[0], { ...plan.bindings[0], alias: "second" }],
      }),
    ).toThrow("ambiguous-correspondence-plan");
  });

  it.each([
    ["zero turns", { limits: { topLevelTurns: 0, windowMs: 5400000, requestTimeoutMs: 120000 } }],
    ["41 turns", { limits: { topLevelTurns: 41, windowMs: 5400000, requestTimeoutMs: 120000 } }],
    [
      "a window over 90 minutes",
      { limits: { topLevelTurns: 1, windowMs: 5400001, requestTimeoutMs: 120000 } },
    ],
    ["another timeout", { limits: { topLevelTurns: 1, windowMs: 60000, requestTimeoutMs: 60000 } }],
    [
      "Codex risk acceptance",
      { supervision: { kind: "owner-attended", codexHostFileReadRiskAccepted: true } },
    ],
    ["unattended supervision", { supervision: { kind: "unattended" } }],
    ["a CODEX_HOME", { environment: { HOME: "/tmp", CODEX_HOME: "/tmp", TMPDIR: null } }],
    ["no schema kind", { kind: "advisory-review" }],
  ])("refuses %s", (_, change) => {
    expect(() => prepareCorrespondencePlan(rawPlan(change))).toThrow("invalid-correspondence-plan");
  });

  it("accepts explicit thread resources or exactly the one wildcard, and nothing more general", () => {
    const plan = rawPlan();
    const withResources = (resources: string[]) =>
      prepareCorrespondencePlan({ ...plan, bindings: [{ ...plan.bindings[0], resources }] });
    expect(withResources(["helpdesk:thread:*"]).plan.bindings[0].resources).toEqual([
      "helpdesk:thread:*",
    ]);
    for (const resources of [
      ["helpdesk:thread:abc*"],
      ["helpdesk:*"],
      ["*"],
      ["helpdesk:thread:"],
      ["helpdesk:message:x"],
    ])
      expect(() => withResources(resources)).toThrow("invalid-correspondence-plan");
  });

  it("refuses a fixed session policy", () => {
    const plan = rawPlan();
    expect(() =>
      prepareCorrespondencePlan({
        ...plan,
        bindings: [{ ...plan.bindings[0], sessionPolicy: "existing-fixed" }],
      }),
    ).toThrow("invalid-correspondence-plan");
  });
});

describe("emulated correspondence through the real dispatcher and journal", () => {
  it("replies, with a fresh native session for every dispatch and no provider calls", async () => {
    const sessions: string[] = [];
    const { prepared, dispatcher, invocations } = emulate((_, turn) => {
      sessions.push(turn.nativeSessionId);
      return { kind: "answer", answer: reply(turn.packetDigest) };
    });
    const first = await dispatcher.dispatch(request(prepared, 1));
    const second = await dispatcher.dispatch(request(prepared, 2));
    expect(first).toMatchObject({ kind: "observed", outcome: "completed" });
    expect(second).toMatchObject({ kind: "observed", outcome: "completed" });
    expect(new Set(sessions).size).toBe(2);
    expect(sessions.every((s) => /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s))).toBe(true);
    expect(first.kind === "observed" && first.nativeSessionId).toBe(sessions[0]);
    expect(dispatcher.agentProposal("delivery-1")).toEqual({
      attribution: "device-relayed-output",
      source: "deterministic-emulator",
      verifiedWork: false,
      correspondence: {
        decision: "reply",
        reason: null,
        text: "The charter keeps Codex revoked.",
        needs: null,
        gaps: null,
      },
    });
    expect(dispatcher.status()).toMatchObject({ mode: "mechanical", realProviderCalls: 0 });
    expect(invocations()).toBe(2);
  });

  it("answers an exact duplicate from the journal without a second turn", async () => {
    const { prepared, dispatcher, invocations } = emulate((_, t) => ({
      kind: "answer",
      answer: reply(t.packetDigest),
    }));
    const a = await dispatcher.dispatch(request(prepared, 1));
    const b = await dispatcher.dispatch(request(prepared, 1));
    expect(b).toEqual(a);
    expect(invocations()).toBe(1);
    const changed = request(prepared, 1, packet(1, { thread: [] }), 1);
    changed.eventId = uuid(4242);
    expect(await dispatcher.dispatch(changed)).toEqual({
      kind: "refused",
      reason: "delivery-conflict",
    });
  });

  it("completes with no proposal when the digest echo is wrong", async () => {
    const { prepared, dispatcher } = emulate(() => ({
      kind: "answer",
      answer: reply("0".repeat(64)),
    }));
    expect(await dispatcher.dispatch(request(prepared, 1))).toMatchObject({
      kind: "observed",
      outcome: "completed",
    });
    expect(dispatcher.agentProposal("delivery-1")).toBeUndefined();
  });

  it("holds one budget for the window", async () => {
    const { prepared, dispatcher } = emulate(
      (_, t) => ({ kind: "answer", answer: reply(t.packetDigest) }),
      { limits: { topLevelTurns: 2, windowMs: 60000, requestTimeoutMs: 120000 } },
    );
    await dispatcher.dispatch(request(prepared, 1));
    await dispatcher.dispatch(request(prepared, 2));
    expect(await dispatcher.dispatch(request(prepared, 3))).toEqual({
      kind: "refused",
      reason: "budget-exhausted",
    });
  });

  it("refuses after the window ends", async () => {
    let now = 1000;
    const { prepared, dispatcher } = emulate(
      (_, t) => ({ kind: "answer", answer: reply(t.packetDigest) }),
      { limits: { topLevelTurns: 2, windowMs: 60000, requestTimeoutMs: 120000 } },
      () => now,
    );
    now = 1000 + 60000;
    expect(await dispatcher.dispatch(request(prepared, 1))).toEqual({
      kind: "refused",
      reason: "expired",
    });
  });

  it("records a lost turn as unknown with its minted session, and never reruns it after a restart", async () => {
    const first = emulate(() => ({ kind: "lost" }));
    const lost = await first.dispatcher.dispatch(request(first.prepared, 1));
    expect(lost).toMatchObject({ kind: "unknown", reason: "invocation-unresolved" });
    const session = lost.kind === "unknown" ? lost.nativeSessionId : "";
    expect(session).toMatch(/^[a-f0-9]{8}-/);
    first.dispatcher.close();
    open.splice(0);
    const again = emulate((_, t) => ({ kind: "answer", answer: reply(t.packetDigest) }));
    expect(again.dispatcher.lookup("delivery-1")).toEqual(lost);
    expect(await again.dispatcher.dispatch(request(again.prepared, 1))).toEqual(lost);
    expect(again.invocations()).toBe(0);
  });

  it("serves any thread with the helpdesk:thread:* wildcard", async () => {
    const plan = rawPlan();
    const prepared = prepareCorrespondencePlan({
      ...plan,
      bindings: [{ ...plan.bindings[0], resources: ["helpdesk:thread:*"] }],
    });
    const run = openCorrespondenceEmulation({
      prepared,
      stateFile: join(dir, "state.sqlite"),
      script: (_, t) => ({ kind: "answer", answer: reply(t.packetDigest) }),
      now: () => 1000,
    });
    open.push(run.dispatcher);
    for (const [n, thread] of [
      [1, THREAD],
      [2, uuid(901)],
    ] as const)
      expect(
        await run.dispatcher.dispatch(request(prepared, n, packet(n, {}, thread))),
      ).toMatchObject({ kind: "observed", outcome: "completed" });
  });

  it("serves only the named threads with explicit resources", async () => {
    const { prepared, dispatcher, invocations } = emulate((_, t) => ({
      kind: "answer",
      answer: reply(t.packetDigest),
    }));
    expect(await dispatcher.dispatch(request(prepared, 1))).toMatchObject({ kind: "observed" });
    expect(await dispatcher.dispatch(request(prepared, 2, packet(2, {}, uuid(901))))).toEqual({
      kind: "refused",
      reason: "resource-denied",
    });
    expect(invocations()).toBe(1);
  });

  it("requires a request to name exactly its own thread resource", async () => {
    const { prepared, dispatcher, invocations } = emulate(() => ({ kind: "failed" }));
    const r = request(prepared, 1);
    for (const resources of [
      [],
      [`helpdesk:thread:${uuid(901)}`],
      [...r.resources, ...r.resources],
    ])
      expect(await dispatcher.dispatch({ ...r, resources })).toEqual({
        kind: "refused",
        reason: "invalid-request",
      });
    expect(invocations()).toBe(0);
  });

  it("checks the full packet grammar at admission, reserving and journaling nothing", async () => {
    const { prepared, dispatcher, invocations } = emulate(() => ({ kind: "failed" }));
    const bad = packet(1);
    bad.request.sender = { device_id: "yojimbo", session_id: "Not A Session" };
    expect(await dispatcher.dispatch(request(prepared, 1, bad))).toEqual({
      kind: "refused",
      reason: "invalid-request",
    });
    expect(dispatcher.lookup("delivery-1")).toBeUndefined();
    expect(dispatcher.status()).toMatchObject({ reservations: 0, unknown: 0, active: 0 });
    // The controller is free: the next valid packet runs.
    expect(await dispatcher.dispatch(request(prepared, 2))).toMatchObject({ kind: "observed" });
    expect(invocations()).toBe(1);
  });

  it("holds the window busy after a lost turn until the owner reconciles it, without a refund", async () => {
    const steps: Array<"lost" | "answer"> = ["lost", "answer"];
    const { prepared, dispatcher, invocations } = emulate((_, t) =>
      steps.shift() === "lost"
        ? { kind: "lost" }
        : { kind: "answer", answer: reply(t.packetDigest) },
    );
    const lost = await dispatcher.dispatch(request(prepared, 1));
    if (lost.kind !== "unknown") throw Error("expected an unknown turn");
    expect(await dispatcher.dispatch(request(prepared, 2))).toEqual({
      kind: "busy",
      reason: "session-busy",
      dispatchId: lost.dispatchId,
    });
    expect(() =>
      dispatcher.reconcile({
        dispatchId: lost.dispatchId,
        nativeSessionId: uuid(5),
        nativeTurnId: null,
        outcome: "interrupted",
      }),
    ).toThrow("evidence-mismatch");
    expect(
      dispatcher.reconcile({
        dispatchId: lost.dispatchId,
        nativeSessionId: lost.nativeSessionId,
        nativeTurnId: lost.nativeTurnId,
        outcome: "interrupted",
      }),
    ).toMatchObject({ kind: "observed", outcome: "interrupted" });
    expect(dispatcher.agentProposal("delivery-1")).toBeUndefined();
    expect(await dispatcher.dispatch(request(prepared, 2))).toMatchObject({ kind: "observed" });
    expect(dispatcher.status()).toMatchObject({ unknown: 0, reservations: 2 });
    expect(invocations()).toBe(2);
  });

  it("marks its journal as emulated and refuses an unmarked journal that holds rows", async () => {
    const first = emulate(() => ({ kind: "failed" }));
    await first.dispatcher.dispatch(request(first.prepared, 1));
    first.dispatcher.close();
    open.splice(0);
    const db = new DatabaseSync(join(dir, "state.sqlite"));
    expect(db.prepare("SELECT source FROM journal_source").all()).toEqual([{ source: "emulated" }]);
    db.exec("DELETE FROM journal_source");
    db.close();
    expect(() => emulate(() => ({ kind: "failed" }))).toThrow("journal-source-mismatch");
  });

  it("refuses requests whose packet does not match the delivery, or advisory requests", async () => {
    const { prepared, dispatcher, invocations } = emulate(() => ({ kind: "failed" }));
    const r = request(prepared, 1);
    expect(await dispatcher.dispatch({ ...r, sequence: 2 })).toEqual({
      kind: "refused",
      reason: "invalid-request",
    });
    expect(await dispatcher.dispatch({ ...r, workflow: "advisory-review" })).toEqual({
      kind: "refused",
      reason: "invalid-request",
    });
    expect(
      await dispatcher.dispatch({ ...r, task: { ...r.task, inputDigest: "0".repeat(64) } }),
    ).toEqual({
      kind: "refused",
      reason: "invalid-request",
    });
    expect(invocations()).toBe(0);
  });
});

describe("owner window", () => {
  const options = (prepared: PreparedCorrespondencePlan) => ({
    prepared,
    stateFile: join(dir, "state.sqlite"),
    runtimeApprovalFile: join(dir, "approval.json"),
    deviceId: "yuri",
  });
  const approve = (o: ReturnType<typeof options>, lengthMs = o.prepared.plan.limits.windowMs) =>
    writeFileSync(
      o.runtimeApprovalFile,
      JSON.stringify({
        kind: "owner-approved-correspondence-window",
        planDigest: o.prepared.planDigest,
        windowId: "window-1",
        deviceId: "yuri",
        invocationStateFile: o.stateFile,
        startsAtMs: 1000,
        expiresAtMs: 1000 + lengthMs,
        ownerNativeApprovalRef: "yuri-chat:2026-11-15",
      }),
      { mode: 0o600 },
    );

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1001);
    // The private-file checks are qualified for macOS only; simulate it on any host, as the
    // supervised suite does, so these tests assert the same holds on CI's Linux runner.
    vi.stubGlobal(
      "process",
      new Proxy(realProcess, {
        get: (t, k) => (k === "platform" ? "darwin" : Reflect.get(t, k)),
      }),
    );
    vi.mocked(spawnSync).mockImplementation((file, args, opts) => {
      if (file === "/bin/ls")
        return {
          pid: 0,
          output: [],
          status: 0,
          signal: null,
          stdout: "drwx------ 1 f\n",
          stderr: "",
        };
      return spawnOriginal(file, args, opts);
    });
  });

  it("holds without an approval, and with an approval of the wrong length", () => {
    const o = options(prepareCorrespondencePlan(rawPlan()));
    expect(openCorrespondenceWindow(o)).toEqual({
      kind: "held",
      planDigest: o.prepared.planDigest,
      holds: ["runtime-approval-missing"],
    });
    approve(o, 1800000);
    expect(openCorrespondenceWindow(o)).toEqual({
      kind: "held",
      planDigest: o.prepared.planDigest,
      holds: ["runtime-approval-invalid"],
    });
  });

  it("refuses a canary approval kind", () => {
    const o = options(prepareCorrespondencePlan(rawPlan()));
    approve(o);
    const approval = JSON.parse(readFileSync(o.runtimeApprovalFile, "utf8"));
    writeFileSync(
      o.runtimeApprovalFile,
      JSON.stringify({ ...approval, kind: "owner-approved-supervised-canary" }),
      { mode: 0o600 },
    );
    expect(openCorrespondenceWindow(o)).toEqual({
      kind: "held",
      planDigest: o.prepared.planDigest,
      holds: ["runtime-approval-invalid"],
    });
  });

  it("builds a fresh-session Claude command whose only tool is the output tool", () => {
    const args = correspondenceCommand(
      { provider: "claude-code" },
      { provider: "claude-code", model: "m" },
      uuid(7),
    );
    expect(args.slice(0, 3)).toEqual(["--print", "--session-id", uuid(7)]);
    expect(args).not.toContain("--resume");
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args[args.indexOf("--json-schema") + 1]).toBe(
      JSON.stringify(CORRESPONDENCE_OUTPUT_SCHEMA),
    );
    expect(() =>
      correspondenceCommand({ provider: "codex" }, { provider: "codex", model: "m" }, uuid(7)),
    ).toThrow("revoked-provider");
  });

  describe("with a synthetic Claude binary", () => {
    type Behavior =
      | "reply"
      | "tool"
      | "tools-offered"
      | "no-tools"
      | "mcp"
      | "second-call"
      | "input-differs"
      | "no-call"
      | "no-output"
      | "text-only"
      | "hang";
    // No provider SDK, network or credentials: a local script that speaks Claude's stream-json the
    // way 2.1.308's --json-schema does: one StructuredOutput call whose input is structured_output.
    const fake = (behavior: Behavior) => `
const fs=require('node:fs'),cp=require('node:child_process');
const args=process.argv.slice(2), behavior=${JSON.stringify(behavior)};
let data='';process.stdin.on('data',x=>data+=x);process.stdin.on('end',()=>{
  fs.appendFileSync(${JSON.stringify(join(dir, "launches"))}, JSON.stringify(args)+'\\n');
  fs.writeFileSync(${JSON.stringify(join(dir, "stdin"))}, data);
  fs.writeFileSync(${JSON.stringify(join(dir, "child"))}, JSON.stringify({pid:process.pid,
    pgid:cp.execFileSync('ps',['-o','pgid=','-p',String(process.pid)],{encoding:'utf8'}).trim(),
    TMPDIR:process.env.TMPDIR}));
  const s=args[args.indexOf('--session-id')+1];
  const d=/Packet digest: ([a-f0-9]{64})/.exec(data)[1];
  const emit=m=>console.log(JSON.stringify(m));
  const answer={packetDigest:d,decision:'reply',reason:null,text:'Received.',needs:null,gaps:null};
  const tools=behavior==='tools-offered'?['StructuredOutput','Bash']:behavior==='no-tools'?[]:['StructuredOutput'];
  emit({type:'system',subtype:'init',session_id:s,model:args[args.indexOf('--model')+1],tools,
    mcp_servers:behavior==='mcp'?[{name:'x',status:'connected'}]:[],slash_commands:[],agents:[],skills:[],plugins:[]});
  if(behavior==='hang'){setInterval(()=>{},1000);return;}
  const call={type:'tool_use',id:'toolu_1',name:behavior==='tool'?'Bash':'StructuredOutput',
    input:behavior==='input-differs'?{...answer,text:'Other.'}:answer};
  if(behavior==='text-only') emit({type:'assistant',session_id:s,message:{content:[{type:'text',text:'Received.'}]}});
  else if(behavior!=='no-call') emit({type:'assistant',session_id:s,message:{content:behavior==='second-call'?[call,call]:[call]}});
  if(behavior!=='no-call'&&behavior!=='text-only') emit({type:'user',session_id:s,message:{content:[{type:'tool_result',tool_use_id:'toolu_1',content:'ok'}]}});
  emit({type:'result',subtype:'success',session_id:s,is_error:false,
    ...(behavior==='no-output'||behavior==='text-only'?{}:{structured_output:answer})});
});`;
    function ready(behavior: Behavior, overrides: Record<string, unknown> = {}) {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      // The synthetic binary has no committed trace; the trace gate has its own tests.
      vi.mocked(checkCorrespondenceQualification).mockImplementation(() => {});
      const o = options(
        prepareCorrespondencePlan(rawPlan(overrides, binary("claude-fixture", fake(behavior)))),
      );
      approve(o);
      const opened = openCorrespondenceWindow(o);
      if (opened.kind !== "ready") throw Error("not ready: " + JSON.stringify(opened));
      open.push(opened.dispatcher);
      return { o, dispatcher: opened.dispatcher };
    }

    it("runs a supervised turn on a new session and accepts the checked proposal", async () => {
      const { o, dispatcher } = ready("reply");
      const r = request(o.prepared, 1);
      const result = await dispatcher.dispatch(r);
      expect(result).toMatchObject({ kind: "observed", outcome: "completed" });
      const args = JSON.parse(readFileSync(join(dir, "launches"), "utf8").trim());
      expect(args[1]).toBe("--session-id");
      expect(result.kind === "observed" && result.nativeSessionId).toBe(args[2]);
      // The packet's last byte is stdin's last byte.
      const stdin = readFileSync(join(dir, "stdin"), "utf8");
      expect(stdin.endsWith(r.task.input)).toBe(true);
      expect(stdin).toBe(correspondenceInput(r.task.input, r.task.inputDigest));
      expect(dispatcher.agentProposal("delivery-1")?.source).toBe("supervised-native");
      expect(dispatcher.turnRefusal("delivery-1")).toBeUndefined();
      expect(dispatcher.status()).toMatchObject({ mode: "supervised", realProviderCalls: null });
    });

    it("refuses a pinned version without a committed trace", () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      for (const nativeVersion of ["2.1.286", "2.1.308"]) {
        const bin = binary("claude-fixture", fake("reply"));
        const plan = rawPlan({}, bin);
        const o = options(
          prepareCorrespondencePlan({
            ...plan,
            profiles: [{ ...plan.profiles[0], nativeVersion }],
          }),
        );
        approve(o);
        expect(openCorrespondenceWindow(o)).toEqual({
          kind: "held",
          planDigest: o.prepared.planDigest,
          holds: ["native-profile-unqualified"],
        });
      }
      expect(existsSync(join(dir, "launches"))).toBe(false);
    });

    it.each([
      ["calls another tool", "tool", "tool-name-mismatch"],
      ["is offered an extra tool", "tools-offered", "init-tools-mismatch"],
      ["is offered no output tool", "no-tools", "init-tools-mismatch"],
      ["is offered an MCP server", "mcp", "init-surface-not-empty"],
      ["calls the output tool twice", "second-call", "tool-second-call"],
      ["calls it with input that differs from the output", "input-differs", "tool-input-mismatch"],
      ["returns structured_output with no call", "no-call", "output-without-tool-call"],
      ["calls it with no structured_output", "no-output", "tool-call-without-output"],
      ["answers in text with no call", "text-only", "no-tool-call"],
    ] as const)(
      "treats a turn that %s as unknown, with no proposal and its reason journaled",
      async (_, behavior, reason) => {
        const { o, dispatcher } = ready(behavior);
        expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
          kind: "unknown",
        });
        expect(dispatcher.agentProposal("delivery-1")).toBeUndefined();
        expect(dispatcher.turnRefusal("delivery-1")).toBe(reason);
        // The unresolved turn keeps the window's controller.
        expect(await dispatcher.dispatch(request(o.prepared, 2))).toMatchObject({ kind: "busy" });
      },
    );

    it("keeps Claude in the controller's process group, never detached", async () => {
      const { o, dispatcher } = ready("reply");
      await dispatcher.dispatch(request(o.prepared, 1));
      const child = JSON.parse(readFileSync(join(dir, "child"), "utf8"));
      const own = execFileSync("ps", ["-o", "pgid=", "-p", String(realProcess.pid)], {
        encoding: "utf8",
      }).trim();
      expect(child.pgid).toBe(own);
    });

    it("pins TMPDIR from the plan for the child instead of comparing it with the controller's", async () => {
      const pinned = join(dir, "pinned-tmp");
      mkdirSync(pinned, { mode: 0o700 });
      const { o, dispatcher } = ready("reply", {
        environment: { HOME: home, CODEX_HOME: null, TMPDIR: pinned },
      });
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
        kind: "observed",
      });
      expect(JSON.parse(readFileSync(join(dir, "child"), "utf8")).TMPDIR).toBe(pinned);
    });

    it("holds a pinned TMPDIR that is missing or writable by others, and a different HOME", () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      vi.mocked(checkCorrespondenceQualification).mockImplementation(() => {});
      const shared = join(dir, "shared-tmp");
      mkdirSync(shared, { mode: 0o777 });
      execFileSync("chmod", ["777", shared]);
      for (const environment of [
        { HOME: home, CODEX_HOME: null, TMPDIR: join(dir, "missing") },
        { HOME: home, CODEX_HOME: null, TMPDIR: shared },
        { HOME: join(dir, "other-home"), CODEX_HOME: null, TMPDIR: temporary },
      ]) {
        const o = options(prepareCorrespondencePlan(rawPlan({ environment })));
        approve(o);
        expect(openCorrespondenceWindow(o)).toEqual({
          kind: "held",
          planDigest: o.prepared.planDigest,
          holds: ["environment-mismatch"],
        });
      }
    });

    it("never opens a live window on an emulated journal, or the other way round", async () => {
      const emulated = emulate(() => ({ kind: "failed" }));
      emulated.dispatcher.close();
      open.splice(0);
      expect(() => ready("reply")).toThrow("journal-source-mismatch");
      rmSync(join(dir, "state.sqlite"));
      const live = ready("reply");
      live.dispatcher.close();
      open.splice(0);
      expect(() => emulate(() => ({ kind: "failed" }))).toThrow("journal-source-mismatch");
    });

    describe("qualification", () => {
      function prepared(behavior: Behavior, nativeVersion = "2.1.308") {
        vi.mocked(checkNativeProfile).mockImplementation(() => {});
        const plan = rawPlan({}, binary("claude-fixture", fake(behavior)));
        const o = options(
          prepareCorrespondencePlan({
            ...plan,
            profiles: [{ ...plan.profiles[0], nativeVersion }],
          }),
        );
        return o;
      }

      it("refuses to run without a valid approval, and writes nothing", async () => {
        const o = prepared("reply");
        expect(
          await qualifyClaudeCorrespondence({
            prepared: o.prepared,
            runtimeApprovalFile: o.runtimeApprovalFile,
            deviceId: "yuri",
          }),
        ).toEqual({
          kind: "held",
          planDigest: o.prepared.planDigest,
          holds: ["runtime-approval-missing"],
        });
        approve(o, 1800000);
        expect(
          await qualifyClaudeCorrespondence({
            prepared: o.prepared,
            runtimeApprovalFile: o.runtimeApprovalFile,
            deviceId: "yuri",
          }),
        ).toMatchObject({ kind: "held", holds: ["runtime-approval-invalid"] });
        expect(existsSync(join(dir, "launches"))).toBe(false);
        expect(existsSync(o.stateFile)).toBe(false);
      });

      it("records exactly one turn on the fixed packet, bypassing only the trace gate", async () => {
        const o = prepared("reply");
        approve(o);
        const approvalBefore = readFileSync(o.runtimeApprovalFile, "utf8");
        // A duty window on this unqualified version is held...
        expect(openCorrespondenceWindow(o)).toMatchObject({
          kind: "held",
          holds: ["native-profile-unqualified"],
        });
        // ...while qualification records its one fixed-packet turn.
        const result = await qualifyClaudeCorrespondence({
          prepared: o.prepared,
          runtimeApprovalFile: o.runtimeApprovalFile,
          deviceId: "yuri",
        });
        if (result.kind !== "ran") throw Error("not run: " + JSON.stringify(result));
        expect(result.verdict).toBe("accepted");
        expect(result.turnRefusal).toBeUndefined();
        expect(result.replayRefusal).toBeUndefined();
        expect(result.nativeVersion).toBe("2.1.308");
        expect(result.disposition).toMatchObject({ kind: "observed", outcome: "completed" });
        expect(result.traceSHA256).toBe(digest(result.traceText));
        expect(checkCorrespondenceTraceBytes(result.traceText)).toBeUndefined();
        expect(result.traceText).not.toContain(
          result.disposition.kind === "observed" ? result.disposition.nativeSessionId : "-",
        );
        expect(readFileSync(join(dir, "launches"), "utf8").trim().split("\n")).toHaveLength(1);
        expect(readFileSync(join(dir, "stdin"), "utf8")).toBe(
          correspondenceInput(
            CORRESPONDENCE_QUALIFICATION_PACKET,
            CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
          ),
        );
        expect(readFileSync(o.runtimeApprovalFile, "utf8")).toBe(approvalBefore);
      });

      it("reports a refused trace with the checker's reason", async () => {
        const o = prepared("second-call");
        approve(o);
        const result = await qualifyClaudeCorrespondence({
          prepared: o.prepared,
          runtimeApprovalFile: o.runtimeApprovalFile,
          deviceId: "yuri",
        });
        expect(result).toMatchObject({
          kind: "ran",
          turnRefusal: "tool-second-call",
          replayRefusal: "tool-second-call",
          verdict: { refused: "tool-second-call" },
        });
      });
    });
  });

  describe("watchdog", () => {
    const sleeper = () => {
      const pidFile = join(dir, "sleeper.pid");
      const { bin } = binary(
        "sleeper",
        `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(()=>{},1000);`,
      );
      return { bin, pidFile };
    };
    const alive = (pid: number) => {
      try {
        realProcess.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const until = async (ok: () => boolean, ms = 5000) => {
      const end = realProcess.hrtime.bigint() + BigInt(ms) * 1000000n;
      while (!ok()) {
        if (realProcess.hrtime.bigint() > end) throw Error("watchdog fixture deadline");
        await new Promise((r) => setTimeout(r, 20));
      }
    };

    it("kills the child at its wall-clock deadline", async () => {
      const { bin, pidFile } = sleeper();
      const watchdog = spawn(realProcess.execPath, correspondenceWatchdogArgs(400, bin, []), {
        stdio: ["pipe", "ignore", "ignore"],
      });
      const code = await new Promise<number | null>((r) => watchdog.once("exit", r));
      expect(code).toBe(124);
      const pid = Number(readFileSync(pidFile, "utf8"));
      await until(() => !alive(pid));
    });

    it("kills the child when its controller dies without cleaning up", async () => {
      const { bin, pidFile } = sleeper();
      // A throwaway controller starts the watchdog, waits for the child, then SIGKILLs itself.
      const controller = `
const {spawn}=require('node:child_process'),fs=require('node:fs');
spawn(process.execPath, ${JSON.stringify(correspondenceWatchdogArgs(60000, bin, []))}, {stdio:['pipe','ignore','ignore']});
const t=setInterval(()=>{ if(fs.existsSync(${JSON.stringify(pidFile)})){ clearInterval(t); process.kill(process.pid,'SIGKILL'); } },20);`;
      const parent = spawn(realProcess.execPath, ["-e", controller], { stdio: "ignore" });
      await new Promise((r) => parent.once("exit", r));
      const pid = Number(readFileSync(pidFile, "utf8"));
      await until(() => !alive(pid), 3000);
    });
  });
});

describe("qualification script", () => {
  const script = join(import.meta.dirname, "../../scripts/qualify-claude-correspondence.mjs");
  const built = join(import.meta.dirname, "../../dist/index.js");

  it.runIf(existsSync(built))("refuses to run without an approval and writes no trace", () => {
    const planFile = join(dir, "plan.json"),
      out = join(dir, "out.trace.json");
    writeFileSync(planFile, JSON.stringify(rawPlan()));
    let status = 0,
      stdout = "";
    try {
      execFileSync(realProcess.execPath, [script, planFile, join(dir, "approval.json"), out], {
        encoding: "utf8",
        env: { ...realProcess.env, HOME: home, TMPDIR: temporary, CODEX_HOME: undefined },
      });
    } catch (error) {
      const e = error as { status: number; stdout: string };
      status = e.status;
      stdout = e.stdout;
    }
    expect(status).toBe(1);
    expect(stdout.trim()).toBe("held: runtime-approval-missing");
    expect(existsSync(out)).toBe(false);
  });
});
