import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import type { DatabaseSync as Database } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORRESPONDENCE_INSTRUCTIONS_V2,
  CORRESPONDENCE_INSTRUCTIONS_V2_SHA256,
  CORRESPONDENCE_OUTPUT_SCHEMA,
  CORRESPONDENCE_QUALIFICATION_PACKET,
  CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
  CORRESPONDENCE_WATCHDOG_SOURCE,
  checkCorrespondenceTraceBytes,
  correspondenceCommand,
  correspondenceWatchdogArgs,
  correspondenceGrantRevision,
  correspondenceInput,
  createQualificationTransport,
  digest,
  openCorrespondenceEmulation,
  openCorrespondenceWindow,
  openDispatcher,
  parseCorrespondenceAnswer,
  parseCorrespondencePacket,
  parseDispatchRequest,
  prepareCorrespondencePlan,
  prepareCorrespondenceQualificationPlan,
  qualifyClaudeCorrespondence,
  qualifyClaudeCorrespondenceEmulation,
  reviewCorrespondenceJournal,
} from "../index.js";
import { checkBinary, checkNativeProfile } from "../supervised-files.js";
import { replaceCorrespondenceAllowlistForTesting } from "../testing.js";
import {
  checkCorrespondenceQualification,
  correspondenceBuiltins,
} from "../correspondence-qualification.js";
import type {
  CorrespondenceDispatcher,
  CorrespondenceEmulatorScript,
  CorrespondencePacket,
  PreparedCorrespondencePlan,
} from "../index.js";

/**
 * The correspondence allowlist is deep-frozen data. Tests replace it only through the test-only
 * hook (the `testing` subpath), exactly as a maintainer would add a version: one entry with its
 * embedded trace.
 */
const allow = {
  entries: [] as Array<{
    nativeVersion: string;
    model: string;
    binarySHA256: string;
    traceSHA256: string;
    trace: string;
    builtinAgents: string[];
    builtinPlugins: string[];
  }>,
  restore: () => {},
};
const applyAllowlist = () => {
  allow.restore();
  allow.restore = replaceCorrespondenceAllowlistForTesting(allow.entries);
};
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});
vi.mock("../correspondence-qualification.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../correspondence-qualification.js")>();
  return {
    ...actual,
    checkCorrespondenceQualification: vi.fn(actual.checkCorrespondenceQualification),
    correspondenceBuiltins: vi.fn(actual.correspondenceBuiltins),
  };
});
vi.mock("../supervised-files.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../supervised-files.js")>();
  return {
    ...actual,
    checkNativeProfile: vi.fn(actual.checkNativeProfile),
    checkBinary: vi.fn(actual.checkBinary),
  };
});
const spawnOriginal = vi.mocked(spawnSync).getMockImplementation()!;
const qualifyOriginal = vi.mocked(checkNativeProfile).getMockImplementation()!;
const binaryOriginal = vi.mocked(checkBinary).getMockImplementation()!;
const gateOriginal = vi.mocked(checkCorrespondenceQualification).getMockImplementation()!;
/** The test-local gate stub: accepts only the fakes qualifyFake registered. */
const stubGate = () => {
  vi.mocked(checkCorrespondenceQualification).mockImplementation((profile, allowlist) => {
    if (stubbedFakes.has(fakeKey(profile))) return;
    return allowlist ? gateOriginal(profile, allowlist) : gateOriginal(profile);
  });
  // The pinned built-ins a stubbed fake's (test-only) entry would carry.
  vi.mocked(correspondenceBuiltins).mockImplementation((profile) =>
    stubbedBuiltins.get(fakeKey(profile)),
  );
};
const realProcess = process;
// Vite 5 rewrites node:sqlite, so load the builtin directly, as the dispatcher does.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};

let dir: string, home: string, temporary: string;
const open: CorrespondenceDispatcher[] = [];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const THREAD = uuid(900);
/** The V2 instruction text's SHA-256, pinned here so any change is deliberate. */
const PINNED_V2_SHA256 = "d69e5d3fe1c8ef616d8cab6510bda1d6dd98dc1c9c513fff7f29468fba0c4028";
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

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
  // Plans may name 2.1.286 (listed); a window still needs its binary hash and trace (qualifyFake).
  allow.entries.splice(0, allow.entries.length, {
    nativeVersion: "2.1.286",
    model: "claude-model",
    binarySHA256: "0".repeat(64),
    traceSHA256: "0".repeat(64),
    trace: "",
    builtinAgents: [],
    builtinPlugins: [],
  });
  applyAllowlist();
  stubGate();
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of open.splice(0)) d.close();
  vi.unstubAllGlobals();
  vi.mocked(spawnSync).mockImplementation(spawnOriginal);
  vi.mocked(checkNativeProfile).mockImplementation(qualifyOriginal);
  vi.mocked(checkBinary).mockImplementation(binaryOriginal);
  allow.restore();
  allow.restore = () => {};
  stubbedFakes.clear();
  stubbedBuiltins.clear();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

/**
 * Fake binaries the gate is stubbed to accept in this file. The public API cannot make a recorded
 * trace, and the gate refuses entries from the test hook, so a live window with a fake binary
 * opens only through this test-local stub; every other profile goes to the real gate.
 */
const stubbedFakes = new Set<string>();
const stubbedBuiltins = new Map<string, { agents: string[]; plugins: string[] }>();
const fakeKey = (p: { nativeVersion: string; binarySHA256: string; model: string }) =>
  `${p.nativeVersion} ${p.binarySHA256} ${p.model}`;
/**
 * Lists a fake binary's version through the test hook, so plans prepare, and stubs the gate for
 * exactly that version, binary and model.
 */
function qualifyFake(
  bin: { sha: string },
  nativeVersion = "2.1.286",
  model = "claude-model",
  builtins: { agents: string[]; plugins: string[] } = { agents: [], plugins: [] },
) {
  const others = allow.entries.filter((e) => e.nativeVersion !== nativeVersion);
  allow.entries.splice(0, allow.entries.length, ...others, {
    nativeVersion,
    model,
    binarySHA256: bin.sha,
    traceSHA256: "0".repeat(64),
    trace: "",
    builtinAgents: builtins.agents,
    builtinPlugins: builtins.plugins,
  });
  applyAllowlist();
  const key = fakeKey({ nativeVersion, binarySHA256: bin.sha, model });
  stubbedFakes.add(key);
  stubbedBuiltins.set(key, {
    agents: [...builtins.agents].sort(),
    plugins: [...builtins.plugins].sort(),
  });
}
/** The 2.1.308 safe-mode built-ins, as the "builtins" fake reports them. */
const BUILTIN_AGENTS = [
  "general-purpose",
  "Explore",
  "Plan",
  "statusline-setup",
  "claude-code-guide",
];
const BUILTIN_PLUGINS = ["cc-plugin-easel", "cc-plugin-plugin-authoring", "cc-plugin-sec-default"];

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
  it("pins the V2 instruction text, which names the one output tool", () => {
    expect(CORRESPONDENCE_INSTRUCTIONS_V2).toContain(
      "Return your answer by calling the StructuredOutput tool exactly once, and use no other tool.",
    );
    expect(CORRESPONDENCE_INSTRUCTIONS_V2).not.toContain("You have no tools");
    expect(CORRESPONDENCE_INSTRUCTIONS_V2_SHA256).toBe(PINNED_V2_SHA256);
  });

  it("pins the instruction text and the closed answer schema", () => {
    expect(createHash("sha256").update(CORRESPONDENCE_INSTRUCTIONS_V2).digest("hex")).toBe(
      CORRESPONDENCE_INSTRUCTIONS_V2_SHA256,
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
    expect(input.startsWith(CORRESPONDENCE_INSTRUCTIONS_V2)).toBe(true);
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
    ["a CODEX_HOME", { environment: { HOME: "/tmp", CODEX_HOME: "/tmp", TMPDIR: "/tmp" } }],
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

  it("records an emulated hang as unknown when aborted, and keeps the controller", async () => {
    const { prepared, dispatcher, invocations } = emulate(() => ({ kind: "hang" }));
    const controller = new AbortController();
    const pending = dispatcher.dispatch(request(prepared, 1), { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    expect(await pending).toMatchObject({ kind: "unknown", reason: "invocation-unresolved" });
    expect(await dispatcher.dispatch(request(prepared, 2))).toMatchObject({ kind: "busy" });
    expect(invocations()).toBe(1);
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
  const options = (
    prepared: PreparedCorrespondencePlan,
    stateFile = join(dir, "state.sqlite"),
  ) => ({
    prepared,
    stateFile,
    runtimeApprovalFile: join(dir, "approval.json"),
    deviceId: "yuri",
  });
  type ApprovalKind =
    | "owner-approved-correspondence-window"
    | "owner-approved-correspondence-qualification";
  const approve = (
    o: ReturnType<typeof options>,
    lengthMs = o.prepared.plan.limits.windowMs,
    kind: ApprovalKind = "owner-approved-correspondence-window",
  ) =>
    writeFileSync(
      o.runtimeApprovalFile,
      JSON.stringify({
        kind,
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
  const held = (o: ReturnType<typeof options>, hold: string) => ({
    kind: "held",
    planDigest: o.prepared.planDigest,
    holds: [hold],
  });

  /** Paths whose ACL listing shows an entry, and an optional hook in front of process.kill. */
  let aclPaths: string[], killHook: ((pid: number, sig?: string | number) => boolean) | undefined;
  const defaultsCalls: string[][] = [];
  beforeEach(() => {
    aclPaths = [];
    killHook = undefined;
    defaultsCalls.length = 0;
    vi.spyOn(Date, "now").mockReturnValue(1001);
    // The private-file checks are qualified for macOS only; simulate it on any host, as the
    // supervised suite does, so these tests assert the same holds on CI's Linux runner.
    vi.stubGlobal(
      "process",
      new Proxy(realProcess, {
        get: (t, k) =>
          k === "platform"
            ? "darwin"
            : k === "kill"
              ? (pid: number, sig?: string | number) =>
                  killHook?.(pid, sig) ?? realProcess.kill(pid, sig)
              : Reflect.get(t, k),
      }),
    );
    vi.mocked(spawnSync).mockImplementation((file, args, opts) => {
      if (file === "/bin/ls")
        return {
          pid: 0,
          output: [],
          status: 0,
          signal: null,
          // One line per listed path; an ACL adds `+` and an entry line.
          stdout: (args ?? [])
            .slice(1)
            .map((path) =>
              aclPaths.includes(String(path))
                ? "drwx------+ 1 f\n 0: user:other allow write\n"
                : "drwx------ 1 f\n",
            )
            .join(""),
          stderr: "",
        };
      if (file === "/usr/bin/defaults") {
        defaultsCalls.push([...(args ?? [])]);
        return {
          pid: 0,
          output: [],
          status: 1,
          signal: null,
          stdout: "",
          stderr: `Domain ${args?.[1]} does not exist\n`,
        };
      }
      return spawnOriginal(file, args, opts);
    });
  });

  // Owner, 16 November: an ACL on an ancestor (a home folder's `everyone deny delete`) was reported
  // as runtime-approval-invalid or environment-mismatch.
  it("names an ACL on an ancestor of the approval, journal or TMPDIR as acl-unqualified", async () => {
    vi.mocked(checkNativeProfile).mockImplementation(() => {});
    const o = options(prepareCorrespondencePlan(rawPlan()));
    approve(o);
    aclPaths.push(dir);
    expect(openCorrespondenceWindow(o)).toEqual(held(o, "acl-unqualified"));
    aclPaths.length = 0;
    // TMPDIR under a folder with an ACL.
    aclPaths.push(temporary);
    expect(openCorrespondenceWindow(o)).toEqual(held(o, "acl-unqualified"));
    aclPaths.length = 0;
    // The qualification run reads its approval first.
    const plan = rawPlan();
    const q = options(prepareCorrespondenceQualificationPlan(plan), join(dir, "q.sqlite"));
    approve(q, 600000, "owner-approved-correspondence-qualification");
    aclPaths.push(dir);
    expect(
      await qualifyClaudeCorrespondence({
        prepared: q.prepared,
        runtimeApprovalFile: q.runtimeApprovalFile,
        deviceId: "yuri",
      }),
    ).toEqual(held(q, "acl-unqualified"));
  });

  it("holds without an approval, and with an approval of the wrong length", () => {
    const o = options(prepareCorrespondencePlan(rawPlan()));
    expect(openCorrespondenceWindow(o)).toEqual(held(o, "runtime-approval-missing"));
    approve(o, 1800000);
    expect(openCorrespondenceWindow(o)).toEqual(held(o, "runtime-approval-invalid"));
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
    expect(openCorrespondenceWindow(o)).toEqual(held(o, "runtime-approval-invalid"));
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
    expect(JSON.parse(args[args.indexOf("--settings") + 1])).toEqual({
      disableAllHooks: true,
      disableClaudeAiConnectors: true,
      enabledPlugins: {
        "cc-plugin-agents-md@builtin": false,
        "cc-plugin-telemetry@builtin": false,
        "cc-plugin-plugin-authoring@builtin": false,
        "cc-plugin-mods-guide@builtin": false,
        "cc-plugin-tips@builtin": false,
        "cc-plugin-mermaid@builtin": false,
        "cc-plugin-responsive-mode@builtin": false,
        "cc-plugin-diff@builtin": false,
        "cc-plugin-easel@builtin": false,
        "cc-plugin-claude-test@builtin": false,
        "cc-plugin-you-should-know@builtin": false,
      },
    });
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
      | "stream-event"
      | "hidden-user-tool"
      | "hang"
      | "descendant"
      | "reply-with-descendant"
      | "slow-term"
      | "overflow"
      | "nonzero"
      | "trailing"
      | "escaped-holder"
      | "escaped-detached"
      | "socket"
      | "builtins";
    // No provider SDK, network or credentials: a local script that speaks Claude's stream-json the
    // way 2.1.308's --json-schema does: one StructuredOutput call whose input is structured_output.
    const fake = (behavior: Behavior, version = "2.1.286") => `
const fs=require('node:fs'),cp=require('node:child_process');
const args=process.argv.slice(2), behavior=${JSON.stringify(behavior)}, version=${JSON.stringify(version)};
const log=(f,x)=>fs.appendFileSync(${JSON.stringify(dir)}+'/'+f, JSON.stringify(x)+String.fromCharCode(10));
if(args[0]==='--version'){log('probes','--version');console.log(version+' (Claude Code)');process.exit(0);}
if(args[0]==='--help'){log('probes','--help');console.log('--safe-mode --setting-sources --tools --strict-mcp-config --session-id --json-schema --permission-prompts');process.exit(0);}
const descendant=()=>cp.spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});require('fs').writeFileSync("+JSON.stringify(${JSON.stringify(join(dir, "descendant"))})+",String(process.pid));setInterval(()=>{},1000)"],{stdio:'ignore'}).unref();
let data='';process.stdin.on('data',x=>data+=x);process.stdin.on('end',()=>{
  log('launches', args);
  fs.writeFileSync(${JSON.stringify(join(dir, "stdin"))}, data);
  const pgidOf=(p)=>cp.execFileSync('ps',['-o','pgid=','-p',String(p)],{encoding:'utf8'}).trim();
  // fd 3 is the watchdog's control channel; Claude must not hold it.
  let fd3=false; try{fs.writeSync(3,'group 1'+String.fromCharCode(10)+'done 0'+String.fromCharCode(10));fd3=true;}catch{}
  fs.writeFileSync(${JSON.stringify(join(dir, "child.tmp"))}, JSON.stringify({pid:process.pid,ppid:process.ppid,
    pgid:pgidOf(process.pid),parentPgid:pgidOf(process.ppid),fd3,TMPDIR:process.env.TMPDIR,
    HARBOR_KITE:process.env.CLAUDE_CODE_HARBOR_KITE,
    DISABLE_BUILTIN_AGENTS:process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS}));
  fs.renameSync(${JSON.stringify(join(dir, "child.tmp"))}, ${JSON.stringify(join(dir, "child"))});
  if(behavior==='escaped-detached'){
    // A descendant in a new session (setsid), with stdio redirected: invisible to the group kill.
    cp.spawn(process.execPath,['-e',"require('fs').writeFileSync("+JSON.stringify(${JSON.stringify(join(dir, "escaped"))})+",String(process.pid));setInterval(()=>{},1000)"],{stdio:'ignore',detached:true}).unref();
    const t0=Date.now(); while(!fs.existsSync(${JSON.stringify(join(dir, "escaped"))}) && Date.now()-t0<3000){}
  }
  if(behavior==='escaped-holder'){
    // A descendant that leaves Claude's group but keeps stdout open.
    cp.spawn(process.execPath,['-e',"require('fs').writeFileSync("+JSON.stringify(${JSON.stringify(join(dir, "escaped"))})+",String(process.pid));setInterval(()=>{},1000)"],{stdio:['ignore','inherit','ignore'],detached:true}).unref();
  }
  const s=args[args.indexOf('--session-id')+1];
  const d=/Packet digest: ([a-f0-9]{64})/.exec(data)[1];
  const emit=m=>console.log(JSON.stringify(m));
  const answer={packetDigest:d,decision:'reply',reason:null,text:'Received.',needs:null,gaps:null};
  const tools=behavior==='tools-offered'?['StructuredOutput','Bash']:behavior==='no-tools'?[]:['StructuredOutput'];
  emit({type:'system',subtype:'init',session_id:s,model:args[args.indexOf('--model')+1],claude_code_version:version,tools,
    mcp_servers:behavior==='mcp'?[{name:'x',status:'connected'}]:[],slash_commands:[],skills:[],
    agents:behavior==='builtins'?${JSON.stringify(["general-purpose", "Explore", "Plan", "statusline-setup", "claude-code-guide"])}:[],
    plugins:behavior==='builtins'?${JSON.stringify(["cc-plugin-easel", "cc-plugin-plugin-authoring", "cc-plugin-sec-default"])}.map(n=>({name:n,path:'/Users/someone/.claude/'+n,source:n+'@builtin',version:'2.1.308'})):[],
    // The keys 2.1.308's print mode adds, as Core's flags and environment leave them.
    capabilities:['interrupt_receipt_v1','ui_surface_v1'],original_cwd:process.cwd(),additional_directories:[],
    ...(behavior==='socket'?{messaging_socket_path:'/tmp/cc-socks/'+process.pid+'.sock'}:{}),
    fast_mode_state:'off',fast_mode_disabled_reason:'not_first_party',per_turn_effort_active:false,view_mode:'default'});
  if(behavior==='descendant'||behavior==='slow-term') descendant();
  if(behavior==='slow-term') process.on('SIGTERM',()=>setTimeout(()=>process.exit(0),1500));
  if(behavior==='hang'||behavior==='descendant'||behavior==='slow-term'){setInterval(()=>{},1000);return;}
  if(behavior==='overflow'){emit({type:'user',session_id:s,pad:'x'.repeat(300000)});setInterval(()=>{},1000);return;}
  const rest=()=>{
  if(behavior==='stream-event') emit({type:'stream_event',session_id:s,event:{type:'content_block_start',index:0,content_block:{type:'tool_use',name:'Bash',input:{}}}});
  if(behavior==='hidden-user-tool') emit({type:'user',session_id:s,message:{content:[{type:'tool_result',content:[{type:'tool_use',name:'Bash',input:{command:'cat SECRET-TOKEN'}}]}]}});
  const call={type:'tool_use',id:'toolu_1',name:behavior==='tool'?'Bash':'StructuredOutput',
    input:behavior==='input-differs'?{...answer,text:'Other.'}:answer};
  if(behavior==='text-only') emit({type:'assistant',session_id:s,message:{content:[{type:'text',text:'Received.'}]}});
  else if(behavior!=='no-call') emit({type:'assistant',session_id:s,message:{content:behavior==='second-call'?[call,call]:[call]}});
  if(behavior!=='no-call'&&behavior!=='text-only') emit({type:'user',session_id:s,message:{content:[{type:'tool_result',tool_use_id:'toolu_1',content:'ok'}]}});
  emit({type:'result',subtype:'success',session_id:s,is_error:false,
    ...(behavior==='no-output'||behavior==='text-only'?{}:{structured_output:answer})});
  if(behavior==='trailing') process.stdout.write('{"type":"user"');
  if(behavior==='nonzero') process.exitCode=3;
  };
  if(behavior!=='reply-with-descendant') return rest();
  // Reply only once the descendant is running, so it is still alive when Claude exits.
  descendant();
  const wait=setInterval(()=>{ if(fs.existsSync(${JSON.stringify(join(dir, "descendant"))})){ clearInterval(wait); rest(); } },10);
});`;
    const fakeBinary = (behavior: Behavior, version = "2.1.286") =>
      binary("claude-fixture", fake(behavior, version));
    function ready(behavior: Behavior, overrides: Record<string, unknown> = {}) {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      const bin = fakeBinary(behavior);
      qualifyFake(bin);
      const o = options(prepareCorrespondencePlan(rawPlan(overrides, bin)));
      approve(o);
      const opened = openCorrespondenceWindow(o);
      if (opened.kind !== "ready") throw Error("not ready: " + JSON.stringify(opened));
      open.push(opened.dispatcher);
      return { o, dispatcher: opened.dispatcher };
    }
    const childInfo = () => JSON.parse(readFileSync(join(dir, "child"), "utf8"));
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
        if (realProcess.hrtime.bigint() > end) throw Error("fixture deadline");
        await new Promise((r) => setTimeout(r, 20));
      }
    };

    // Claude 2.1.308: the cross-session inbox would let other local sessions message a duty turn.
    it("turns Claude's cross-session messaging off for every turn", async () => {
      vi.stubEnv("CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS", "0");
      const { o, dispatcher } = ready("reply");
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
        kind: "observed",
        outcome: "completed",
      });
      expect(childInfo().HARBOR_KITE).toBe("0");
      expect(childInfo().DISABLE_BUILTIN_AGENTS).toBe("1");
      expect(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS).toBe("0");
    });

    it("keeps the empty pin fail-closed when built-ins remain active despite invocation settings", async () => {
      const { o, dispatcher } = ready("builtins");
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({ kind: "unknown" });
      expect(dispatcher.turnRefusal("delivery-1")).toBe("init-builtins-mismatch");
      expect(dispatcher.status()).toMatchObject({ unknown: 1, reservations: 1 });
    });

    // Owner, 16 November: "Pin exact names".
    it("accepts the pinned built-ins and refuses any change to them", async () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      const bin = fakeBinary("builtins");
      qualifyFake(bin, "2.1.286", "claude-model", {
        agents: BUILTIN_AGENTS,
        plugins: BUILTIN_PLUGINS,
      });
      const o = options(prepareCorrespondencePlan(rawPlan({}, bin)));
      approve(o);
      const opened = openCorrespondenceWindow(o);
      if (opened.kind !== "ready") throw Error("not ready: " + JSON.stringify(opened));
      expect(await opened.dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
        kind: "observed",
        outcome: "completed",
      });
      opened.dispatcher.close();
      rmSync(o.stateFile);
      // The same turn against a pin that lacks one plugin.
      qualifyFake(bin, "2.1.286", "claude-model", {
        agents: BUILTIN_AGENTS,
        plugins: BUILTIN_PLUGINS.slice(1),
      });
      const again = openCorrespondenceWindow(o);
      if (again.kind !== "ready") throw Error("not ready: " + JSON.stringify(again));
      open.push(again.dispatcher);
      expect(await again.dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
        kind: "unknown",
      });
      expect(again.dispatcher.turnRefusal("delivery-1")).toBe("init-builtins-mismatch");
    });

    it("refuses a turn whose init reports a messaging socket", async () => {
      const { o, dispatcher } = ready("socket");
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({ kind: "unknown" });
      expect(dispatcher.turnRefusal("delivery-1")).toBe("init-messaging-socket");
    });

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

    // Codex round 5: the real gate never accepts an entry from the test hook.
    it("holds a version listed only through the test hook at the real gate", () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      const bin = fakeBinary("reply");
      qualifyFake(bin);
      const o = options(prepareCorrespondencePlan(rawPlan({}, bin)));
      approve(o);
      // The plan prepares (the hook lists the version), but without the test-local stub the real
      // gate refuses the hook's entry.
      stubbedFakes.clear();
      expect(openCorrespondenceWindow(o)).toEqual(held(o, "native-profile-unqualified"));
      qualifyFake(bin);
      const opened = openCorrespondenceWindow(o);
      expect(opened.kind).toBe("ready");
      if (opened.kind === "ready") opened.dispatcher.close();
      expect(existsSync(join(dir, "launches"))).toBe(false);
    });

    it("refuses another binary for an allowlisted version", () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      qualifyFake({ sha: "c".repeat(64) });
      const o = options(prepareCorrespondencePlan(rawPlan({}, fakeBinary("reply"))));
      approve(o);
      expect(openCorrespondenceWindow(o)).toEqual(held(o, "native-profile-unqualified"));
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
      // Codex review 1: a tool call outside the assistant message, then a valid call.
      ["streams a Bash call in a stream_event", "stream-event", "unexpected-frame"],
      ["hides a Bash call in a user frame", "hidden-user-tool", "tool-name-mismatch"],
      ["overflows its output", "overflow", "output-overflow"],
      ["exits nonzero after a valid answer", "nonzero", "exit-nonzero"],
      ["leaves a partial line", "trailing", "trailing-output"],
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

    // Codex review 2: descendants outlived the deadline.
    it.each(["hang", "descendant"] as const)(
      "stops a turn that does not finish (%s) at its deadline, with its whole process group",
      async (behavior) => {
        // One 60 s window, 700 ms from its end: the turn's limit is 700 ms.
        const { o, dispatcher } = ready(behavior, {
          limits: { topLevelTurns: 1, windowMs: 60000, requestTimeoutMs: 120000 },
        });
        vi.mocked(Date.now).mockReturnValue(61000 - 700);
        expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
          kind: "unknown",
        });
        expect(dispatcher.turnRefusal("delivery-1")).toBe("deadline");
        const child = childInfo();
        expect(dispatcher.turnProcessGroup("delivery-1")).toBe(child.pid);
        expect(alive(child.pid)).toBe(false);
        if (behavior === "descendant")
          expect(alive(Number(readFileSync(join(dir, "descendant"), "utf8")))).toBe(false);
      },
      15000,
    );

    // Claude review 4: a Claude that ignores SIGTERM, slow to exit, with a descendant that ignores
    // SIGTERM. Both must be dead before the turn is reported stopped.
    it("kills a slow Claude and its descendants before an aborted turn returns", async () => {
      const { o, dispatcher } = ready("slow-term");
      const controller = new AbortController();
      const pending = dispatcher.dispatch(request(o.prepared, 1), { signal: controller.signal });
      await until(() => existsSync(join(dir, "descendant")));
      controller.abort();
      expect(await pending).toMatchObject({ kind: "unknown" });
      expect(dispatcher.turnRefusal("delivery-1")).toBe("aborted");
      expect(alive(childInfo().pid)).toBe(false);
      expect(alive(Number(readFileSync(join(dir, "descendant"), "utf8")))).toBe(false);
    }, 15000);

    it("records stop-unconfirmed when Claude's process group cannot be shown gone", async () => {
      const { o, dispatcher } = ready("hang");
      const controller = new AbortController();
      const pending = dispatcher.dispatch(request(o.prepared, 1), { signal: controller.signal });
      await until(() => existsSync(join(dir, "child")));
      const child = childInfo();
      // A stopped watchdog cannot confirm, and the group keeps answering the probe.
      realProcess.kill(child.ppid, "SIGSTOP");
      killHook = (pid, sig) =>
        pid === -child.pid && (sig === 0 || sig === undefined) ? true : undefined!;
      controller.abort();
      expect(await pending).toMatchObject({ kind: "unknown" });
      expect(dispatcher.turnRefusal("delivery-1")).toBe("stop-unconfirmed");
      expect(dispatcher.turnProcessGroup("delivery-1")).toBe(child.pid);
      killHook = undefined;
      // The real group was still killed.
      await until(() => !alive(child.pid));
    }, 20000);

    it("kills descendants left in Claude's group after a normal answer", async () => {
      const { o, dispatcher } = ready("reply-with-descendant");
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
        kind: "observed",
        outcome: "completed",
      });
      expect(alive(Number(readFileSync(join(dir, "descendant"), "utf8")))).toBe(false);
    }, 15000);

    // Codex review 2 and Claude review 8 (round 2): an escaped holder of stdout kept dispatch open.
    it("returns within the escalation time when an escaped descendant holds stdout", async () => {
      const { o, dispatcher } = ready("escaped-holder");
      const started = performance.now();
      try {
        expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
          kind: "unknown",
        });
        expect(performance.now() - started).toBeLessThan(8000);
        expect(dispatcher.turnRefusal("delivery-1")).toBe("stop-unconfirmed");
        // No invocation is left active: the window can close.
        expect(dispatcher.status().active).toBe(0);
        // The marker scan found the holder and killed it.
        expect(alive(Number(readFileSync(join(dir, "escaped"), "utf8")))).toBe(false);
      } finally {
        const escaped = join(dir, "escaped");
        if (existsSync(escaped)) {
          const pid = Number(readFileSync(escaped, "utf8"));
          if (alive(pid)) realProcess.kill(pid, "SIGKILL");
        }
      }
    }, 15000);

    // Codex round 4, item 2: a descendant that left Claude's group survived a completed turn.
    it("refuses a completed turn whose descendant escaped the group, and kills it", async () => {
      const { o, dispatcher } = ready("escaped-detached");
      const escaped = join(dir, "escaped");
      try {
        expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
          kind: "unknown",
        });
        expect(dispatcher.turnRefusal("delivery-1")).toBe("descendant-escaped");
        expect(dispatcher.agentProposal("delivery-1")).toBeUndefined();
        expect(alive(Number(readFileSync(escaped, "utf8")))).toBe(false);
      } finally {
        if (existsSync(escaped)) {
          const pid = Number(readFileSync(escaped, "utf8"));
          if (alive(pid)) realProcess.kill(pid, "SIGKILL");
        }
      }
    }, 15000);

    // Automated security review: fd 3 lines from Claude's tree could be forged.
    it("ignores a Claude that writes group and done lines to fd 3", async () => {
      const { o, dispatcher } = ready("descendant", {
        limits: { topLevelTurns: 1, windowMs: 60000, requestTimeoutMs: 120000 },
      });
      vi.mocked(Date.now).mockReturnValue(61000 - 700);
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
        kind: "unknown",
      });
      const child = childInfo();
      // The controller kept the watchdog's group, not the forged one, and killed it all.
      expect(dispatcher.turnRefusal("delivery-1")).toBe("deadline");
      expect(dispatcher.turnProcessGroup("delivery-1")).toBe(child.pid);
      expect(alive(child.pid)).toBe(false);
      expect(alive(Number(readFileSync(join(dir, "descendant"), "utf8")))).toBe(false);
    }, 15000);

    // Claude review 9 (round 2): a refusal before spawn left an unknown, spent turn.
    it("refunds a turn refused before any process starts", async () => {
      const { o, dispatcher } = ready("reply");
      let calls = 0;
      // Opening and both admission checks pass; the transport's own check just before spawn fails.
      vi.mocked(checkBinary).mockImplementation((p) => {
        calls += 1;
        if (calls === 3) throw Error("binary-pin-mismatch");
        return binaryOriginal(p);
      });
      expect(await dispatcher.dispatch(request(o.prepared, 1))).toEqual({
        kind: "refused",
        reason: "held",
      });
      expect(existsSync(join(dir, "launches"))).toBe(false);
      expect(dispatcher.status()).toMatchObject({ unknown: 0, active: 0 });
      // Refunded and not held: the next turn runs.
      vi.mocked(checkBinary).mockImplementation(binaryOriginal);
      expect(await dispatcher.dispatch(request(o.prepared, 2))).toMatchObject({
        kind: "observed",
        outcome: "completed",
      });
    });

    it("starts Claude in its own process group, under a watchdog in its own group", async () => {
      const { o, dispatcher } = ready("reply");
      await dispatcher.dispatch(request(o.prepared, 1));
      const child = childInfo();
      const own = execFileSync("ps", ["-o", "pgid=", "-p", String(realProcess.pid)], {
        encoding: "utf8",
      }).trim();
      // Claude leads its own group; the watchdog (Claude's parent) leads another.
      expect(child.pgid).toBe(String(child.pid));
      expect(child.parentPgid).toBe(String(child.ppid));
      expect([child.pgid, child.parentPgid]).not.toContain(own);
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
      expect(childInfo().TMPDIR).toBe(pinned);
    });

    // Claude review 10 (round 2): shared, world-writable folders were accepted.
    it("refuses shared folders such as /tmp and /Users/Shared for TMPDIR", () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      const bin = fakeBinary("reply");
      qualifyFake(bin);
      for (const shared of [realpathSync("/tmp"), "/Users/Shared"]) {
        const o = options(
          prepareCorrespondencePlan(
            rawPlan({ environment: { HOME: home, CODEX_HOME: null, TMPDIR: shared } }, bin),
          ),
        );
        approve(o);
        expect(openCorrespondenceWindow(o)).toEqual(held(o, "environment-mismatch"));
      }
    });

    // Codex review 7 and Claude review 6: the pinned TMPDIR check was too loose.
    it("holds a pinned TMPDIR that is unsafe in any way, and a different HOME", () => {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
      const bin = fakeBinary("reply");
      qualifyFake(bin);
      const loose = join(dir, "loose-tmp"),
        parent = join(dir, "shared"),
        inShared = join(parent, "tmp"),
        withAcl = join(dir, "acl-tmp"),
        link = join(dir, "link-tmp");
      mkdirSync(loose, { mode: 0o755 });
      execFileSync("chmod", ["755", loose]);
      mkdirSync(inShared, { recursive: true, mode: 0o700 });
      execFileSync("chmod", ["777", parent]);
      mkdirSync(withAcl, { mode: 0o700 });
      aclPaths.push(withAcl);
      symlinkSync(temporary, link);
      for (const environment of [
        { HOME: home, CODEX_HOME: null, TMPDIR: join(dir, "missing") },
        { HOME: home, CODEX_HOME: null, TMPDIR: loose },
        { HOME: home, CODEX_HOME: null, TMPDIR: inShared },
        { HOME: home, CODEX_HOME: null, TMPDIR: withAcl },
        { HOME: home, CODEX_HOME: null, TMPDIR: link },
        { HOME: home, CODEX_HOME: null, TMPDIR: temporary + "/" },
        { HOME: join(dir, "other-home"), CODEX_HOME: null, TMPDIR: temporary },
      ]) {
        const o = options(prepareCorrespondencePlan(rawPlan({ environment }, bin)));
        approve(o);
        // An ACL is named as such; every other unsafe TMPDIR is an environment mismatch.
        expect([environment.TMPDIR, openCorrespondenceWindow(o)]).toEqual([
          environment.TMPDIR,
          held(o, environment.TMPDIR === withAcl ? "acl-unqualified" : "environment-mismatch"),
        ]);
      }
    });

    describe("journals", () => {
      const fileHash = (path: string) => sha(readFileSync(path));

      it("holds a live window on an emulated journal, and refuses the other way round", async () => {
        const emulated = emulate(() => ({ kind: "failed" }));
        await emulated.dispatcher.dispatch(request(emulated.prepared, 1));
        emulated.dispatcher.close();
        open.splice(0);
        const before = fileHash(join(dir, "state.sqlite"));
        vi.mocked(checkNativeProfile).mockImplementation(() => {});
        const bin = fakeBinary("reply");
        qualifyFake(bin);
        const o = options(prepareCorrespondencePlan(rawPlan({}, bin)));
        approve(o);
        expect(openCorrespondenceWindow(o)).toEqual(held(o, "journal-source-mismatch"));
        expect(fileHash(join(dir, "state.sqlite"))).toBe(before);
        rmSync(join(dir, "state.sqlite"));
        const live = ready("reply");
        await live.dispatcher.dispatch(request(live.o.prepared, 1));
        live.dispatcher.close();
        open.splice(0);
        const liveBefore = fileHash(join(dir, "state.sqlite"));
        expect(() => emulate(() => ({ kind: "failed" }))).toThrow("journal-source-mismatch");
        expect(fileHash(join(dir, "state.sqlite"))).toBe(liveBefore);
      });

      // Codex review 6: the public openDispatcher skipped the journal-source check.
      it("refuses the public qualification dispatcher on a live journal, unchanged", async () => {
        const live = ready("reply");
        await live.dispatcher.dispatch(request(live.o.prepared, 1));
        live.dispatcher.close();
        open.splice(0);
        const before = fileHash(join(dir, "state.sqlite"));
        expect(() =>
          openDispatcher({
            stateFile: join(dir, "state.sqlite"),
            transport: createQualificationTransport(),
            bindings: [],
            grants: [],
            profiles: [],
          }),
        ).toThrow("journal-source-mismatch");
        expect(fileHash(join(dir, "state.sqlite"))).toBe(before);
      });

      it("holds an unmarked journal with rows, like 0.4.0's, and reviews it read-only", async () => {
        const first = emulate(() => ({ kind: "lost" }));
        const lost = await first.dispatcher.dispatch(request(first.prepared, 1));
        first.dispatcher.close();
        open.splice(0);
        const db = new DatabaseSync(join(dir, "state.sqlite"));
        db.exec("DROP TABLE journal_source; DROP TABLE turn_refusals;");
        db.close();
        const before = fileHash(join(dir, "state.sqlite"));
        vi.mocked(checkNativeProfile).mockImplementation(() => {});
        const bin = fakeBinary("reply");
        qualifyFake(bin);
        const o = options(prepareCorrespondencePlan(rawPlan({}, bin)));
        approve(o);
        expect(openCorrespondenceWindow(o)).toEqual(held(o, "journal-source-mismatch"));
        expect(reviewCorrespondenceJournal(join(dir, "state.sqlite"))).toEqual({
          source: "unmarked",
          reservations: 1,
          unresolved: [
            {
              deliveryId: "delivery-1",
              dispatchId: lost.kind === "unknown" ? lost.dispatchId : "",
              nativeSessionId: lost.kind === "unknown" ? lost.nativeSessionId : "",
              state: "unknown",
              admittedAtMs: 1000,
              refusal: null,
              processGroup: null,
            },
          ],
        });
        expect(fileHash(join(dir, "state.sqlite"))).toBe(before);
      });

      // Codex review 3 (round 2): a null-source opener could open a 0.4.0 correspondence journal.
      it("keeps the public dispatcher out of an unmarked journal with correspondence rows", async () => {
        const first = emulate(() => ({ kind: "lost" }));
        await first.dispatcher.dispatch(request(first.prepared, 1));
        first.dispatcher.close();
        open.splice(0);
        const db = new DatabaseSync(join(dir, "state.sqlite"));
        db.exec("DROP TABLE journal_source; DROP TABLE turn_refusals;");
        db.close();
        const before = fileHash(join(dir, "state.sqlite"));
        expect(() =>
          openDispatcher({
            stateFile: join(dir, "state.sqlite"),
            transport: createQualificationTransport(),
            bindings: [],
            grants: [],
            profiles: [],
          }),
        ).toThrow("journal-source-mismatch");
        expect(fileHash(join(dir, "state.sqlite"))).toBe(before);
        expect(reviewCorrespondenceJournal(join(dir, "state.sqlite")).unresolved).toHaveLength(1);
      });

      // LocalHelp item 18: the emulated qualification cannot touch a live or qualification journal.
      it("keeps the emulated qualification out of live and qualification journals", async () => {
        const live = ready("reply");
        await live.dispatcher.dispatch(request(live.o.prepared, 1));
        live.dispatcher.close();
        open.splice(0);
        const plan = rawPlan({}, fakeBinary("reply"));
        await expect(
          qualifyClaudeCorrespondenceEmulation({
            prepared: prepareCorrespondenceQualificationPlan(plan),
            stateFile: join(dir, "state.sqlite"),
            frames: () => [],
          }),
        ).rejects.toThrow("journal-source-mismatch");
      });

      it("will not review a journal a listener holds", () => {
        const live = ready("reply");
        expect(() => reviewCorrespondenceJournal(live.o.stateFile)).toThrow(
          "dispatcher-already-open",
        );
      });
    });

    describe("qualification", () => {
      const qualificationFile = () => join(dir, "qualification.sqlite");
      function prepared(behavior: Behavior, nativeVersion = "2.1.308") {
        const plan = rawPlan({}, fakeBinary(behavior, nativeVersion));
        return options(
          prepareCorrespondenceQualificationPlan({
            ...plan,
            profiles: [{ ...plan.profiles[0], nativeVersion }],
          }),
          qualificationFile(),
        );
      }
      const qualify = (o: ReturnType<typeof options>) =>
        qualifyClaudeCorrespondence({
          prepared: o.prepared,
          runtimeApprovalFile: o.runtimeApprovalFile,
          deviceId: "yuri",
        });
      const approveQualification = (o: ReturnType<typeof options>) =>
        approve(o, 600000, "owner-approved-correspondence-qualification");

      it("refuses to run without a valid qualification approval, and writes nothing", async () => {
        const o = prepared("reply");
        expect(await qualify(o)).toEqual(held(o, "runtime-approval-missing"));
        // A duty approval never authorises qualification.
        approve(o, 600000, "owner-approved-correspondence-window");
        expect(await qualify(o)).toEqual(held(o, "runtime-approval-invalid"));
        approve(o, 1800001, "owner-approved-correspondence-qualification");
        expect(await qualify(o)).toEqual(held(o, "runtime-approval-invalid"));
        expect(existsSync(join(dir, "launches"))).toBe(false);
        expect(existsSync(o.stateFile)).toBe(false);
      });

      it("never lets a qualification plan or approval open a duty window", () => {
        const o = prepared("reply");
        approveQualification(o);
        expect(() => openCorrespondenceWindow(o)).toThrow("correspondence-plan-changed");
        const duty = options(prepareCorrespondencePlan(rawPlan({}, fakeBinary("reply"))));
        approve(duty, 600000, "owner-approved-correspondence-qualification");
        expect(openCorrespondenceWindow(duty)).toEqual(held(duty, "runtime-approval-invalid"));
      });

      it("refuses a duty plan for qualification", async () => {
        const duty = options(prepareCorrespondencePlan(rawPlan({}, fakeBinary("reply"))));
        await expect(
          qualifyClaudeCorrespondence({
            prepared: duty.prepared,
            runtimeApprovalFile: duty.runtimeApprovalFile,
            deviceId: "yuri",
          }),
        ).rejects.toThrow("correspondence-plan-changed");
      });

      // Claude reviews 8/9, Codex 8: the bypass must keep the version, help and policy checks.
      it("fills the entry's pinned built-ins from the recorded trace", async () => {
        const o = prepared("builtins");
        approveQualification(o);
        const result = await qualify(o);
        if (result.kind !== "ran") throw Error("not run: " + JSON.stringify(result));
        // Unpinned during qualification, so the built-ins are recorded, not refused.
        expect(result.verdict).toBe("accepted");
        expect(result.allowlistEntry?.builtinAgents).toEqual([...BUILTIN_AGENTS].sort());
        expect(result.allowlistEntry?.builtinPlugins).toEqual([...BUILTIN_PLUGINS].sort());
        const init = JSON.parse(result.traceText).frames[0];
        expect(init.agents).toEqual([...BUILTIN_AGENTS].sort());
        expect(init.plugins).toEqual([...BUILTIN_PLUGINS].sort());
        expect(result.traceText).not.toContain("/Users/someone");
        // The entry it prints, with its trace, passes the real gate for exactly this binary.
        const profile = o.prepared.plan.profiles[0];
        expect(() => gateOriginal(profile, [result.allowlistEntry!])).not.toThrow();
        expect(() =>
          gateOriginal(profile, [{ ...result.allowlistEntry!, builtinAgents: ["Plan"] }]),
        ).toThrow("native-profile-unqualified");
      });

      it("records exactly one turn on the fixed packet, bypassing only the trace gate", async () => {
        // 2.1.308 is not allowlisted here, and checkNativeProfile is the real one.
        const o = prepared("reply");
        approveQualification(o);
        const approvalBefore = readFileSync(o.runtimeApprovalFile, "utf8");
        const result = await qualify(o);
        if (result.kind !== "ran") throw Error("not run: " + JSON.stringify(result));
        expect(result.verdict).toBe("accepted");
        expect(result.turnRefusal).toBeUndefined();
        expect(result.replayRefusal).toBeUndefined();
        expect(result.nativeVersion).toBe("2.1.308");
        expect(result.disposition).toMatchObject({ kind: "observed", outcome: "completed" });
        expect(result.traceSHA256).toBe(digest(result.traceText));
        expect(
          checkCorrespondenceTraceBytes(result.traceText, {
            model: "claude-model",
            nativeVersion: "2.1.308",
            binarySHA256: o.prepared.plan.profiles[0].binarySHA256,
          }),
        ).toBeUndefined();
        expect(result.traceText).toContain('"claude_code_version": "2.1.308"');
        // The real static checks ran: version, help and managed policy.
        const probes = readFileSync(join(dir, "probes"), "utf8").trim().split("\n");
        expect(probes).toEqual(expect.arrayContaining(['"--version"', '"--help"']));
        expect(defaultsCalls).toContainEqual(["read", "com.anthropic.claudecode"]);
        expect(readFileSync(join(dir, "launches"), "utf8").trim().split("\n")).toHaveLength(1);
        expect(readFileSync(join(dir, "stdin"), "utf8")).toBe(
          correspondenceInput(
            CORRESPONDENCE_QUALIFICATION_PACKET,
            CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
          ),
        );
        expect(readFileSync(o.runtimeApprovalFile, "utf8")).toBe(approvalBefore);
        // Its own journal, budget of one: a second run starts no turn.
        expect(reviewCorrespondenceJournal(o.stateFile)).toMatchObject({
          source: "qualification",
          reservations: 1,
          unresolved: [],
        });
        expect(await qualify(o)).toMatchObject({
          kind: "not-run",
          disposition: { kind: "refused", reason: "budget-exhausted" },
        });
      });

      it("still holds when the binary reports another version", async () => {
        const plan = rawPlan({}, fakeBinary("reply", "2.1.286"));
        const o = options(
          prepareCorrespondenceQualificationPlan({
            ...plan,
            profiles: [{ ...plan.profiles[0], nativeVersion: "2.1.308" }],
          }),
          qualificationFile(),
        );
        approveQualification(o);
        expect(await qualify(o)).toEqual(held(o, "native-profile-unqualified"));
        expect(existsSync(join(dir, "launches"))).toBe(false);
      });

      it.each([
        ["calls the output tool twice", "second-call", "tool-second-call"],
        ["streams a Bash call in a stream_event", "stream-event", "unexpected-frame"],
        ["hides a Bash call in a user frame", "hidden-user-tool", "tool-name-mismatch"],
      ] as const)(
        "reports a turn that %s as refused, with no tool input in the trace",
        async (_, behavior, reason) => {
          const o = prepared(behavior);
          approveQualification(o);
          const result = await qualify(o);
          expect(result).toMatchObject({
            kind: "ran",
            turnRefusal: reason,
            replayRefusal: reason,
            verdict: { refused: reason },
          });
          if (result.kind !== "ran") return;
          for (const leaked of ["SECRET-TOKEN", "Received.", '"input"', 'structured_output": {'])
            expect(result.traceText).not.toContain(leaked);
        },
      );

      // Claude review 3: a failed qualification blocked the duty journal for good.
      it("leaves a failed qualification only in its own journal", async () => {
        const o = prepared("second-call");
        approveQualification(o);
        await qualify(o);
        expect(reviewCorrespondenceJournal(o.stateFile)).toMatchObject({
          source: "qualification",
          reservations: 1,
          unresolved: [{ state: "unknown", refusal: "tool-second-call" }],
        });
        // A duty window on the qualification journal is held; a duty journal is unaffected.
        const bin = fakeBinary("reply");
        qualifyFake(bin);
        vi.mocked(checkNativeProfile).mockImplementation(() => {});
        const onQualification = options(prepareCorrespondencePlan(rawPlan({}, bin)), o.stateFile);
        approve(onQualification);
        expect(openCorrespondenceWindow(onQualification)).toEqual(
          held(onQualification, "journal-source-mismatch"),
        );
        const duty = options(prepareCorrespondencePlan(rawPlan({}, bin)));
        approve(duty);
        const opened = openCorrespondenceWindow(duty);
        expect(opened.kind).toBe("ready");
        if (opened.kind === "ready") opened.dispatcher.close();
      });
    });

    // Codex review 5: a new Claude version needed code, not only data.
    describe("a new Claude version", () => {
      it("is usable for duty with one allowlist entry and its trace, and nothing else", async () => {
        const bin = fakeBinary("reply", "9.9.9");
        const plan = rawPlan({}, bin);
        const raw = { ...plan, profiles: [{ ...plan.profiles[0], nativeVersion: "9.9.9" }] };
        expect(() => prepareCorrespondencePlan(raw)).toThrow("unqualified-profile");
        qualifyFake(bin, "9.9.9");
        const o = options(prepareCorrespondencePlan(raw));
        approve(o);
        // The real static checks, against the binary's own --version.
        const opened = openCorrespondenceWindow(o);
        if (opened.kind !== "ready") throw Error("not ready: " + JSON.stringify(opened));
        open.push(opened.dispatcher);
        expect(await opened.dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
          kind: "observed",
          outcome: "completed",
        });
        expect(opened.dispatcher.agentProposal("delivery-1")?.source).toBe("supervised-native");
      });

      it("can be qualified before it is listed", async () => {
        const plan = rawPlan({}, fakeBinary("reply", "9.9.8"));
        const raw = { ...plan, profiles: [{ ...plan.profiles[0], nativeVersion: "9.9.8" }] };
        expect(() => prepareCorrespondencePlan(raw)).toThrow("unqualified-profile");
        const o = options(prepareCorrespondenceQualificationPlan(raw), join(dir, "q.sqlite"));
        approve(o, 600000, "owner-approved-correspondence-qualification");
        expect(
          await qualifyClaudeCorrespondence({
            prepared: o.prepared,
            runtimeApprovalFile: o.runtimeApprovalFile,
            deviceId: "yuri",
          }),
        ).toMatchObject({ kind: "ran", nativeVersion: "9.9.8", verdict: "accepted" });
      });
    });
  });

  describe("watchdog", () => {
    const sleeper = (withDescendant = false) => {
      const pidFile = join(dir, "sleeper.pid"),
        descendantFile = join(dir, "sleeper-descendant.pid");
      const { bin } = binary(
        "sleeper",
        `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
${
  withDescendant
    ? `require('node:child_process').spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});require('fs').writeFileSync(${JSON.stringify(JSON.stringify(descendantFile)).slice(1, -1)},String(process.pid));setInterval(()=>{},1000)"],{stdio:'ignore'});`
    : ""
}
setInterval(()=>{},1000);`,
      );
      return { bin, pidFile, descendantFile };
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

    it("kills the child and its descendants at its wall-clock deadline", async () => {
      const { bin, pidFile, descendantFile } = sleeper(true);
      const watchdog = spawn(
        realProcess.execPath,
        correspondenceWatchdogArgs(realProcess.pid, 600, bin, []),
        { stdio: ["pipe", "ignore", "ignore"] },
      );
      const code = await new Promise<number | null>((r) => watchdog.once("exit", r));
      expect(code).toBe(124);
      // The watchdog exits only once the whole group is gone.
      expect(alive(Number(readFileSync(pidFile, "utf8")))).toBe(false);
      expect(alive(Number(readFileSync(descendantFile, "utf8")))).toBe(false);
    }, 10000);

    it("kills the child when its controller dies without cleaning up", async () => {
      const { bin, pidFile } = sleeper();
      // A throwaway controller starts the watchdog, waits for the child, then SIGKILLs itself.
      const controller = `
const {spawn}=require('node:child_process'),fs=require('node:fs');
spawn(process.execPath, ['-e', ${JSON.stringify(CORRESPONDENCE_WATCHDOG_SOURCE)}, '--', String(process.pid), '60000', ${JSON.stringify(bin)}], {stdio:['pipe','ignore','ignore']});
const t=setInterval(()=>{ if(fs.existsSync(${JSON.stringify(pidFile)})){ clearInterval(t); process.kill(process.pid,'SIGKILL'); } },20);`;
      const parent = spawn(realProcess.execPath, ["-e", controller], { stdio: "ignore" });
      await new Promise((r) => parent.once("exit", r));
      const pid = Number(readFileSync(pidFile, "utf8"));
      await until(() => !alive(pid), 4000);
    }, 10000);

    // Codex review 3: the watchdog could adopt the wrong parent.
    it("never starts Claude when its controller is already gone", async () => {
      const { bin, pidFile } = sleeper();
      const controller = `
require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(CORRESPONDENCE_WATCHDOG_SOURCE)}, '--', String(process.pid), '60000', ${JSON.stringify(bin)}], {stdio:['pipe','ignore','ignore'], detached: false}).unref();
process.exit(0);`;
      const parent = spawn(realProcess.execPath, ["-e", controller], { stdio: "ignore" });
      await new Promise((r) => parent.once("exit", r));
      await new Promise((r) => setTimeout(r, 1500));
      expect(existsSync(pidFile)).toBe(false);
    }, 10000);

    // Claude review 6 (round 2): a signal could race the spawn.
    it("never starts Claude when it is signalled as it starts", async () => {
      const { bin, pidFile } = sleeper();
      const watchdog = spawn(
        realProcess.execPath,
        correspondenceWatchdogArgs(realProcess.pid, 60000, bin, []),
        { stdio: ["pipe", "ignore", "ignore"], detached: true },
      );
      watchdog.kill("SIGTERM");
      await new Promise((r) => watchdog.once("exit", r));
      await new Promise((r) => setTimeout(r, 500));
      expect(existsSync(pidFile)).toBe(false);
    });

    // Codex review 1 and Claude review 7 (round 2): a SIGKILL to the controller's whole group
    // killed the watchdog too, and left Claude with no deadline.
    it.runIf(existsSync(join(import.meta.dirname, "../../dist/index.js")))(
      "kills Claude and its descendants when the controller's whole group is SIGKILLed",
      async () => {
        const { bin, pidFile, descendantFile } = sleeper(true);
        const dist = join(import.meta.dirname, "../../dist/index.js");
        // A throwaway controller in its own group starts the watchdog as the transport does.
        const controller = `
const { spawnCorrespondenceWatchdog } = await import(${JSON.stringify(dist)});
const w = spawnCorrespondenceWatchdog(4000, ${JSON.stringify(bin)}, []);
w.stdio[3].on("data", () => {});
setInterval(() => {}, 1000);`;
        const parent = spawn(realProcess.execPath, ["--input-type=module", "-e", controller], {
          stdio: "ignore",
          detached: true,
        });
        await until(() => existsSync(pidFile) && existsSync(descendantFile), 5000);
        const started = performance.now();
        realProcess.kill(-parent.pid!, "SIGKILL");
        const claude = Number(readFileSync(pidFile, "utf8")),
          descendant = Number(readFileSync(descendantFile, "utf8"));
        await until(() => !alive(claude) && !alive(descendant), 4000);
        expect(performance.now() - started).toBeLessThan(4000);
      },
      15000,
    );

    it("refuses to start under a parent other than the one it was given", async () => {
      const { bin, pidFile } = sleeper();
      const watchdog = spawn(
        realProcess.execPath,
        correspondenceWatchdogArgs(realProcess.pid + 100000, 60000, bin, []),
        { stdio: ["pipe", "ignore", "ignore"] },
      );
      expect(await new Promise((r) => watchdog.once("exit", r))).toBe(122);
      expect(existsSync(pidFile)).toBe(false);
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
