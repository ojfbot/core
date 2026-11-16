import { fileURLToPath } from "node:url";

/** One Claude Code version qualified for correspondence by a committed, replayable trace. */
export interface QualifiedClaudeCorrespondence {
  nativeVersion: string;
  /** SHA-256 of the pinned Claude binary, as the plan's profile pins it. */
  binarySHA256: string;
  /** SHA-256 of `qualification/claude/<nativeVersion>.trace.json`, as committed. */
  traceSHA256: string;
}

/**
 * The correspondence allowlist: data only. Correspondence plans, dispatchers and duty windows take
 * their Claude versions from here. To add a version after recording its trace with
 * `scripts/qualify-claude-correspondence.mjs` and committing it, add one entry; no other change.
 * No real trace exists yet, so 2.1.286 and 2.1.308 are refused.
 */
export const CLAUDE_CORRESPONDENCE_QUALIFIED: readonly QualifiedClaudeCorrespondence[] = [];

/** `qualification/claude/` in this package (beside `src/` and `dist/`). */
export const CORRESPONDENCE_TRACE_DIRECTORY = fileURLToPath(
  new URL("../qualification/claude/", import.meta.url),
);
