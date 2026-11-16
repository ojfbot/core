import { createHash } from "node:crypto";

/**
 * Claude's correspondence frame contract. With `--json-schema`, Claude Code exposes exactly one
 * built-in output tool; the turn must call it once, and its input must be the result's
 * `structured_output`. Everything else about the frames is refused. Correspondence only: the
 * advisory canary and supervised transports keep their own unchanged checks.
 */

/** The single built-in tool Claude Code uses to return a `--json-schema` answer. */
export const CLAUDE_OUTPUT_TOOL = "StructuredOutput";

/**
 * Fail closed on frames: every frame's `type` (or `type/subtype`) must be listed here. Every
 * allowed frame is still searched, at any depth, for tool use.
 */
export const CORRESPONDENCE_ALLOWED_FRAMES: readonly string[] = [
  "system/init",
  "system/status",
  "system/api_retry",
  "rate_limit_event",
  "assistant",
  "user",
  "result/success",
  "result/error_during_execution",
  "result/error_max_turns",
  "result/error_max_budget_usd",
  "result/error_max_structured_output_retries",
];

/** Why a frame stream was refused. Each one ends the turn as unknown with no proposal. */
export type CorrespondenceFrameRefusal =
  | "invalid-frame"
  | "unexpected-frame"
  | "wrong-session"
  | "frame-before-init"
  | "init-repeated"
  | "init-model-mismatch"
  | "init-version-mismatch"
  | "init-tools-mismatch"
  | "init-surface-not-empty"
  | "unexpected-init-key"
  | "invalid-result"
  | "frame-after-result"
  | "tool-name-mismatch"
  | "tool-second-call"
  | "tool-call-without-output"
  | "output-without-tool-call"
  | "tool-input-mismatch"
  | "no-tool-call"
  | "no-result"
  /** Replay only: the trace was recorded from another binary than the one pinned. */
  | "binary-mismatch"
  /** Replay for allowlisting only: the trace came from an emulation, not a real recording. */
  | "emulated-trace";

/** A frame refusal, or a process-level reason the native turn could not be accepted. */
export type CorrespondenceTurnRefusal =
  | CorrespondenceFrameRefusal
  | "output-overflow"
  | "deadline"
  | "aborted"
  | "exit-nonzero"
  | "trailing-output"
  | "process-error"
  | "descendant-escaped"
  | "stop-unconfirmed";

export type CorrespondenceFrameVerdict =
  | { kind: "accepted"; structuredOutput: unknown }
  | { kind: "failed" }
  | { kind: "refused"; reason: CorrespondenceFrameRefusal };

export class CorrespondenceFrameError extends Error {
  constructor(readonly reason: CorrespondenceFrameRefusal) {
    super(reason);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Init lists that must be empty whenever Claude reports them, besides `mcp_servers`. */
const INIT_SURFACES = [
  "slash_commands",
  "terminal_slash_commands",
  "agents",
  "skills",
  "plugins",
] as const;
const INIT_LISTS = ["mcp_servers", ...INIT_SURFACES] as const;
/**
 * Every key Claude Code 2.1.308's init frame may carry. Any other key (a new surface in a later
 * version, or a conditional one such as `plugin_errors`, `mcp_server_errors` or `capabilities`)
 * refuses the turn, so it shows up in qualification and needs a reviewed change here.
 */
export const CORRESPONDENCE_INIT_KEYS: readonly string[] = [
  "type",
  "subtype",
  "session_id",
  "cwd",
  "uuid",
  "model",
  "claude_code_version",
  "tools",
  ...INIT_LISTS,
  "permissionMode",
  "apiKeySource",
  "betas",
  "output_style",
  "analytics_disabled",
  "product_feedback_disabled",
];

function frameKind(m: Record<string, unknown>): string | undefined {
  if (typeof m.type !== "string") return undefined;
  return typeof m.subtype === "string" ? `${m.type}/${m.subtype}` : m.type;
}

/**
 * Anything that is, or streams, a tool call: a `tool_use`, `server_tool_use`, `mcp_tool_use` or
 * other `*tool_use` block (a `content_block_start` carries one as its `content_block`), and a
 * `content_block_delta` whose delta streams tool input.
 */
function toolLike(node: Record<string, unknown>): boolean {
  if (typeof node.type === "string" && node.type.endsWith("tool_use")) return true;
  return (
    node.type === "content_block_delta" &&
    record(node.delta) &&
    typeof node.delta.type === "string" &&
    /json|tool/.test(node.delta.type)
  );
}

/** Visits every tool-like object anywhere in a value. Too deep a value is malformed. */
function scanTools(
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
  depth = 0,
): void {
  if (depth > 64) throw new CorrespondenceFrameError("invalid-frame");
  if (Array.isArray(value)) for (const v of value) scanTools(v, visit, depth + 1);
  else if (record(value)) {
    if (toolLike(value)) visit(value);
    for (const v of Object.values(value)) scanTools(v, visit, depth + 1);
  }
}

/** Structural equality of JSON values; object key order does not matter. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => jsonEqual(v, b[i]))
    );
  if (!record(a) || !record(b)) return false;
  const ka = Object.keys(a).sort(),
    kb = Object.keys(b).sort();
  return ka.join("\0") === kb.join("\0") && ka.every((k) => jsonEqual(a[k], b[k]));
}

export interface CorrespondenceFrameChecker {
  /** Checks one parsed frame. Throws CorrespondenceFrameError at the first violation, and after. */
  frame(frame: unknown): void;
  /** True once a result frame was accepted. */
  terminal(): boolean;
  /** The verdict for the whole stream so far. Call it after the stream ends. */
  verdict(): CorrespondenceFrameVerdict;
}

/** What the checker expects, from the pinned plan profile (never from the frames themselves). */
export interface CorrespondenceFrameExpectation {
  sessionId: string;
  model: string;
  nativeVersion: string;
}

/** The one frame checker. The live transport, trace replay and qualification all use it. */
export function createCorrespondenceFrameChecker(
  expected: CorrespondenceFrameExpectation,
): CorrespondenceFrameChecker {
  let initialized = false,
    calls = 0,
    refused: CorrespondenceFrameRefusal | undefined,
    call: { input: unknown } | undefined,
    result: Record<string, unknown> | undefined;
  const refuse = (reason: CorrespondenceFrameRefusal): never => {
    refused ??= reason;
    throw new CorrespondenceFrameError(refused);
  };
  return {
    frame(m) {
      if (refused) refuse(refused);
      if (!record(m)) return refuse("invalid-frame");
      if (result) refuse("frame-after-result");
      const kind = frameKind(m);
      if (kind === undefined || !CORRESPONDENCE_ALLOWED_FRAMES.includes(kind))
        refuse("unexpected-frame");
      if (m.session_id !== expected.sessionId) refuse("wrong-session");
      if (kind === "system/init") {
        if (initialized) refuse("init-repeated");
        if (Object.keys(m).some((k) => !CORRESPONDENCE_INIT_KEYS.includes(k)))
          refuse("unexpected-init-key");
        if (m.model !== expected.model) refuse("init-model-mismatch");
        if (m.claude_code_version !== expected.nativeVersion) refuse("init-version-mismatch");
        // Exactly one tool, the output tool; a duplicate is refused too.
        if (!Array.isArray(m.tools) || m.tools.length !== 1 || m.tools[0] !== CLAUDE_OUTPUT_TOOL)
          refuse("init-tools-mismatch");
        if (!Array.isArray(m.mcp_servers) || m.mcp_servers.length) refuse("init-surface-not-empty");
        for (const key of INIT_SURFACES)
          if (key in m && !(Array.isArray(m[key]) && (m[key] as unknown[]).length === 0))
            refuse("init-surface-not-empty");
      } else if (!initialized) refuse("frame-before-init");
      if (kind === "assistant" && (!record(m.message) || !Array.isArray(m.message.content)))
        refuse("invalid-frame");
      // The one legitimate position for the call: a direct content block of an assistant frame.
      const direct: unknown[] =
        kind === "assistant" ? ((m.message as Record<string, unknown>).content as unknown[]) : [];
      scanTools(m, (node) => {
        calls += 1;
        if (calls > 1) refuse("tool-second-call");
        if (!direct.includes(node) || node.type !== "tool_use" || node.name !== CLAUDE_OUTPUT_TOOL)
          refuse("tool-name-mismatch");
        call = { input: node.input };
      });
      if (kind === "system/init") initialized = true;
      if (kind?.startsWith("result/")) {
        if (typeof m.is_error !== "boolean") refuse("invalid-result");
        result = m;
      }
    },
    terminal: () => result !== undefined,
    verdict() {
      if (refused) return { kind: "refused", reason: refused };
      if (!result) return { kind: "refused", reason: "no-result" };
      // A proposal only from a successful result.
      if (result.subtype !== "success" || result.is_error !== false) return { kind: "failed" };
      const output = result.structured_output;
      const has = output !== undefined && output !== null;
      if (!call && !has) return { kind: "refused", reason: "no-tool-call" };
      if (!call) return { kind: "refused", reason: "output-without-tool-call" };
      if (!has) return { kind: "refused", reason: "tool-call-without-output" };
      if (!jsonEqual(call.input, output)) return { kind: "refused", reason: "tool-input-mismatch" };
      return { kind: "accepted", structuredOutput: output };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Trace format: a cut-down frame list of one correspondence turn, committed per Claude version.

export const CORRESPONDENCE_TRACE_FORMAT = "claude-correspondence-trace-v3";
export interface CorrespondenceTrace {
  format: typeof CORRESPONDENCE_TRACE_FORMAT;
  /**
   * "recorded" for a real Claude turn, "emulated" for scripted frames. It is part of the hashed
   * bytes, so an emulated trace cannot be relabelled without changing its SHA-256.
   */
  source: "recorded" | "emulated";
  /** SHA-256 of the pinned binary that produced the trace. */
  binary_sha256: string;
  frames: unknown[];
}
const TRACE_MAX_FRAMES = 1000;
/** Session placeholder used when replaying: traces keep no session, account or usage data. */
const REPLAY_SESSION = "00000000-0000-4000-8000-000000000000";

/** A frame, block or key name: copied only if it is a plain identifier, otherwise "invalid". */
function name(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(value) ? value : "invalid";
}
/** A model selector or version string: copied only in its expected shape, otherwise "invalid". */
function selector(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9._[\]-]{1,128}$/.test(value) ? value : "invalid";
}
/** `is_error` is copied only as a boolean. */
function flag(value: unknown): boolean | "non-boolean" {
  return typeof value === "boolean" ? value : "non-boolean";
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** A tool-like block, reduced to its type and name. Never its input. */
function toolSummary(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { type: name(node.type) ?? null };
  if (node.name !== undefined) out.name = name(node.name);
  // A streamed tool-input delta keeps only its delta type, so replay still sees it as tool use.
  if (node.type === "content_block_delta" && record(node.delta))
    out.delta = { type: name(node.delta.type) ?? null };
  return out;
}

/**
 * Cuts raw parsed stream-json frames down to what the checker reads, and nothing private. Only a
 * closed set of fields is copied, and each only in its expected shape (names as identifiers,
 * `is_error` as a boolean, otherwise "invalid" or "non-boolean"):
 * - every frame keeps `type` and `subtype`;
 * - `system/init` keeps `model` and `claude_code_version`; `tools` keeps its names only when it is
 *   exactly `["StructuredOutput"]`, otherwise `{count, sha256}` of the sorted names; every other
 *   init list keeps only `{count, empty}`; an unknown init key is kept by name only, in
 *   `unexpected_init_keys`;
 * - an assistant frame keeps each content block's `type`, and a tool block's `name`;
 * - a result keeps `is_error` and whether it has `structured_output`;
 * - tool use found anywhere else in a frame is kept as `nested_tool_uses` (type and name).
 * Tool input and `structured_output` are copied only for `acceptedAnswer`: the single accepted
 * StructuredOutput call, after it passed parseCorrespondenceAnswer.
 */
export function traceFromFrames(
  frames: readonly unknown[],
  options: { binarySHA256: string; acceptedAnswer?: unknown },
): CorrespondenceTrace {
  // Public: only ever an emulated trace. The gate refuses it.
  return cutTrace(frames, options, "emulated");
}

/** Traces built by recordedTraceFromFrames; only these may be serialized as "recorded". */
const recordedTraces = new WeakSet<object>();

/**
 * INTERNAL, not exported from the package (main entry or `testing`). The one way to produce a
 * "recorded" trace in code: qualifyClaudeCorrespondence calls it only for frames its real Claude
 * transport recorded. A test checks that nothing else in the source calls it.
 */
export function recordedTraceFromFrames(
  frames: readonly unknown[],
  options: { binarySHA256: string; acceptedAnswer?: unknown },
): CorrespondenceTrace {
  const trace = cutTrace(frames, options, "recorded");
  recordedTraces.add(trace);
  return trace;
}

function cutTrace(
  frames: readonly unknown[],
  options: { binarySHA256: string; acceptedAnswer?: unknown },
  source: "recorded" | "emulated",
): CorrespondenceTrace {
  const answer = options.acceptedAnswer;
  return {
    format: CORRESPONDENCE_TRACE_FORMAT,
    source,
    binary_sha256: /^[a-f0-9]{64}$/.test(options.binarySHA256) ? options.binarySHA256 : "invalid",
    frames: frames.slice(0, TRACE_MAX_FRAMES + 1).map((m) => {
      if (!record(m)) return null;
      const out: Record<string, unknown> = {};
      const type = name(m.type),
        subtype = name(m.subtype);
      if (type !== undefined) out.type = type;
      if (subtype !== undefined) out.subtype = subtype;
      const direct: unknown[] = [];
      if (m.type === "system" && m.subtype === "init") {
        out.model = selector(m.model);
        out.claude_code_version = selector(m.claude_code_version);
        const tools = Array.isArray(m.tools) ? m.tools : null;
        out.tools =
          tools && tools.length === 1 && tools[0] === CLAUDE_OUTPUT_TOOL
            ? [CLAUDE_OUTPUT_TOOL]
            : {
                count: tools ? tools.length : null,
                sha256: tools
                  ? sha256(
                      tools
                        .map((t) => String(t))
                        .sort()
                        .join("\n"),
                    )
                  : null,
              };
        for (const key of INIT_LISTS)
          if (key in m) {
            const list = m[key];
            out[key] = Array.isArray(list)
              ? { count: list.length, empty: list.length === 0 }
              : { count: null, empty: false };
          }
        const unexpected = Object.keys(m).filter((k) => !CORRESPONDENCE_INIT_KEYS.includes(k));
        if (unexpected.length) out.unexpected_init_keys = unexpected.map((k) => name(k));
      } else if (m.type === "assistant") {
        const content =
          record(m.message) && Array.isArray(m.message.content) ? m.message.content : null;
        if (content) direct.push(...content);
        out.message = content
          ? {
              content: content.map((b: unknown) => {
                if (!record(b)) return null;
                if (!toolLike(b)) return { type: name(b.type) ?? null };
                const summary = toolSummary(b);
                if (
                  answer !== undefined &&
                  b.type === "tool_use" &&
                  b.name === CLAUDE_OUTPUT_TOOL &&
                  jsonEqual(b.input, answer)
                )
                  summary.input = structuredClone(answer);
                return summary;
              }),
            }
          : null;
      } else if (m.type === "result") {
        out.is_error = flag(m.is_error);
        const output = m.structured_output;
        out.has_structured_output = output !== undefined && output !== null;
        if (answer !== undefined && jsonEqual(output, answer))
          out.structured_output = structuredClone(answer);
      }
      const nested: unknown[] = [];
      try {
        scanTools(m, (node) => {
          if (!direct.includes(node)) nested.push(toolSummary(node));
        });
      } catch {
        // Too deep to scan: keep a tool marker, so replay refuses it as the live checker did.
        nested.push({ type: "unscannable_tool_use" });
      }
      if (nested.length) out.nested_tool_uses = nested;
      return out;
    }),
  };
}

/** The committed byte form of a trace. Its SHA-256 is what the allowlist pins. */
export function serializeCorrespondenceTrace(trace: CorrespondenceTrace): string {
  // A "recorded" trace serializes only if a real recording built it.
  if (trace.source !== "emulated" && !recordedTraces.has(trace)) throw Error("trace-not-recorded");
  return JSON.stringify(trace, null, 2) + "\n";
}

/** Turns a cut-down trace frame back into the raw shape the checker reads. */
function rehydrate(f: unknown): unknown {
  if (!record(f)) return f;
  const out: Record<string, unknown> = { ...f, session_id: REPLAY_SESSION };
  if (f.type === "system" && f.subtype === "init") {
    // Redacted lists come back as that many placeholders, so a non-empty list stays non-empty.
    const placeholders = (v: unknown) =>
      Array.isArray(v)
        ? v
        : record(v) && typeof v.count === "number" && v.count >= 0 && v.count <= 4096
          ? Array.from({ length: v.count }, () => "redacted")
          : null;
    out.tools = placeholders(f.tools);
    for (const key of INIT_LISTS) if (key in f) out[key] = placeholders(f[key]);
    delete out.unexpected_init_keys;
    // An unknown init key comes back as itself, so the checker refuses it again.
    if (Array.isArray(f.unexpected_init_keys))
      for (const k of f.unexpected_init_keys)
        out[typeof k === "string" && k !== "invalid" ? k : "unexpected_init_key"] = null;
  }
  if (f.type === "result") {
    delete out.has_structured_output;
    if (f.has_structured_output === true && !("structured_output" in f))
      out.structured_output = { redacted: true };
  }
  return out;
}

/**
 * Replays a recorded trace through the same frame checker the live transport uses, against the
 * model, version and binary the plan pins (never the trace's own claims). This is the replay that
 * allowlisting relies on: an emulated trace is refused with `emulated-trace`.
 */
export function replayCorrespondenceTrace(
  trace: unknown,
  expected: { model: string; nativeVersion: string; binarySHA256: string },
): CorrespondenceFrameVerdict {
  if (record(trace) && trace.source !== "recorded")
    return { kind: "refused", reason: "emulated-trace" };
  return replay(trace, expected);
}

/**
 * EMULATION ONLY. The same replay for a trace from qualifyClaudeCorrespondenceEmulation, to prove
 * the mechanics offline. It refuses a recorded trace, and nothing it accepts can qualify a version.
 */
export function replayEmulatedCorrespondenceTrace(
  trace: unknown,
  expected: { model: string; nativeVersion: string; binarySHA256: string },
): CorrespondenceFrameVerdict {
  if (!record(trace) || trace.source !== "emulated")
    return { kind: "refused", reason: "invalid-frame" };
  return replay(trace, expected);
}

function replay(
  trace: unknown,
  expected: { model: string; nativeVersion: string; binarySHA256: string },
): CorrespondenceFrameVerdict {
  if (record(trace) && trace.binary_sha256 !== expected.binarySHA256)
    return { kind: "refused", reason: "binary-mismatch" };
  if (
    !record(trace) ||
    Object.keys(trace).sort().join(",") !== "binary_sha256,format,frames,source" ||
    trace.format !== CORRESPONDENCE_TRACE_FORMAT ||
    !Array.isArray(trace.frames) ||
    trace.frames.length > TRACE_MAX_FRAMES
  )
    return { kind: "refused", reason: "invalid-frame" };
  const checker = createCorrespondenceFrameChecker({
    model: expected.model,
    nativeVersion: expected.nativeVersion,
    sessionId: REPLAY_SESSION,
  });
  for (const f of trace.frames) {
    try {
      checker.frame(rehydrate(f));
    } catch (error) {
      if (error instanceof CorrespondenceFrameError) break;
      throw error;
    }
  }
  return checker.verdict();
}
