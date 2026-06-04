#!/usr/bin/env node
// gate.mjs — C4/C5 orchestrator for the loading-discipline gate (ADR-0081 §Slice 2).
//
// PreToolUse(Edit|Write) entry point. Reads the hook JSON on stdin, runs the cheap tripwire, and
// only on a trip runs the Haiku judge, logs a TPM event, and decides:
//   mode=shadow (default) → ALWAYS allow (Brassboard / observe-only) — just logs.
//   mode=enforce          → block ONCE per session on a judged violation, routing to
//                           /grill-with-docs, and mark the session cleared so the re-edit passes.
//   mode=off              → no-op.
// FAILS OPEN: any unexpected error exits 0 (a gate bug must never block every edit).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { evaluateTripwire, isGovernedFile, repoRootForFile, DEFAULT_THRESHOLD } from './tripwire.mjs';
import { judgeBlock } from './judge.mjs';
import { logGateEvent } from './events.mjs';
import { isCleared, markCleared } from './clearance.mjs';

const ALLOW = 0, BLOCK = 2;
const MODE = (process.env.CLAUDE_MD_GATE_MODE || 'shadow').toLowerCase();
const THRESHOLD = Number(process.env.CLAUDE_MD_GATE_THRESHOLD) || DEFAULT_THRESHOLD;

// Pure decision: given mode + clearance + the judge verdict, what does a TRIPPED edit get?
// Only mode=enforce on an uncleared, judged-conditional edit blocks (exactly once per session).
export function decide({ mode, cleared, verdict }) {
  if (mode === 'enforce' && !cleared && verdict?.isConditional) return { action: 'block', block: true };
  if (cleared) return { action: 'allow-cleared', block: false };
  if (!verdict) return { action: 'allow-shadow-nojudge', block: false };
  if (verdict.isConditional) return { action: 'allow-shadow', block: false }; // shadow would-block → M5
  return { action: 'allow-no-violation', block: false };
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function readFileSafe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

// Reconstruct the post-edit file contents + the added chunk, for Write and Edit.
function resolveEdit(toolName, input) {
  const filePath = input.file_path || input.path;
  const current = readFileSafe(filePath);
  if (toolName === 'Write') {
    return { filePath, current, proposed: input.content ?? '', added: input.content ?? '' };
  }
  // Edit: apply old_string → new_string to the current file
  const oldS = input.old_string ?? '';
  const newS = input.new_string ?? '';
  const proposed = oldS && current.includes(oldS) ? current.replace(oldS, newS) : current + '\n' + newS;
  return { filePath, current, proposed, added: newS };
}

async function main() {
  if (MODE === 'off') process.exit(ALLOW);

  const raw = readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(ALLOW); }

  const toolName = input.tool_name;
  if (toolName !== 'Edit' && toolName !== 'Write') process.exit(ALLOW);

  const ti = input.tool_input || {};
  const filePath = ti.file_path || ti.path;
  if (!filePath || !isGovernedFile(filePath)) process.exit(ALLOW); // cheap common-case exit

  const { current, proposed, added } = resolveEdit(toolName, ti);
  const repoRoot = repoRootForFile(filePath);
  const trip = evaluateTripwire({ filePath, proposedContent: proposed, currentContent: current, repoRoot, threshold: THRESHOLD });

  if (!trip.tripped) process.exit(ALLOW); // tripwire is the gate on the LLM; no trip → no judge, no log

  // Tripped → judge (capped to bound Haiku cost), then log a TPM event.
  const verdict = await judgeBlock({ filePath, addedContent: (added || proposed).slice(0, 4000) });
  const sessionId = input.session_id;
  const cleared = isCleared(sessionId);

  const { action, block } = decide({ mode: MODE, cleared, verdict });
  const exitCode = block ? BLOCK : ALLOW;
  if (block) markCleared(sessionId); // block exactly once; the author's post-grill re-edit passes

  logGateEvent({
    session_id: sessionId, repo: input.cwd, file: filePath, mode: MODE,
    tripwire: { tripped: trip.tripped, before: trip.before, after: trip.after, threshold: trip.threshold },
    verdict, action, cleared,
  });

  if (exitCode === BLOCK) {
    const layer = verdict.suggestedLayer || 'L1/L2';
    process.stderr.write(
      `[CLAUDE.md loading-discipline] This edit grows an oversized always-loaded CLAUDE.md ` +
      `(${trip.before}→${trip.after} tokens) with content the gate judges CONDITIONAL (${layer}: ${verdict.reasoning}).\n` +
      `Route it out instead of into the always-loaded layer. Run: /grill-with-docs --scope=claude-md-routing ` +
      `(or /claude-md-audit ${repoRoot || '.'}). This block fires once per session; your next edit will pass.\n`
    );
  }
  process.exit(exitCode);
}

// Only run as a hook when executed directly — NOT when imported by tests (which would read stdin
// and process.exit, hanging the test worker).
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(() => process.exit(ALLOW)); // fail open
