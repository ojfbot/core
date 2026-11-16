import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_CORRESPONDENCE_QUALIFIED,
  CLAUDE_OUTPUT_TOOL,
  CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
  CORRESPONDENCE_TRACE_DIRECTORY,
  checkCorrespondenceQualification,
  checkCorrespondenceTraceBytes,
  correspondenceTracePath,
  createCorrespondenceFrameChecker,
  replayCorrespondenceTrace,
  serializeCorrespondenceTrace,
  traceFromFrames,
} from "../index.js";
import type { CorrespondenceTrace } from "../index.js";

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const SESSION = "00000000-0000-4000-8000-000000000042";
const answer = {
  packetDigest: CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
  decision: "reply",
  reason: null,
  text: "Received.",
  needs: null,
  gaps: null,
};

/**
 * Raw stream-json frames shaped as Claude Code 2.1.308's binary implies for `--json-schema`: init
 * lists only StructuredOutput, the model calls it once, its tool_result is echoed, and the result
 * carries the same object as structured_output. Session, account and usage fields are included so
 * the cut can be seen to drop them.
 */
function rawFrames(): unknown[] {
  return [
    {
      type: "system",
      subtype: "init",
      cwd: "/private/tmp/empty",
      session_id: SESSION,
      tools: [CLAUDE_OUTPUT_TOOL],
      mcp_servers: [],
      model: "claude-model",
      permissionMode: "dontAsk",
      slash_commands: [],
      apiKeySource: "none",
      claude_code_version: "2.1.308",
      output_style: "default",
      agents: [],
      skills: [],
      plugins: [],
      uuid: "11111111-1111-4111-8111-111111111111",
    },
    {
      type: "assistant",
      session_id: SESSION,
      uuid: "22222222-2222-4222-8222-222222222222",
      message: {
        id: "msg_1",
        model: "claude-model",
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [
          { type: "thinking", thinking: "private reasoning" },
          { type: "tool_use", id: "toolu_1", name: CLAUDE_OUTPUT_TOOL, input: { ...answer } },
        ],
      },
    },
    {
      type: "user",
      session_id: SESSION,
      message: {
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }],
      },
    },
    {
      type: "result",
      subtype: "success",
      is_error: false,
      session_id: SESSION,
      result: "",
      total_cost_usd: 0.01,
      usage: { input_tokens: 10 },
      structured_output: { ...answer },
    },
  ];
}
const synthetic = (): CorrespondenceTrace => traceFromFrames(rawFrames());

type Frames = Array<Record<string, unknown>>;
const clone = (t: CorrespondenceTrace): CorrespondenceTrace => structuredClone(t);
const init = (t: CorrespondenceTrace) =>
  (t.frames as Frames).find((f) => f.type === "system" && f.subtype === "init")!;
const result = (t: CorrespondenceTrace) => (t.frames as Frames).find((f) => f.type === "result")!;
const assistants = (t: CorrespondenceTrace) =>
  (t.frames as Frames).filter((f) => f.type === "assistant") as Array<{
    message: { content: Array<Record<string, unknown>> };
  }>;
const callOf = (t: CorrespondenceTrace) =>
  assistants(t)
    .flatMap((a) => a.message.content)
    .find((b) => b.type === "tool_use")!;
const dropCalls = (t: CorrespondenceTrace) => {
  for (const a of assistants(t))
    a.message.content = a.message.content.filter((b) => b.type !== "tool_use");
};

const mutations: Array<[string, (t: CorrespondenceTrace) => void, string]> = [
  ["an extra tool", (t) => (init(t).tools as string[]).push("Bash"), "init-tools-mismatch"],
  ["no output tool", (t) => (init(t).tools = []), "init-tools-mismatch"],
  [
    "an MCP server",
    (t) => (init(t).mcp_servers as unknown[]).push({ name: "x" }),
    "init-surface-not-empty",
  ],
  ["a slash command", (t) => (init(t).slash_commands = ["compact"]), "init-surface-not-empty"],
  ["an agent", (t) => (init(t).agents = ["general-purpose"]), "init-surface-not-empty"],
  ["a plugin", (t) => (init(t).plugins = [{ name: "p" }]), "init-surface-not-empty"],
  [
    "a second call",
    (t) => assistants(t)[0].message.content.push({ ...callOf(t) }),
    "tool-second-call",
  ],
  [
    "a second call in another frame",
    (t) => {
      const at = (t.frames as Frames).findIndex((f) => f.type === "result");
      (t.frames as Frames).splice(at, 0, {
        type: "assistant",
        message: { content: [{ ...callOf(t) }] },
      });
    },
    "tool-second-call",
  ],
  ["a different tool name", (t) => (callOf(t).name = "Bash"), "tool-name-mismatch"],
  ["a server tool", (t) => (callOf(t).type = "server_tool_use"), "tool-name-mismatch"],
  [
    "input that differs from the output",
    (t) => ((callOf(t).input as Record<string, unknown>).text = "Something else."),
    "tool-input-mismatch",
  ],
  [
    "a missing call",
    (t) => {
      dropCalls(t);
      delete result(t).structured_output;
    },
    "no-tool-call",
  ],
  ["structured_output without a call", dropCalls, "output-without-tool-call"],
  [
    "a call without structured_output",
    (t) => delete result(t).structured_output,
    "tool-call-without-output",
  ],
  [
    "a text answer with no call",
    (t) => {
      for (const a of assistants(t)) a.message.content = [{ type: "text" }];
      delete result(t).structured_output;
    },
    "no-tool-call",
  ],
  ["no result frame", (t) => (t.frames = (t.frames as Frames).slice(0, -1)), "no-result"],
  [
    "a frame before init",
    (t) => (t.frames as Frames).unshift({ type: "user" }),
    "frame-before-init",
  ],
  [
    "a frame after the result",
    (t) => (t.frames as Frames).push({ type: "user" }),
    "frame-after-result",
  ],
  ["a second init", (t) => (t.frames as Frames).splice(1, 0, { ...init(t) }), "init-repeated"],
];

/** Every committed trace, plus the synthetic one shaped like the binary. */
function committed(): Array<[string, CorrespondenceTrace, string]> {
  const dir = CORRESPONDENCE_TRACE_DIRECTORY;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".trace.json"))
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      return [f, JSON.parse(text) as CorrespondenceTrace, text];
    });
}
const traces: Array<[string, CorrespondenceTrace]> = [
  ["synthetic 2.1.308-shaped trace", synthetic()],
  ...committed().map(([f, t]): [string, CorrespondenceTrace] => [f, t]),
];

describe("frame checker", () => {
  it("accepts one StructuredOutput call whose input is the structured_output", () => {
    const checker = createCorrespondenceFrameChecker({ sessionId: SESSION, model: "claude-model" });
    for (const f of rawFrames()) checker.frame(f);
    expect(checker.terminal()).toBe(true);
    expect(checker.verdict()).toEqual({ kind: "accepted", structuredOutput: answer });
  });

  it("refuses another session, another model and malformed frames", () => {
    const run = (frames: unknown[], model = "claude-model") => {
      const checker = createCorrespondenceFrameChecker({ sessionId: SESSION, model });
      try {
        for (const f of frames) checker.frame(f);
      } catch {
        // The verdict carries the first refusal.
      }
      return checker.verdict();
    };
    const frames = rawFrames();
    expect(run(frames, "other-model")).toEqual({ kind: "refused", reason: "init-model-mismatch" });
    expect(run([{ ...(frames[0] as object), session_id: "x" }])).toEqual({
      kind: "refused",
      reason: "wrong-session",
    });
    expect(run([frames[0], { type: "assistant", session_id: SESSION, message: {} }])).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
    expect(run([frames[0], null])).toEqual({ kind: "refused", reason: "invalid-frame" });
  });

  it("reports an error result as failed", () => {
    const frames = rawFrames();
    (frames[3] as Record<string, unknown>).is_error = true;
    const checker = createCorrespondenceFrameChecker({ sessionId: SESSION, model: "claude-model" });
    for (const f of frames) checker.frame(f);
    expect(checker.verdict()).toEqual({ kind: "failed" });
  });
});

describe("trace format", () => {
  it("cuts raw frames down to what the checker reads", () => {
    const trace = synthetic();
    const text = serializeCorrespondenceTrace(trace);
    for (const leaked of [SESSION, "private reasoning", "usage", "uuid", "total_cost_usd", "cwd"])
      expect(text).not.toContain(leaked);
    expect(trace.frames).toEqual([
      {
        type: "system",
        subtype: "init",
        model: "claude-model",
        tools: ["StructuredOutput"],
        mcp_servers: [],
        slash_commands: [],
        agents: [],
        skills: [],
        plugins: [],
      },
      {
        type: "assistant",
        message: {
          content: [
            { type: "thinking" },
            { type: "tool_use", name: "StructuredOutput", input: answer },
          ],
        },
      },
      { type: "user" },
      { type: "result", subtype: "success", is_error: false, structured_output: answer },
    ]);
  });

  it("refuses a trace of the wrong format", () => {
    expect(replayCorrespondenceTrace({ ...synthetic(), format: "v0" })).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
    expect(replayCorrespondenceTrace({ ...synthetic(), extra: 1 })).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
  });

  it.each(traces)("replays %s through the real checker as accepted", (_, trace) => {
    expect(replayCorrespondenceTrace(trace).kind).toBe("accepted");
    expect(checkCorrespondenceTraceBytes(serializeCorrespondenceTrace(trace))).toBeUndefined();
  });

  describe.each(traces)("mutations of %s", (_, trace) => {
    it.each(mutations)("refuses %s", (__, mutate, reason) => {
      const t = clone(trace);
      mutate(t);
      expect(replayCorrespondenceTrace(t)).toEqual({ kind: "refused", reason });
    });
  });
});

describe("correspondence allowlist", () => {
  const profile = (nativeVersion: string, binarySHA256 = "b".repeat(64)) => ({
    provider: "claude-code" as const,
    nativeVersion,
    binarySHA256,
  });

  it("refuses 2.1.286 and 2.1.308 until their traces are committed", () => {
    for (const v of ["2.1.286", "2.1.308"])
      if (!CLAUDE_CORRESPONDENCE_QUALIFIED.some((e) => e.nativeVersion === v))
        expect(() => checkCorrespondenceQualification(profile(v))).toThrow(
          "native-profile-unqualified",
        );
  });

  it("pins every allowlisted version to a committed trace with the same hash", () => {
    for (const entry of CLAUDE_CORRESPONDENCE_QUALIFIED) {
      const bytes = readFileSync(correspondenceTracePath(entry.nativeVersion));
      expect(sha(bytes)).toBe(entry.traceSHA256);
      expect(checkCorrespondenceTraceBytes(bytes)).toBeUndefined();
    }
  });

  it("qualifies a version only with its binary hash and a matching, accepted trace", () => {
    const dir = mkdtempSync(join(tmpdir(), "trace-fixture-"));
    try {
      const text = serializeCorrespondenceTrace(synthetic());
      writeFileSync(join(dir, "9.9.9.trace.json"), text);
      const entry = {
        nativeVersion: "9.9.9",
        binarySHA256: "b".repeat(64),
        traceSHA256: sha(text),
      };
      expect(() => checkCorrespondenceQualification(profile("9.9.9"), [entry], dir)).not.toThrow();
      // Another binary for the same version, another trace hash, or no trace file: refused.
      for (const [p, e] of [
        [profile("9.9.9", "c".repeat(64)), entry],
        [profile("9.9.9"), { ...entry, traceSHA256: "0".repeat(64) }],
        [profile("9.9.8"), { ...entry, nativeVersion: "9.9.8" }],
      ] as const)
        expect(() => checkCorrespondenceQualification(p, [e], dir)).toThrow(
          "native-profile-unqualified",
        );
      // A committed trace that no longer replays is refused even with a matching hash.
      const bad = clone(synthetic());
      callOf(bad).name = "Bash";
      const badText = serializeCorrespondenceTrace(bad);
      writeFileSync(join(dir, "9.9.7.trace.json"), badText);
      expect(() =>
        checkCorrespondenceQualification(
          profile("9.9.7"),
          [{ ...entry, nativeVersion: "9.9.7", traceSHA256: sha(badText) }],
          dir,
        ),
      ).toThrow("native-profile-unqualified");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires the trace to answer the fixed qualification packet", () => {
    const t = clone(synthetic());
    for (const o of [callOf(t).input, result(t).structured_output] as Array<
      Record<string, unknown>
    >)
      o.packetDigest = "0".repeat(64);
    expect(checkCorrespondenceTraceBytes(serializeCorrespondenceTrace(t))).toBe(
      "invalid-agent-proposal",
    );
  });
});
