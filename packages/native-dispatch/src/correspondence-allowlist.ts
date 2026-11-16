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
 * The correspondence allowlist: data only, deep-frozen. Correspondence plans, dispatchers and duty
 * windows take their Claude versions from here. To add a version, commit its trace (from
 * `scripts/qualify-claude-correspondence.mjs`, which also prints this entry) and add the entry.
 * No real trace exists yet, so 2.1.286 and 2.1.308 are refused.
 */
export const CLAUDE_CORRESPONDENCE_QUALIFIED: readonly QualifiedClaudeCorrespondence[] = deepFreeze(
  [],
);

/** Where the reviewed trace files are committed: `qualification/claude/` in this package. */
export const CORRESPONDENCE_TRACE_DIRECTORY = fileURLToPath(
  new URL("../qualification/claude/", import.meta.url),
);
