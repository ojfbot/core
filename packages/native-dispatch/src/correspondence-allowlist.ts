import { fileURLToPath } from "node:url";

/** One Claude Code version qualified for correspondence by a recorded, replayable trace. */
export interface QualifiedClaudeCorrespondence {
  nativeVersion: string;
  /** The exact native model name the plan must pin and the trace must report. */
  model: string;
  /** SHA-256 of the pinned Claude binary; the trace records the same hash. */
  binarySHA256: string;
  /** SHA-256 of `trace`. */
  traceSHA256: string;
  /**
   * The built-in agent and plugin names safe mode still loads, exactly as the trace recorded them
   * (sorted). Every duty turn must report exactly these (owner, 16 November: "Pin exact names").
   */
  builtinAgents: readonly string[];
  builtinPlugins: readonly string[];
  /**
   * The trace's exact bytes, embedded so they travel with the code into bundles. They must equal
   * the reviewed source `qualification/claude/<nativeVersion>.trace.json`; a test checks it.
   */
  trace: string;
}

/** Freezes a value and everything in it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Exact entries qualified under the current correspondence invocation policy. Changing that
 * policy requires new qualification; historical traces never authorize a new invocation.
 */
export const CLAUDE_CORRESPONDENCE_QUALIFIED: readonly QualifiedClaudeCorrespondence[] = deepFreeze(
  [],
);

/** Where active reviewed traces are committed. Historical evidence stays in its subdirectory. */
export const CORRESPONDENCE_TRACE_DIRECTORY = fileURLToPath(
  new URL("../qualification/claude/", import.meta.url),
);
