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
const MODEL = "claude-model";
const VERSION = "2.1.308";
const PINNED = { model: MODEL, nativeVersion: VERSION };
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
function rawFrames(): Array<Record<string, unknown>> {
  return [
    {
      type: "system",
      subtype: "init",
      cwd: "/private/tmp/empty",
      session_id: SESSION,
      tools: [CLAUDE_OUTPUT_TOOL],
      mcp_servers: [],
      model: MODEL,
      permissionMode: "dontAsk",
      slash_commands: [],
      apiKeySource: "none",
      claude_code_version: VERSION,
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
        model: MODEL,
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
/** The trace qualification commits for an accepted turn: the answer only after it was accepted. */
const synthetic = (frames = rawFrames()): CorrespondenceTrace =>
  traceFromFrames(frames, { acceptedAnswer: answer });

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
const dropOutput = (t: CorrespondenceTrace) => {
  delete result(t).structured_output;
  result(t).has_structured_output = false;
};
const insertBefore = (t: CorrespondenceTrace, type: string, frame: Record<string, unknown>) => {
  const at = (t.frames as Frames).findIndex((f) => f.type === type);
  (t.frames as Frames).splice(at, 0, frame);
};

const mutations: Array<[string, (t: CorrespondenceTrace) => void, string]> = [
  ["an extra tool", (t) => (init(t).tools as string[]).push("Bash"), "init-tools-mismatch"],
  ["no output tool", (t) => (init(t).tools = { count: 0, sha256: sha("") }), "init-tools-mismatch"],
  [
    "an MCP server",
    (t) => (init(t).mcp_servers = { count: 1, empty: false }),
    "init-surface-not-empty",
  ],
  [
    "a slash command",
    (t) => (init(t).slash_commands = { count: 1, empty: false }),
    "init-surface-not-empty",
  ],
  ["an agent", (t) => (init(t).agents = { count: 3, empty: false }), "init-surface-not-empty"],
  ["a plugin", (t) => (init(t).plugins = { count: 1, empty: false }), "init-surface-not-empty"],
  ["another model", (t) => (init(t).model = "other-model"), "init-model-mismatch"],
  ["another version", (t) => (init(t).claude_code_version = "2.1.400"), "init-version-mismatch"],
  [
    "a second call",
    (t) => assistants(t)[0].message.content.push({ ...callOf(t) }),
    "tool-second-call",
  ],
  [
    "a second call in another frame",
    (t) =>
      insertBefore(t, "result", {
        type: "assistant",
        message: { content: [{ ...callOf(t) }] },
      }),
    "tool-second-call",
  ],
  ["a different tool name", (t) => (callOf(t).name = "Bash"), "tool-name-mismatch"],
  ["a server tool", (t) => (callOf(t).type = "server_tool_use"), "tool-name-mismatch"],
  [
    "a tool call hidden in a user frame",
    (t) =>
      insertBefore(t, "assistant", {
        type: "user",
        nested_tool_uses: [{ type: "tool_use", name: "Bash" }],
      }),
    "tool-name-mismatch",
  ],
  [
    "a stream_event tool call",
    (t) =>
      insertBefore(t, "assistant", {
        type: "stream_event",
        nested_tool_uses: [{ type: "tool_use", name: "Bash" }],
      }),
    "unexpected-frame",
  ],
  [
    "an unlisted system frame",
    (t) => insertBefore(t, "result", { type: "system", subtype: "hook_started" }),
    "unexpected-frame",
  ],
  [
    "input that differs from the output",
    (t) => ((callOf(t).input as Record<string, unknown>).text = "Something else."),
    "tool-input-mismatch",
  ],
  [
    "a missing call",
    (t) => {
      dropCalls(t);
      dropOutput(t);
    },
    "no-tool-call",
  ],
  ["structured_output without a call", dropCalls, "output-without-tool-call"],
  ["a call without structured_output", dropOutput, "tool-call-without-output"],
  [
    "a text answer with no call",
    (t) => {
      for (const a of assistants(t)) a.message.content = [{ type: "text" }];
      dropOutput(t);
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

/** Every committed trace: [file, trace, text, version]. */
function committed(): Array<[string, CorrespondenceTrace, string, string]> {
  const dir = CORRESPONDENCE_TRACE_DIRECTORY;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".trace.json"))
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      return [f, JSON.parse(text) as CorrespondenceTrace, text, f.replace(/\.trace\.json$/, "")];
    });
}
const modelOf = (t: CorrespondenceTrace) => String(init(t).model);
/** The synthetic trace shaped like the binary, plus every committed trace, with its pin. */
const traces: Array<[string, CorrespondenceTrace, { model: string; nativeVersion: string }]> = [
  ["synthetic 2.1.308-shaped trace", synthetic(), PINNED],
  ...committed().map(
    ([f, t, , v]): [string, CorrespondenceTrace, { model: string; nativeVersion: string }] => [
      f,
      t,
      { model: modelOf(t), nativeVersion: v },
    ],
  ),
];

function run(frames: unknown[]) {
  const checker = createCorrespondenceFrameChecker({ sessionId: SESSION, ...PINNED });
  try {
    for (const f of frames) checker.frame(f);
  } catch {
    // The verdict carries the first refusal.
  }
  return checker.verdict();
}

describe("frame checker", () => {
  it("accepts one StructuredOutput call whose input is the structured_output", () => {
    expect(run(rawFrames())).toEqual({ kind: "accepted", structuredOutput: answer });
  });

  it("refuses another session, model or version, and malformed frames", () => {
    const frames = rawFrames();
    expect(run([{ ...frames[0], model: "other" }])).toEqual({
      kind: "refused",
      reason: "init-model-mismatch",
    });
    expect(run([{ ...frames[0], claude_code_version: "2.1.286" }])).toEqual({
      kind: "refused",
      reason: "init-version-mismatch",
    });
    expect(run([{ ...frames[0], session_id: "x" }])).toEqual({
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
    frames[3].is_error = true;
    expect(run(frames)).toEqual({ kind: "failed" });
  });

  // Codex review 1: a tool call in a frame other than the assistant message was not seen.
  it.each([
    [
      "a stream_event content_block_start",
      {
        type: "stream_event",
        session_id: SESSION,
        event: { type: "content_block_start", content_block: { type: "tool_use", name: "Bash" } },
      },
      "unexpected-frame",
    ],
    [
      "a tool_use nested in a user frame",
      {
        type: "user",
        session_id: SESSION,
        message: {
          content: [{ type: "tool_result", content: [{ type: "tool_use", name: "Bash" }] }],
        },
      },
      "tool-name-mismatch",
    ],
    [
      "a server_tool_use nested in an assistant block",
      {
        type: "assistant",
        session_id: SESSION,
        message: { content: [{ type: "text", extra: { type: "server_tool_use", name: "web" } }] },
      },
      "tool-name-mismatch",
    ],
    [
      "a tool input delta in a status frame",
      {
        type: "system",
        subtype: "status",
        session_id: SESSION,
        event: { type: "content_block_delta", delta: { type: "input_json_delta" } },
      },
      "tool-name-mismatch",
    ],
    [
      "a rate_limit_event with a tool",
      { type: "rate_limit_event", session_id: SESSION, info: { type: "mcp_tool_use", name: "x" } },
      "tool-name-mismatch",
    ],
  ])("refuses %s before a valid call", (_, hidden, reason) => {
    const frames: unknown[] = rawFrames();
    frames.splice(1, 0, hidden);
    expect(run(frames)).toEqual({ kind: "refused", reason });
    // The cut trace keeps enough for replay to refuse it the same way.
    expect(replayCorrespondenceTrace(traceFromFrames(frames), PINNED)).toEqual({
      kind: "refused",
      reason,
    });
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
        model: MODEL,
        claude_code_version: VERSION,
        tools: ["StructuredOutput"],
        mcp_servers: { count: 0, empty: true },
        slash_commands: { count: 0, empty: true },
        agents: { count: 0, empty: true },
        skills: { count: 0, empty: true },
        plugins: { count: 0, empty: true },
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
      {
        type: "result",
        subtype: "success",
        is_error: false,
        has_structured_output: true,
        structured_output: answer,
      },
    ]);
  });

  // Codex review 4 and Claude review 7: tool input, names and answers leaked into traces.
  it("never copies tool input, list names or an unaccepted answer", () => {
    const frames = rawFrames();
    Object.assign(frames[0], {
      tools: ["StructuredOutput", "PrivateTool"],
      mcp_servers: [{ name: "private-server", status: "connected" }],
      slash_commands: ["private-command"],
    });
    (frames[1].message as { content: unknown[] }).content.push({
      type: "tool_use",
      name: "Bash",
      input: { command: "cat ~/SECRET-TOKEN" },
    });
    for (const options of [{}, { acceptedAnswer: answer }]) {
      const text = serializeCorrespondenceTrace(traceFromFrames(frames, options));
      for (const leaked of ["SECRET-TOKEN", "PrivateTool", "private-server", "private-command"])
        expect(text).not.toContain(leaked);
    }
    const refused = traceFromFrames(frames);
    expect(init(refused).tools).toEqual({
      count: 2,
      sha256: sha(["PrivateTool", "StructuredOutput"].join("\n")),
    });
    expect(init(refused).mcp_servers).toEqual({ count: 1, empty: false });
    // Without an accepted answer, neither the call's input nor structured_output is kept.
    expect(serializeCorrespondenceTrace(traceFromFrames(rawFrames()))).not.toContain("Received.");
    expect(result(traceFromFrames(rawFrames()))).toEqual({
      type: "result",
      subtype: "success",
      is_error: false,
      has_structured_output: true,
    });
  });

  it("refuses a trace of the wrong format", () => {
    expect(replayCorrespondenceTrace({ ...synthetic(), format: "v0" }, PINNED)).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
    expect(replayCorrespondenceTrace({ ...synthetic(), extra: 1 }, PINNED)).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
  });

  it("checks the model and version against the plan, not against the trace's own init", () => {
    expect(replayCorrespondenceTrace(synthetic(), { ...PINNED, model: "other" })).toEqual({
      kind: "refused",
      reason: "init-model-mismatch",
    });
    expect(replayCorrespondenceTrace(synthetic(), { ...PINNED, nativeVersion: "2.1.400" })).toEqual(
      { kind: "refused", reason: "init-version-mismatch" },
    );
  });

  it.each(traces)("replays %s through the real checker as accepted", (_, trace, pin) => {
    expect(replayCorrespondenceTrace(trace, pin).kind).toBe("accepted");
    expect(checkCorrespondenceTraceBytes(serializeCorrespondenceTrace(trace), pin)).toBeUndefined();
  });

  describe.each(traces)("mutations of %s", (_, trace, pin) => {
    it.each(mutations)("refuses %s", (__, mutate, reason) => {
      const t = clone(trace);
      mutate(t);
      expect(replayCorrespondenceTrace(t, pin)).toEqual({ kind: "refused", reason });
    });
  });
});

describe("correspondence allowlist", () => {
  const profile = (nativeVersion: string, binarySHA256 = "b".repeat(64), model = MODEL) => ({
    provider: "claude-code" as const,
    nativeVersion,
    binarySHA256,
    model,
  });
  const fixture = (run: (dir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), "trace-fixture-"));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const traceFor = (version: string, model = MODEL) => {
    const frames = rawFrames();
    Object.assign(frames[0], { claude_code_version: version, model });
    return serializeCorrespondenceTrace(synthetic(frames));
  };

  it("refuses 2.1.286 and 2.1.308 until their traces are committed", () => {
    for (const v of ["2.1.286", "2.1.308"])
      if (!CLAUDE_CORRESPONDENCE_QUALIFIED.some((e) => e.nativeVersion === v))
        expect(() => checkCorrespondenceQualification(profile(v))).toThrow(
          "native-profile-unqualified",
        );
  });

  it("pins every allowlisted version to a committed trace with the same hash", () => {
    let checked = 0;
    for (const entry of CLAUDE_CORRESPONDENCE_QUALIFIED) {
      const bytes = readFileSync(correspondenceTracePath(entry.nativeVersion));
      const trace = JSON.parse(bytes.toString()) as CorrespondenceTrace;
      expect(sha(bytes)).toBe(entry.traceSHA256);
      expect(
        checkCorrespondenceTraceBytes(bytes, {
          model: modelOf(trace),
          nativeVersion: entry.nativeVersion,
        }),
      ).toBeUndefined();
      checked += 1;
    }
    // The loop must not pass vacuously once the list has entries.
    expect(checked).toBe(CLAUDE_CORRESPONDENCE_QUALIFIED.length);
    if (CLAUDE_CORRESPONDENCE_QUALIFIED.length) expect(checked).toBeGreaterThan(0);
  });

  it("qualifies a version only with its binary hash and a matching, accepted trace", () =>
    fixture((dir) => {
      const text = traceFor("9.9.9");
      writeFileSync(join(dir, "9.9.9.trace.json"), text);
      const entry = {
        nativeVersion: "9.9.9",
        binarySHA256: "b".repeat(64),
        traceSHA256: sha(text),
      };
      expect(() => checkCorrespondenceQualification(profile("9.9.9"), [entry], dir)).not.toThrow();
      for (const [p, e] of [
        [profile("9.9.9", "c".repeat(64)), entry],
        [profile("9.9.9"), { ...entry, traceSHA256: "0".repeat(64) }],
        [profile("9.9.9", "b".repeat(64), "other-model"), entry],
      ] as const)
        expect(() => checkCorrespondenceQualification(p, [e], dir)).toThrow(
          "native-profile-unqualified",
        );
    }));

  it("refuses an allowlisted version whose trace is missing, and only for that reason", () =>
    fixture((dir) => {
      const text = traceFor("9.9.9");
      const entry = {
        nativeVersion: "9.9.9",
        binarySHA256: "b".repeat(64),
        traceSHA256: sha(text),
      };
      expect(() => checkCorrespondenceQualification(profile("9.9.9"), [entry], dir)).toThrow(
        "native-profile-unqualified",
      );
      writeFileSync(join(dir, "9.9.9.trace.json"), text);
      expect(() => checkCorrespondenceQualification(profile("9.9.9"), [entry], dir)).not.toThrow();
    }));

  // Claude review 2: a trace was not bound to a version, a model or a real recording.
  it("refuses a trace copied or renamed to another version", () =>
    fixture((dir) => {
      const text = traceFor("2.1.308");
      writeFileSync(join(dir, "2.1.400.trace.json"), text);
      const copied = {
        nativeVersion: "2.1.400",
        binarySHA256: "b".repeat(64),
        traceSHA256: sha(text),
      };
      expect(() => checkCorrespondenceQualification(profile("2.1.400"), [copied], dir)).toThrow(
        "native-profile-unqualified",
      );
      const synthetic999 = traceFor("9.9.9");
      writeFileSync(join(dir, "9.9.8.trace.json"), synthetic999);
      const reused = {
        nativeVersion: "9.9.8",
        binarySHA256: "b".repeat(64),
        traceSHA256: sha(synthetic999),
      };
      expect(() => checkCorrespondenceQualification(profile("9.9.8"), [reused], dir)).toThrow(
        "native-profile-unqualified",
      );
    }));

  it("refuses a committed trace that no longer replays, even with a matching hash", () =>
    fixture((dir) => {
      const bad = JSON.parse(traceFor("9.9.7")) as CorrespondenceTrace;
      callOf(bad).name = "Bash";
      const badText = serializeCorrespondenceTrace(bad);
      writeFileSync(join(dir, "9.9.7.trace.json"), badText);
      expect(() =>
        checkCorrespondenceQualification(
          profile("9.9.7"),
          [{ nativeVersion: "9.9.7", binarySHA256: "b".repeat(64), traceSHA256: sha(badText) }],
          dir,
        ),
      ).toThrow("native-profile-unqualified");
    }));

  it("requires the trace to answer the fixed qualification packet", () => {
    const t = clone(synthetic());
    for (const o of [callOf(t).input, result(t).structured_output] as Array<
      Record<string, unknown>
    >)
      o.packetDigest = "0".repeat(64);
    expect(checkCorrespondenceTraceBytes(serializeCorrespondenceTrace(t), PINNED)).toBe(
      "invalid-agent-proposal",
    );
  });
});
