import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
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
  correspondenceGrantRevision,
  qualifiedCorrespondenceVersions,
  correspondenceTracePath,
  createCorrespondenceFrameChecker,
  digest,
  openCorrespondenceEmulation,
  prepareCorrespondenceEmulationPlan,
  prepareCorrespondencePlan,
  prepareCorrespondenceQualificationPlan,
  qualifyClaudeCorrespondenceEmulation,
  replayCorrespondenceTrace,
  replayEmulatedCorrespondenceTrace,
  serializeCorrespondenceTrace,
  traceFromFrames,
  writeCorrespondenceTrace,
} from "../index.js";
import { replaceCorrespondenceAllowlistForTesting } from "../testing.js";
import * as mainEntry from "../index.js";
import * as testingEntry from "../testing.js";
import type { CorrespondenceTrace } from "../index.js";

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const SESSION = "00000000-0000-4000-8000-000000000042";
const MODEL = "claude-model";
const VERSION = "2.1.308";
const BINARY = "b".repeat(64);
const PINNED = { model: MODEL, nativeVersion: VERSION, binarySHA256: BINARY };
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
/**
 * A synthetic trace, cut as qualification cuts an accepted turn. The public API can only make it
 * "emulated", so it replays only through replayEmulatedCorrespondenceTrace and the gate refuses it.
 */
const synthetic = (frames = rawFrames()): CorrespondenceTrace =>
  traceFromFrames(frames, { binarySHA256: BINARY, acceptedAnswer: answer });

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
  [
    "a duplicated output tool",
    (t) => (init(t).tools as string[]).push(CLAUDE_OUTPUT_TOOL),
    "init-tools-mismatch",
  ],
  [
    "an unknown init key",
    (t) => (init(t).unexpected_init_keys = ["capabilities"]),
    "unexpected-init-key",
  ],
  ["a non-boolean is_error", (t) => (result(t).is_error = "non-boolean"), "invalid-result"],
  ["an error result subtype", (t) => (result(t).subtype = "error_max_turns"), "failed"],
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
type Pin = { model: string; nativeVersion: string; binarySHA256: string };
/** A committed trace's pin comes from its allowlist entry, never from the trace itself. */
const pinOf = (version: string): Pin => {
  const entry = CLAUDE_CORRESPONDENCE_QUALIFIED.find((e) => e.nativeVersion === version);
  if (!entry) throw Error(`committed trace ${version} has no allowlist entry`);
  return { model: entry.model, nativeVersion: version, binarySHA256: entry.binarySHA256 };
};
/**
 * The recorded fixture: a reviewed, committed file made once by the internal recorded-trace
 * constructor (the public API cannot make one). Binary "b"×64, model claude-model, version 9.9.9.
 */
const FIXTURE_TEXT = readFileSync(
  join(import.meta.dirname, "fixtures/recorded-9.9.9.trace.json"),
  "utf8",
);
const FIXTURE_PIN: Pin = { model: MODEL, nativeVersion: "9.9.9", binarySHA256: BINARY };
type Replay = typeof replayCorrespondenceTrace;
/** Each trace with its pin and its replay: recorded ones through the real replay. */
const traces: Array<[string, CorrespondenceTrace, Pin, Replay]> = [
  ["synthetic 2.1.308-shaped trace", synthetic(), PINNED, replayEmulatedCorrespondenceTrace],
  ["recorded fixture", JSON.parse(FIXTURE_TEXT), FIXTURE_PIN, replayCorrespondenceTrace],
  ...committed().map(([f, t, , v]): [string, CorrespondenceTrace, Pin, Replay] => [
    f,
    t,
    pinOf(v),
    replayCorrespondenceTrace,
  ]),
];
/** Hand serialization, for refused variants of a recorded trace in tests. */
const handSerialize = (t: unknown) => JSON.stringify(t, null, 2) + "\n";

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

  // Claude review 1 (round 2): any result subtype was accepted.
  it("accepts a proposal only from a success result with is_error false", () => {
    const frames = rawFrames();
    frames[3].subtype = "error_max_turns";
    frames[3].is_error = false;
    expect(run(frames)).toEqual({ kind: "failed" });
  });

  // Codex review 4 (round 2): a non-boolean is_error could carry text into a trace.
  it("refuses a non-boolean is_error, and records it only as non-boolean", () => {
    const frames = rawFrames();
    frames[3].is_error = "SECRET-TOKEN";
    expect(run(frames)).toEqual({ kind: "refused", reason: "invalid-result" });
    const trace = traceFromFrames(frames, { binarySHA256: BINARY });
    expect(result(trace).is_error).toBe("non-boolean");
    expect(serializeCorrespondenceTrace(trace)).not.toContain("SECRET-TOKEN");
    expect(replayEmulatedCorrespondenceTrace(trace, PINNED)).toEqual({
      kind: "refused",
      reason: "invalid-result",
    });
  });

  it("copies only identifier-shaped names and selectors into a trace", () => {
    const frames = rawFrames();
    frames[0].model = "model with SECRET-TOKEN";
    (frames[1].message as { content: Array<Record<string, unknown>> }).content[0].type =
      "text SECRET-TOKEN";
    const text = serializeCorrespondenceTrace(traceFromFrames(frames, { binarySHA256: BINARY }));
    expect(text).not.toContain("SECRET-TOKEN");
    expect(text).toContain('"model": "invalid"');
  });

  // Claude review 2 (round 2): a new init surface would not show.
  it("refuses an unknown init key, and records it in the trace by name only", () => {
    const frames = rawFrames();
    Object.assign(frames[0], { capabilities: ["SECRET-TOKEN"] });
    expect(run(frames)).toEqual({ kind: "refused", reason: "unexpected-init-key" });
    const trace = traceFromFrames(frames, { binarySHA256: BINARY });
    expect(init(trace).unexpected_init_keys).toEqual(["capabilities"]);
    expect(serializeCorrespondenceTrace(trace)).not.toContain("SECRET-TOKEN");
    expect(replayEmulatedCorrespondenceTrace(trace, PINNED)).toEqual({
      kind: "refused",
      reason: "unexpected-init-key",
    });
  });

  // Codex review 5 and Claude review 3 (round 2): a duplicate output tool matched as a set.
  it("refuses a duplicated StructuredOutput, live and in replay", () => {
    const frames = rawFrames();
    frames[0].tools = [CLAUDE_OUTPUT_TOOL, CLAUDE_OUTPUT_TOOL];
    expect(run(frames)).toEqual({ kind: "refused", reason: "init-tools-mismatch" });
    expect(
      replayEmulatedCorrespondenceTrace(traceFromFrames(frames, { binarySHA256: BINARY }), PINNED),
    ).toEqual({ kind: "refused", reason: "init-tools-mismatch" });
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
    expect(
      replayEmulatedCorrespondenceTrace(traceFromFrames(frames, { binarySHA256: BINARY }), PINNED),
    ).toEqual({
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
      const text = serializeCorrespondenceTrace(
        traceFromFrames(frames, { binarySHA256: BINARY, ...options }),
      );
      for (const leaked of ["SECRET-TOKEN", "PrivateTool", "private-server", "private-command"])
        expect(text).not.toContain(leaked);
    }
    const refused = traceFromFrames(frames, { binarySHA256: BINARY });
    expect(init(refused).tools).toEqual({
      count: 2,
      sha256: sha(["PrivateTool", "StructuredOutput"].join("\n")),
    });
    expect(init(refused).mcp_servers).toEqual({ count: 1, empty: false });
    // Without an accepted answer, neither the call's input nor structured_output is kept.
    const plain = traceFromFrames(rawFrames(), { binarySHA256: BINARY });
    expect(serializeCorrespondenceTrace(plain)).not.toContain("Received.");
    expect(result(plain)).toEqual({
      type: "result",
      subtype: "success",
      is_error: false,
      has_structured_output: true,
    });
  });

  it("refuses a trace of the wrong format", () => {
    expect(replayEmulatedCorrespondenceTrace({ ...synthetic(), format: "v0" }, PINNED)).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
    expect(replayEmulatedCorrespondenceTrace({ ...synthetic(), extra: 1 }, PINNED)).toEqual({
      kind: "refused",
      reason: "invalid-frame",
    });
  });

  it("refuses a trace recorded from another binary", () => {
    expect(
      replayEmulatedCorrespondenceTrace(synthetic(), { ...PINNED, binarySHA256: "c".repeat(64) }),
    ).toEqual({ kind: "refused", reason: "binary-mismatch" });
  });

  it("checks the model and version against the plan, not against the trace's own init", () => {
    expect(replayEmulatedCorrespondenceTrace(synthetic(), { ...PINNED, model: "other" })).toEqual({
      kind: "refused",
      reason: "init-model-mismatch",
    });
    expect(
      replayEmulatedCorrespondenceTrace(synthetic(), { ...PINNED, nativeVersion: "2.1.400" }),
    ).toEqual({ kind: "refused", reason: "init-version-mismatch" });
  });

  it.each(traces)("replays %s through the real checker as accepted", (_, trace, pin, replay) => {
    expect(replay(trace, pin).kind).toBe("accepted");
  });

  describe.each(traces)("mutations of %s", (_, trace, pin, replay) => {
    it.each(mutations)("refuses %s", (__, mutate, reason) => {
      const t = clone(trace);
      mutate(t);
      expect(replay(t, pin)).toEqual(
        reason === "failed" ? { kind: "failed" } : { kind: "refused", reason },
      );
    });
  });
});

describe("correspondence allowlist", () => {
  const profile = (nativeVersion: string, binarySHA256 = BINARY, model = MODEL) => ({
    provider: "claude-code" as const,
    nativeVersion,
    binarySHA256,
    model,
  });
  /** The recorded fixture, changed only in ways the gate must refuse. */
  const variant = (change: (t: Record<string, unknown>) => void) => {
    const t = JSON.parse(FIXTURE_TEXT) as Record<string, unknown>;
    change(t);
    return handSerialize(t);
  };
  const entryFor = (version: string, trace = FIXTURE_TEXT) => ({
    nativeVersion: version,
    model: MODEL,
    binarySHA256: BINARY,
    traceSHA256: sha(trace),
    trace,
  });

  it("refuses 2.1.286 and 2.1.308 until their traces are committed", () => {
    for (const v of ["2.1.286", "2.1.308"])
      if (!CLAUDE_CORRESPONDENCE_QUALIFIED.some((e) => e.nativeVersion === v))
        expect(() => checkCorrespondenceQualification(profile(v))).toThrow(
          "native-profile-unqualified",
        );
  });

  // Claude review 5 (round 2) and LocalHelp item 17: the export could be changed at runtime.
  it("is deep-frozen, and the gate reads its own frozen copy", () => {
    expect(Object.isFrozen(CLAUDE_CORRESPONDENCE_QUALIFIED)).toBe(true);
    expect(() =>
      (CLAUDE_CORRESPONDENCE_QUALIFIED as unknown as unknown[]).push(entryFor("9.9.9")),
    ).toThrow();
    expect(() => checkCorrespondenceQualification(profile("9.9.9"))).toThrow(
      "native-profile-unqualified",
    );
    // Only the test-only hook, from the `testing` subpath, replaces it: its versions count for
    // preparing a plan, but the gate refuses every entry it installs.
    const restore = replaceCorrespondenceAllowlistForTesting([entryFor("9.9.9")]);
    try {
      expect(qualifiedCorrespondenceVersions()).toEqual(["9.9.9"]);
      expect(() => checkCorrespondenceQualification(profile("9.9.9"))).toThrow(
        "native-profile-unqualified",
      );
    } finally {
      restore();
    }
    expect(() => checkCorrespondenceQualification(profile("9.9.9"))).toThrow(
      "native-profile-unqualified",
    );
  });

  // LocalHelp item 16: traces travel with the code; the committed files are the reviewed source.
  it("embeds each allowlisted trace byte for byte as committed", () => {
    let checked = 0;
    for (const entry of CLAUDE_CORRESPONDENCE_QUALIFIED) {
      const bytes = readFileSync(correspondenceTracePath(entry.nativeVersion), "utf8");
      expect(entry.trace).toBe(bytes);
      expect(sha(bytes)).toBe(entry.traceSHA256);
      expect(
        checkCorrespondenceTraceBytes(bytes, {
          model: entry.model,
          nativeVersion: entry.nativeVersion,
          binarySHA256: entry.binarySHA256,
        }),
      ).toBeUndefined();
      checked += 1;
    }
    // The loop must not pass vacuously once the list has entries.
    expect(checked).toBe(CLAUDE_CORRESPONDENCE_QUALIFIED.length);
    if (CLAUDE_CORRESPONDENCE_QUALIFIED.length) expect(checked).toBeGreaterThan(0);
    // And every committed trace has its entry.
    for (const [, , , version] of committed()) expect(() => pinOf(version)).not.toThrow();
  });

  it("qualifies a version only with its binary, its model and a matching, accepted trace", () => {
    const entry = entryFor("9.9.9");
    expect(() => checkCorrespondenceQualification(profile("9.9.9"), [entry])).not.toThrow();
    for (const [p, e] of [
      [profile("9.9.9", "c".repeat(64)), entry],
      [profile("9.9.9", BINARY, "other-model"), entry],
      [profile("9.9.9"), { ...entry, model: "other-model" }],
      [profile("9.9.9"), { ...entry, traceSHA256: "0".repeat(64) }],
      [profile("9.9.9"), { ...entry, trace: "" }],
    ] as const)
      expect(() => checkCorrespondenceQualification(p, [e])).toThrow("native-profile-unqualified");
  });

  // Claude reviews 4 and 12 (round 2): traces and entries were not tied together.
  it("refuses a trace recorded from another binary than its entry's", () => {
    // The fixture records binary "b"×64; an entry and profile for binary "c"×64 are refused.
    const c = "c".repeat(64);
    expect(() =>
      checkCorrespondenceQualification(profile("9.9.9", c), [
        { ...entryFor("9.9.9"), binarySHA256: c },
      ]),
    ).toThrow("native-profile-unqualified");
  });

  // Claude review 2: a trace was not bound to a version, a model or a real recording.
  it("refuses a trace copied or renamed to another version", () => {
    // The 9.9.9 recording, listed under other versions.
    for (const version of ["2.1.400", "9.9.8"])
      expect(() => checkCorrespondenceQualification(profile(version), [entryFor(version)])).toThrow(
        "native-profile-unqualified",
      );
  });

  it("refuses an embedded trace that no longer replays, even with a matching hash", () => {
    const badText = variant((t) => (callOf(t as unknown as CorrespondenceTrace).name = "Bash"));
    expect(() =>
      checkCorrespondenceQualification(profile("9.9.9"), [entryFor("9.9.9", badText)]),
    ).toThrow("native-profile-unqualified");
  });

  it("requires the trace to answer the fixed qualification packet", () => {
    const text = variant((raw) => {
      const t = raw as unknown as CorrespondenceTrace;
      for (const o of [callOf(t).input, result(t).structured_output] as Array<
        Record<string, unknown>
      >)
        o.packetDigest = "0".repeat(64);
    });
    expect(checkCorrespondenceTraceBytes(text, FIXTURE_PIN)).toBe("invalid-agent-proposal");
  });
});

/** A well-formed version the shipped allowlist does not list, whatever it lists. */
const UNLISTED = Array.from({ length: 100 }, (_, i) => `0.0.${i + 1}`).find(
  (v) => !CLAUDE_CORRESPONDENCE_QUALIFIED.some((e) => e.nativeVersion === v),
)!;

/** A plan for the shipped package, with the real allowlist (no mocks in this file). */
function shippedPlan(dir: string, nativeVersion = UNLISTED, tmp: string | null = null) {
  const cwd = join(dir, "cwd");
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
        binaryRealPath: "/opt/claude/claude",
        binarySHA256: BINARY,
        nativeVersion,
        model: MODEL,
        effort: "low",
        authMode: "existing-subscription",
        customizationPolicy: "none",
      },
    ],
    bindings: [
      {
        alias: "duty",
        revision: "binding-1",
        deviceId: "yuri",
        provider: "claude-code",
        profileRevision: "claude-1",
        sessionPolicy: "fresh-per-dispatch",
        cwd,
        resources: ["helpdesk:thread:*"],
      },
    ],
    limits: { topLevelTurns: 2, windowMs: 60000, requestTimeoutMs: 120000 },
    supervision: { kind: "owner-attended" },
    environment: { HOME: dir, CODEX_HOME: null, TMPDIR: tmp },
    declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
  };
}
const withDir = async (run: (dir: string) => Promise<void> | void) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "shipped-fixture-")));
  try {
    await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// Codex round 4, item 4: a null TMPDIR left Claude on the shared /tmp.
describe("pinned TMPDIR", () => {
  it("is required for duty and qualification plans, not for emulation", () =>
    withDir((dir) => {
      const listed = { ...shippedPlan(dir) };
      for (const prepare of [prepareCorrespondencePlan, prepareCorrespondenceQualificationPlan])
        expect(() => prepare(listed)).toThrow("tmpdir-required");
      expect(() => prepareCorrespondenceEmulationPlan(shippedPlan(dir))).not.toThrow();
      expect(() =>
        prepareCorrespondenceQualificationPlan(shippedPlan(dir, UNLISTED, dir)),
      ).not.toThrow();
    }));
});

// Claude review 5 (round 2): with the real allowlist the emulation could not run. Codex round 4,
// item 3: these tests must not depend on that allowlist staying empty.
describe("emulation with the shipped allowlist", () => {
  it("runs a duty emulation without a qualified version", () =>
    withDir(async (dir) => {
      expect(() => prepareCorrespondencePlan(shippedPlan(dir, UNLISTED, dir))).toThrow(
        "unqualified-profile",
      );
      const prepared = prepareCorrespondenceEmulationPlan(shippedPlan(dir));
      const run = openCorrespondenceEmulation({
        prepared,
        stateFile: join(dir, "state.sqlite"),
        now: () => 1000,
        script: (_, t) => ({
          kind: "answer",
          answer: { ...answer, packetDigest: t.packetDigest },
        }),
      });
      try {
        const packetText = JSON.stringify({
          kind: "correspondence-packet",
          version: 1,
          duty: { device_id: "yuri", session_id: "duty" },
          request: {
            message_id: "00000000-0000-4000-8000-000000000001",
            thread_id: "00000000-0000-4000-8000-000000000900",
            sequence: 1,
            subject: "Soak",
            sender: { device_id: "yojimbo", session_id: null },
            body: "Hello",
          },
          thread: [],
          omitted: { earlier_messages: 0, truncated_bodies: 0 },
          context_round: { used: 0, limit: 3 },
          best_effort: false,
        });
        const result = await run.dispatcher.dispatch({
          deliveryId: "delivery-1",
          streamId: "00000000-0000-4000-8000-000000000800",
          eventId: "00000000-0000-4000-8000-000000001001",
          messageId: "00000000-0000-4000-8000-000000000001",
          threadId: "00000000-0000-4000-8000-000000000900",
          sequence: 1,
          recipient: "duty",
          bindingRevision: "binding-1",
          charterId: "window-1",
          grantRevision: correspondenceGrantRevision(prepared, "duty"),
          profileRevision: "claude-1",
          workflow: "correspondence",
          resources: ["helpdesk:thread:00000000-0000-4000-8000-000000000900"],
          task: { input: packetText, inputDigest: digest(packetText) },
        });
        expect(result).toMatchObject({ kind: "observed", outcome: "completed" });
        expect(run.dispatcher.status()).toMatchObject({ realProviderCalls: 0 });
      } finally {
        run.dispatcher.close();
      }
    }));

  // LocalHelp item 18: the whole qualification trace path, offline.
  it("proves the qualification trace path offline: record, write, hash and replay", () =>
    withDir(async (dir) => {
      const prepared = prepareCorrespondenceQualificationPlan(shippedPlan(dir, "9.9.9", dir));
      const result = await qualifyClaudeCorrespondenceEmulation({
        prepared,
        stateFile: join(dir, "emulated.sqlite"),
        now: () => 1000,
        frames: (_, turn) =>
          rawFrames().map((f) => ({
            ...f,
            session_id: turn.nativeSessionId,
            ...(f.type === "system" ? { claude_code_version: "9.9.9" } : {}),
          })),
      });
      if (result.kind !== "ran") throw Error("not run: " + JSON.stringify(result));
      expect(result.verdict).toBe("accepted");
      const out = join(dir, "9.9.9.trace.json");
      writeCorrespondenceTrace(out, result.traceText);
      expect(statSync(out).mode & 0o777).toBe(0o600);
      const bytes = readFileSync(out, "utf8");
      expect(sha(bytes)).toBe(result.traceSHA256);
      expect(() => writeCorrespondenceTrace(out, result.traceText)).toThrow();
      // Claude round 4, item 1: an emulated run proves the mechanics, never a version.
      expect(result.allowlistEntry).toBeUndefined();
      expect(JSON.parse(bytes).source).toBe("emulated");
      const pin = { model: MODEL, nativeVersion: "9.9.9", binarySHA256: BINARY };
      expect(replayCorrespondenceTrace(JSON.parse(bytes), pin)).toEqual({
        kind: "refused",
        reason: "emulated-trace",
      });
      expect(checkCorrespondenceTraceBytes(bytes, pin)).toBe("emulated-trace");
      // Only the explicit emulation replay accepts it.
      expect(replayEmulatedCorrespondenceTrace(JSON.parse(bytes), pin).kind).toBe("accepted");
      // A hand-made entry around the emulated bytes is refused by the real gate.
      expect(() =>
        checkCorrespondenceQualification(profile999(), [
          { ...pin, traceSHA256: result.traceSHA256, trace: bytes },
        ]),
      ).toThrow("native-profile-unqualified");
      // And relabelling it as recorded breaks the pinned hash.
      const relabelled = bytes.replace('"source": "emulated"', '"source": "recorded"');
      expect(() =>
        checkCorrespondenceQualification(profile999(), [
          { ...pin, traceSHA256: result.traceSHA256, trace: relabelled },
        ]),
      ).toThrow("native-profile-unqualified");
    }));

  it("reports a refused emulated qualification with no answer in the trace", () =>
    withDir(async (dir) => {
      const prepared = prepareCorrespondenceQualificationPlan(shippedPlan(dir, "9.9.9", dir));
      const result = await qualifyClaudeCorrespondenceEmulation({
        prepared,
        stateFile: join(dir, "emulated.sqlite"),
        now: () => 1000,
        frames: (_, turn) => {
          const frames: Array<Record<string, unknown>> = rawFrames().map((f) => ({
            ...f,
            session_id: turn.nativeSessionId,
            ...(f.type === "system" ? { claude_code_version: "9.9.9" } : {}),
          }));
          frames.splice(1, 0, {
            type: "user",
            session_id: turn.nativeSessionId,
            message: {
              content: [{ type: "tool_use", name: "Bash", input: { c: "SECRET-TOKEN" } }],
            },
          });
          return frames;
        },
      });
      expect(result).toMatchObject({
        kind: "ran",
        turnRefusal: "tool-name-mismatch",
        replayRefusal: "tool-name-mismatch",
        verdict: { refused: "tool-name-mismatch" },
        allowlistEntry: undefined,
      });
      if (result.kind === "ran") {
        expect(result.traceText).not.toContain("SECRET-TOKEN");
        expect(result.traceText).not.toContain("Received.");
      }
    }));
});
const profile999 = () => ({
  provider: "claude-code" as const,
  nativeVersion: "9.9.9",
  binarySHA256: BINARY,
  model: MODEL,
});

// Codex round 5: a "recorded" trace could be forged through the public traceFromFrames.
// Covers the package's exports and serializer only: trace bytes carry no proof of origin, and
// hand-written bytes are outside what any code check can stop (see "Trust boundary").
describe("the package API never builds recorded trace bytes", () => {
  /** Reviewed: any new export must be added here, and checked against this rule. */
  const MAIN_EXPORTS = [
    "ADVISORY_OUTPUT_SCHEMA",
    "CLAUDE_CORRESPONDENCE_QUALIFIED",
    "CLAUDE_OUTPUT_TOOL",
    "CORRESPONDENCE_ALLOWED_FRAMES",
    "CORRESPONDENCE_INIT_KEYS",
    "CORRESPONDENCE_INSTRUCTIONS_V2",
    "CORRESPONDENCE_INSTRUCTIONS_V2_SHA256",
    "CORRESPONDENCE_MAX_TURNS",
    "CORRESPONDENCE_MAX_WINDOW_MS",
    "CORRESPONDENCE_OUTPUT_SCHEMA",
    "CORRESPONDENCE_PACKET_MAX_BYTES",
    "CORRESPONDENCE_QUALIFICATION_PACKET",
    "CORRESPONDENCE_QUALIFICATION_PACKET_SHA256",
    "CORRESPONDENCE_REQUEST_TIMEOUT_MS",
    "CORRESPONDENCE_TEXT_MAX_BYTES",
    "CORRESPONDENCE_TRACE_DIRECTORY",
    "CORRESPONDENCE_TRACE_FORMAT",
    "CORRESPONDENCE_TURN_MARKER",
    "CORRESPONDENCE_WATCHDOG_SOURCE",
    "SUBSCRIPTION_CANARY_FIXTURE",
    "SUBSCRIPTION_CANARY_FIXTURE_SHA256",
    "canaryGrantRevision",
    "checkCorrespondenceQualification",
    "checkCorrespondenceTraceBytes",
    "claudeResumeArgs",
    "correspondenceCommand",
    "correspondenceGrantRevision",
    "correspondenceInput",
    "correspondenceTracePath",
    "correspondenceWatchdogArgs",
    "createCorrespondenceEmulator",
    "createCorrespondenceFrameChecker",
    "createCorrespondenceFrameEmulator",
    "createQualificationTransport",
    "decide",
    "digest",
    "findTurnProcesses",
    "openApprovedSubscriptionCanary",
    "openCanaryQualification",
    "openCorrespondenceEmulation",
    "openCorrespondenceWindow",
    "openDispatcher",
    "openSupervisedSubscriptionCanary",
    "parseCanaryProposal",
    "parseCorrespondenceAnswer",
    "parseCorrespondencePacket",
    "parseDispatchRequest",
    "prepareCorrespondenceEmulationPlan",
    "prepareCorrespondencePlan",
    "prepareCorrespondenceQualificationPlan",
    "prepareSubscriptionCanary",
    "prepareSupervisedSubscriptionCanary",
    "qualifiedCorrespondenceVersions",
    "qualifyClaudeCorrespondence",
    "qualifyClaudeCorrespondenceEmulation",
    "replayCorrespondenceTrace",
    "replayEmulatedCorrespondenceTrace",
    "reviewCorrespondenceJournal",
    "serializeCorrespondenceTrace",
    "spawnCorrespondenceWatchdog",
    "subscriptionCanaryCommand",
    "traceFromFrames",
    "writeCorrespondenceTrace",
  ].sort();

  it("exports exactly the reviewed names, and no recorded-trace constructor", () => {
    expect(Object.keys(mainEntry).sort()).toEqual(MAIN_EXPORTS);
    expect(Object.keys(testingEntry).sort()).toEqual(["replaceCorrespondenceAllowlistForTesting"]);
    for (const key of [...Object.keys(mainEntry), ...Object.keys(testingEntry)])
      expect(key).not.toMatch(/recorded/i);
  });

  it("package serializer only: public builders yield emulated traces, which the gate refuses", () => {
    const trace = traceFromFrames(rawFrames(), { binarySHA256: BINARY, acceptedAnswer: answer });
    expect(trace.source).toBe("emulated");
    const text = serializeCorrespondenceTrace(trace);
    const entry = {
      nativeVersion: VERSION,
      model: MODEL,
      binarySHA256: BINARY,
      traceSHA256: sha(text),
      trace: text,
    };
    expect(() => checkCorrespondenceQualification(PINNED_PROFILE, [entry])).toThrow(
      "native-profile-unqualified",
    );
    // Relabelling the object does not get it serialized as recorded.
    expect(() => serializeCorrespondenceTrace({ ...trace, source: "recorded" })).toThrow(
      "trace-not-recorded",
    );
  });

  it("never accepts an entry installed through the testing hook", () => {
    const entry = {
      ...FIXTURE_PIN,
      traceSHA256: sha(FIXTURE_TEXT),
      trace: FIXTURE_TEXT,
    };
    // The reviewed fixture itself passes the gate as an explicit, committed entry...
    const fixtureProfile = { provider: "claude-code" as const, ...FIXTURE_PIN };
    expect(() => checkCorrespondenceQualification(fixtureProfile, [entry])).not.toThrow();
    // ...but not once installed through the hook.
    const restore = replaceCorrespondenceAllowlistForTesting([entry]);
    try {
      expect(() => checkCorrespondenceQualification(fixtureProfile)).toThrow(
        "native-profile-unqualified",
      );
    } finally {
      restore();
    }
  });

  it("builds recorded traces only on the real qualification path", () => {
    const src = join(import.meta.dirname, "..");
    const callers = readdirSync(src)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => readFileSync(join(src, f), "utf8").includes("recordedTraceFromFrames("));
    expect(callers.sort()).toEqual(["correspondence-frames.ts", "correspondence.ts"]);
    const body = readFileSync(join(src, "correspondence.ts"), "utf8");
    expect(body.match(/recordedTraceFromFrames\(/g)).toHaveLength(1);
    expect(body.match(/runQualificationTurn\([^)]*"recorded"\)/g)).toHaveLength(1);
  });
});
// Final Codex check: two in-process bypasses of the recorded-trace lock.
describe("package serializer and hook: recorded-trace lock", () => {
  const emulated = () =>
    traceFromFrames(rawFrames(), { binarySHA256: BINARY, acceptedAnswer: answer });
  const gateRefuses = (text: string) => {
    const entry = { ...PINNED, traceSHA256: sha(text), trace: text };
    expect(() => checkCorrespondenceQualification(PINNED_PROFILE, [entry])).toThrow(
      "native-profile-unqualified",
    );
  };

  it("serializes a snapshot, so toJSON cannot relabel a trace as recorded", () => {
    const t = emulated();
    const forged = Object.assign({}, t, { toJSON: () => ({ ...t, source: "recorded" }) });
    const text = serializeCorrespondenceTrace(forged);
    expect(JSON.parse(text).source).toBe("emulated");
    gateRefuses(text);
  });

  it("reads source once, so a changing getter cannot relabel a trace", () => {
    const t = emulated();
    let reads = 0;
    const forged = { ...t } as Record<string, unknown>;
    Object.defineProperty(forged, "source", {
      get: () => (reads++ === 0 ? "emulated" : "recorded"),
      enumerable: true,
    });
    const text = serializeCorrespondenceTrace(forged as unknown as CorrespondenceTrace);
    expect(reads).toBe(1);
    expect(JSON.parse(text).source).toBe("emulated");
    gateRefuses(text);
    // A getter that says "recorded" from the start is not a recorded trace either.
    const always = { ...t } as Record<string, unknown>;
    Object.defineProperty(always, "source", { get: () => "recorded", enumerable: true });
    expect(() => serializeCorrespondenceTrace(always as unknown as CorrespondenceTrace)).toThrow(
      "trace-not-recorded",
    );
  });

  it("refuses functions and proxies in a trace", () => {
    const t = emulated();
    expect(() => serializeCorrespondenceTrace({ ...t, frames: [{ toJSON: () => ({}) }] })).toThrow(
      "invalid-trace",
    );
    expect(() => serializeCorrespondenceTrace(new Proxy(t, {}))).not.toThrow();
    expect(() =>
      serializeCorrespondenceTrace({ ...t, frames: new Proxy([], {}) as unknown[] }),
    ).toThrow("invalid-trace");
  });

  it("keeps the gate on the shipped allowlist, whatever the hook is given", () => {
    const entry = { ...FIXTURE_PIN, traceSHA256: sha(FIXTURE_TEXT), trace: FIXTURE_TEXT };
    const fixtureProfile = { provider: "claude-code" as const, ...FIXTURE_PIN };
    // A caller array whose own `map` hands back unmarked, gate-acceptable copies.
    const hostile = [entry];
    Object.defineProperty(hostile, "map", { value: () => [{ ...entry }] });
    const restore = replaceCorrespondenceAllowlistForTesting(hostile);
    try {
      expect(qualifiedCorrespondenceVersions()).toEqual(["9.9.9"]);
      expect(() => checkCorrespondenceQualification(fixtureProfile)).toThrow(
        "native-profile-unqualified",
      );
    } finally {
      restore();
    }
  });
});
const PINNED_PROFILE = { provider: "claude-code" as const, ...PINNED };
