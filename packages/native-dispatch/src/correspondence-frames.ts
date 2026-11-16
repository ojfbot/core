/**
 * Claude's correspondence frame contract. With `--json-schema`, Claude Code exposes exactly one
 * built-in output tool; the turn must call it once, and its input must be the result's
 * `structured_output`. Everything else about the frames is refused. Correspondence only: the
 * advisory canary and supervised transports keep their own unchanged checks.
 */

/** The single built-in tool Claude Code uses to return a `--json-schema` answer. */
export const CLAUDE_OUTPUT_TOOL = "StructuredOutput";

/** Why a frame stream was refused. Each one ends the turn as unknown with no proposal. */
export type CorrespondenceFrameRefusal =
  | "invalid-frame"
  | "wrong-session"
  | "frame-before-init"
  | "init-repeated"
  | "init-model-mismatch"
  | "init-tools-mismatch"
  | "init-surface-not-empty"
  | "frame-after-result"
  | "tool-name-mismatch"
  | "tool-second-call"
  | "tool-call-without-output"
  | "output-without-tool-call"
  | "tool-input-mismatch"
  | "no-tool-call"
  | "no-result";

/** A frame refusal, or a process-level reason the native turn could not be accepted. */
export type CorrespondenceTurnRefusal =
  | CorrespondenceFrameRefusal
  | "output-overflow"
  | "deadline"
  | "aborted"
  | "exit-nonzero"
  | "trailing-output"
  | "process-error"
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

function toolCall(block: Record<string, unknown>): boolean {
  // `tool_use`, `server_tool_use`, `mcp_tool_use`: any tool-use block type counts as a call.
  return typeof block.type === "string" && block.type.endsWith("tool_use");
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

/** The one frame checker. The live transport, trace replay and qualification all use it. */
export function createCorrespondenceFrameChecker(expected: {
  sessionId: string;
  model: string;
}): CorrespondenceFrameChecker {
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
      if (m.session_id !== expected.sessionId) refuse("wrong-session");
      if (m.type === "system" && m.subtype === "init") {
        if (initialized) refuse("init-repeated");
        if (m.model !== expected.model) refuse("init-model-mismatch");
        // As a set, the tools must be exactly Claude's one output tool.
        if (
          !Array.isArray(m.tools) ||
          !m.tools.every((t) => typeof t === "string") ||
          new Set(m.tools).size !== 1 ||
          m.tools[0] !== CLAUDE_OUTPUT_TOOL
        )
          refuse("init-tools-mismatch");
        if (!Array.isArray(m.mcp_servers) || m.mcp_servers.length) refuse("init-surface-not-empty");
        for (const key of INIT_SURFACES)
          if (key in m && !(Array.isArray(m[key]) && (m[key] as unknown[]).length === 0))
            refuse("init-surface-not-empty");
        initialized = true;
        return;
      }
      if (!initialized) refuse("frame-before-init");
      if (m.type === "assistant") {
        if (!record(m.message) || !Array.isArray(m.message.content)) refuse("invalid-frame");
        for (const block of (m.message as { content: unknown[] }).content) {
          if (!record(block)) refuse("invalid-frame");
          const b = block as Record<string, unknown>;
          if (!toolCall(b)) continue;
          calls += 1;
          if (calls > 1) refuse("tool-second-call");
          if (b.type !== "tool_use" || b.name !== CLAUDE_OUTPUT_TOOL) refuse("tool-name-mismatch");
          call = { input: b.input };
        }
        return;
      }
      if (m.type === "result") result = m;
      // Other frames (the output tool's user/tool_result echo, status events) carry no answer.
    },
    terminal: () => result !== undefined,
    verdict() {
      if (refused) return { kind: "refused", reason: refused };
      if (!result) return { kind: "refused", reason: "no-result" };
      if (result.is_error !== false) return { kind: "failed" };
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

export const CORRESPONDENCE_TRACE_FORMAT = "claude-correspondence-trace-v1";
export interface CorrespondenceTrace {
  format: typeof CORRESPONDENCE_TRACE_FORMAT;
  frames: unknown[];
}
const TRACE_MAX_FRAMES = 1000;
/** Session placeholder used when replaying: traces keep no session, account or usage data. */
const REPLAY_SESSION = "00000000-0000-4000-8000-000000000000";

function label(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 64 ? value : undefined;
}
function listEntry(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (record(value) && typeof value.name === "string") return { name: value.name };
  return null;
}
function list(value: unknown): unknown {
  return Array.isArray(value) ? value.map(listEntry) : null;
}

/**
 * Cuts raw parsed stream-json frames down to what the checker reads: frame type/subtype; the init
 * model, tools, mcp_servers and other surface lists; tool-use name/input blocks (other blocks keep
 * only their type); and the result's is_error and structured_output. Session, account, usage,
 * prose and identifiers are dropped.
 */
export function traceFromFrames(frames: readonly unknown[]): CorrespondenceTrace {
  return {
    format: CORRESPONDENCE_TRACE_FORMAT,
    frames: frames.slice(0, TRACE_MAX_FRAMES + 1).map((m) => {
      if (!record(m)) return null;
      const out: Record<string, unknown> = {};
      const type = label(m.type),
        subtype = label(m.subtype);
      if (type !== undefined) out.type = type;
      if (subtype !== undefined) out.subtype = subtype;
      if (m.type === "system" && m.subtype === "init") {
        out.model = m.model;
        out.tools = Array.isArray(m.tools) ? m.tools.map(listEntry) : null;
        out.mcp_servers = list(m.mcp_servers);
        for (const key of INIT_SURFACES) if (key in m) out[key] = list(m[key]);
      } else if (m.type === "assistant") {
        out.message =
          record(m.message) && Array.isArray(m.message.content)
            ? {
                content: m.message.content.map((b: unknown) =>
                  !record(b)
                    ? null
                    : toolCall(b)
                      ? { type: b.type, name: b.name, input: b.input }
                      : { type: label(b.type) ?? null },
                ),
              }
            : null;
      } else if (m.type === "result") {
        out.is_error = m.is_error;
        if (m.structured_output !== undefined) out.structured_output = m.structured_output;
      }
      return out;
    }),
  };
}

/** The committed byte form of a trace. Its SHA-256 is what the allowlist pins. */
export function serializeCorrespondenceTrace(trace: CorrespondenceTrace): string {
  return JSON.stringify(trace, null, 2) + "\n";
}

/** Replays a cut-down trace through the same frame checker the live transport uses. */
export function replayCorrespondenceTrace(trace: unknown): CorrespondenceFrameVerdict {
  if (
    !record(trace) ||
    Object.keys(trace).sort().join(",") !== "format,frames" ||
    trace.format !== CORRESPONDENCE_TRACE_FORMAT ||
    !Array.isArray(trace.frames) ||
    trace.frames.length > TRACE_MAX_FRAMES
  )
    return { kind: "refused", reason: "invalid-frame" };
  const init = trace.frames.find((f) => record(f) && f.type === "system" && f.subtype === "init");
  const checker = createCorrespondenceFrameChecker({
    sessionId: REPLAY_SESSION,
    model: record(init) && typeof init.model === "string" ? init.model : "",
  });
  for (const f of trace.frames) {
    try {
      checker.frame(record(f) ? { ...f, session_id: REPLAY_SESSION } : f);
    } catch (error) {
      if (error instanceof CorrespondenceFrameError) break;
      throw error;
    }
  }
  return checker.verdict();
}
