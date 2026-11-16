import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORRESPONDENCE_INSTRUCTIONS_V1,
  CORRESPONDENCE_INSTRUCTIONS_V1_SHA256,
  CORRESPONDENCE_OUTPUT_SCHEMA,
  correspondenceCommand,
  correspondenceGrantRevision,
  correspondenceInput,
  digest,
  openCorrespondenceEmulation,
  openCorrespondenceWindow,
  parseCorrespondenceAnswer,
  parseCorrespondencePacket,
  parseDispatchRequest,
  prepareCorrespondencePlan,
} from "../index.js";
import { checkNativeProfile } from "../supervised-files.js";
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
const spawnOriginal = vi.mocked(spawnSync).getMockImplementation()!;
const qualifyOriginal = vi.mocked(checkNativeProfile).getMockImplementation()!;
const realProcess = process;

let dir: string;
const open: CorrespondenceDispatcher[] = [];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const THREAD = uuid(900);

beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "correspondence-fixture-")));
  // A Claude-only plan requires the controller to run without CODEX_HOME.
  vi.stubEnv("CODEX_HOME", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of open.splice(0)) d.close();
  vi.unstubAllGlobals();
  vi.mocked(spawnSync).mockImplementation(spawnOriginal);
  vi.mocked(checkNativeProfile).mockImplementation(qualifyOriginal);
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function packet(n: number, extra: Partial<CorrespondencePacket> = {}): CorrespondencePacket {
  return {
    kind: "correspondence-packet",
    version: 1,
    duty: { device_id: "yuri", session_id: "yuri-claude-duty" },
    request: {
      message_id: uuid(n),
      thread_id: THREAD,
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
    environment: { HOME: process.env.HOME, CODEX_HOME: null, TMPDIR: process.env.TMPDIR ?? null },
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
    resources: [`helpdesk:thread:${THREAD}`],
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
    expect(input.endsWith(bytes + "\n")).toBe(true);
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
      ["an extra property", { tool: "bash" }],
    ])("refuses %s", (_, change) => {
      expect(check({ ...reply(d()), ...change })).toThrow("invalid-agent-proposal");
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
  });

  it("holds without an approval, and with an approval of the wrong length", () => {
    const o = options(prepareCorrespondencePlan(rawPlan()));
    expect(openCorrespondenceWindow(o)).toMatchObject({
      kind: "held",
      holds: ["runtime-approval-missing"],
    });
    approve(o, 1800000);
    expect(openCorrespondenceWindow(o)).toMatchObject({
      kind: "held",
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
    expect(openCorrespondenceWindow(o)).toMatchObject({ kind: "held" });
  });

  it("builds a fresh-session, no-tools Claude command", () => {
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
    // No provider SDK, network or credentials: a local script that speaks Claude's stream-json.
    const fake = (behavior: "reply" | "tool" | "tools-offered") => `
const fs=require('node:fs');
const args=process.argv.slice(2);
let data='';process.stdin.on('data',x=>data+=x);process.stdin.on('end',()=>{
  fs.appendFileSync(${JSON.stringify(join(dir, "launches"))}, JSON.stringify(args)+'\\n');
  fs.writeFileSync(${JSON.stringify(join(dir, "stdin"))}, data);
  const s=args[args.indexOf('--session-id')+1];
  const d=/Packet digest: ([a-f0-9]{64})/.exec(data)[1];
  const emit=m=>console.log(JSON.stringify(m));
  emit({type:'system',subtype:'init',session_id:s,model:args[args.indexOf('--model')+1],tools:${behavior === "tools-offered" ? "['Bash']" : "[]"},mcp_servers:[]});
  ${behavior === "tool" ? "emit({type:'assistant',session_id:s,message:{content:[{type:'tool_use',name:'Bash'}]}});" : ""}
  emit({type:'result',session_id:s,is_error:false,structured_output:{packetDigest:d,decision:'reply',reason:null,text:'Received.',needs:null,gaps:null}});
});`;
    function ready(behavior: "reply" | "tool" | "tools-offered") {
      vi.mocked(checkNativeProfile).mockImplementation(() => {});
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
      const o = options(
        prepareCorrespondencePlan(rawPlan({}, binary("claude-fixture", fake(behavior)))),
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
      expect(readFileSync(join(dir, "stdin"), "utf8").endsWith(r.task.input + "\n")).toBe(true);
      expect(dispatcher.agentProposal("delivery-1")?.source).toBe("supervised-native");
      expect(dispatcher.status()).toMatchObject({ mode: "supervised", realProviderCalls: null });
    });

    it.each(["tool", "tools-offered"] as const)(
      "treats a turn that is %s as unknown, with no proposal",
      async (behavior) => {
        const { o, dispatcher } = ready(behavior);
        expect(await dispatcher.dispatch(request(o.prepared, 1))).toMatchObject({
          kind: "unknown",
        });
        expect(dispatcher.agentProposal("delivery-1")).toBeUndefined();
      },
    );
  });
});
