#!/usr/bin/env node
// reconcile-skill-acted.mjs — the INDEPENDENT, per-session disposition recorder
// (Stop hook) for adr:skill-action-instrumentation (OPAV-S1).
//
// This is the WORKHORSE that makes the signal accumulate. The agent-emitted
// skill-acted-emit.mjs is the (sparse) self-report source; THIS hook is the
// independent cross-check that classifies every suggestion even when the agent
// never self-reports — so `capture_miss` (the real C1 failure: work done, not
// reported) is actually measurable. It runs the S1 projector (classifyDisposition)
// over the live telemetry and persists its VIEW to a shadow file.
//
// SPINE-OWNED type discipline: a disposition is an OBSERVATION (a projector view),
// NOT a spine transition. This hook NEVER writes a TrackingEvent and never emits
// skill:acted (that would conflate the independent detector with the self-report
// source and violate the two-source contract). It writes only to its own shadow
// log. SHADOW-FIRST (ADR-0086): observe + record, never gate. Exits 0 non-blocking.
//
// Sources joined (all reused — no logic duplicated here):
//   - suggestions   ← ~/.claude/suggestion-telemetry.jsonl (`skill:suggested-uninstalled`,
//                     the inline-path denominator; the SUGGESTION_ID join root, S0)
//   - engaged       ← detectEngagement() (independent SKILL.md-Read in tool-telemetry)
//   - acted         ← C2-valid skill:acted in the spine ledger (validateSkillActed)
//   - artifactExists← a Write/Edit to a path matching the skill's expected_artifact
//                     pattern in-session (independent artifact-existence proxy)
//   - disposition   ← classifyDisposition() (skill-acted-rate.ts)
//
// ── KNOWN GAPS carried forward as C3 findings (do NOT silently ship past these) ──
//
// (1) USE-vs-MAINTENANCE (ADR-0095 honesty crux). `engaged` = a SKILL.md Read. A Read
//     during a skill AUTHORING/AUDIT session (e.g. the ADR-0096 session that read 58
//     SKILL.md files) is NOT a use. This recorder is SUGGESTION-SCOPED, so audit-reads
//     not tied to a suggestion don't inflate THESE counts — but the future litter
//     surface (catalog ⨝ raw engagement) WILL be fooled. The litter mode MUST add an
//     edit-vs-read / audit-session discriminator before it ships. Gating finding.
//
// (2) PATH COVERAGE. `engaged` covers only the inline-follow path (SKILL.md Read).
//     Skill-tool-only invocations and skill `scripts/` execution are NOT counted as
//     engagement. Undercount is logged (see summary), never silently capped.
//
// Usage:
//   node scripts/hooks/reconcile-skill-acted.mjs                  # Stop hook (session from stdin)
//   node scripts/hooks/reconcile-skill-acted.mjs --session=SID    # one session
//   node scripts/hooks/reconcile-skill-acted.mjs --window=86400000 [--now=ISO]
//   node scripts/hooks/reconcile-skill-acted.mjs --json           # machine-readable, no persist
//   (test injection) --suggestion-telemetry=PATH --tool=PATH --ledger-root=DIR --out=PATH

import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectEngagement } from './skill-acted-detect.mjs';
import { readJsonl } from './corroborate-follow.mjs';

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // grace window for an artifact to appear
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
const TERMINAL = new Set(['acted', 'engaged_no_act', 'capture_miss', 'ignored']);

/**
 * Independent artifact-existence proxy: was a path matching the skill's expected
 * `pathPattern` WRITTEN in this session at/after the suggestion? Derived from the
 * catch-all tool-telemetry (a different mechanism than the agent's self-report), so
 * it can corroborate `capture_miss` without trusting skill:acted. Skills with no
 * `pathPattern` (the loose SHADOW-window skills) can't be confirmed here → false.
 */
export function artifactWrittenInSession({ spec, sessionId, sinceIso, toolTelemetry = [] }) {
  if (!spec?.pathPattern) return false;
  return toolTelemetry.some(
    (ev) =>
      WRITE_TOOLS.has(ev.tool_name) &&
      typeof ev.file_path === 'string' &&
      ev.session_id === sessionId &&
      typeof ev.ts === 'string' &&
      ev.ts >= sinceIso &&
      spec.pathPattern.test(ev.file_path),
  );
}

/**
 * Project ONE suggestion to its terminal disposition. Pure over in-memory inputs;
 * all the judgment lives in the reused library functions injected via `deps`.
 *
 * @param {object} suggestion {suggestionId, skill, sessionId, ts}
 * @param {object} ctx        {toolTelemetry, actedEvents, nowMs, windowMs}
 * @param {object} deps       {classifyDisposition, validateSkillActed, expectedArtifactFor, resolvePath}
 * @returns {{suggestion:object, disposition:string, engaged:boolean, acted:boolean, artifactExists:boolean}}
 */
export function classifyOne(suggestion, ctx, deps) {
  const { toolTelemetry = [], actedEvents = [], nowMs, windowMs = DEFAULT_WINDOW_MS } = ctx;
  const { classifyDisposition, validateSkillActed, expectedArtifactFor, resolvePath } = deps;

  const spec = expectedArtifactFor(suggestion.skill);
  const engaged = detectEngagement({
    skill: suggestion.skill,
    sessionId: suggestion.sessionId,
    sinceIso: suggestion.ts,
    toolTelemetry,
  });

  const acted = actedEvents.some(
    (e) =>
      e.event_type === 'skill:acted' &&
      e.correlation_id === suggestion.suggestionId &&
      validateSkillActed(e, resolvePath ? { resolvePath } : {}).verdict === 'valid',
  );

  const actExpected = spec ? spec.actExpected : false;
  const artifactExists =
    acted || artifactWrittenInSession({ spec, sessionId: suggestion.sessionId, sinceIso: suggestion.ts, toolTelemetry });
  const withinWindow = nowMs - Date.parse(suggestion.ts) < windowMs;

  const disposition = classifyDisposition({ suggestion, engaged, acted, artifactExists, actExpected, withinWindow });
  return { suggestion, disposition, engaged, acted, artifactExists };
}

/**
 * Project a set of suggestions. Pure. Returns one row per suggestion.
 */
export function projectDispositions(suggestions, ctx, deps) {
  return suggestions.map((s) => classifyOne(s, ctx, deps));
}

/** Dedup suggestion-telemetry to one SuggestionRecord per SUGGESTION_ID (earliest ts). */
export function suggestionRecords(events, { sessionId } = {}) {
  const byId = new Map();
  for (const ev of events) {
    if (ev.event !== 'skill:suggested-uninstalled') continue;
    if (!ev.suggestion_id || !ev.skill || !ev.session_id) continue;
    if (sessionId && ev.session_id !== sessionId) continue;
    const ts = ev.suggested_at || ev.ts;
    if (!ts) continue;
    const prev = byId.get(ev.suggestion_id);
    if (!prev || ts < prev.ts) {
      byId.set(ev.suggestion_id, { suggestionId: ev.suggestion_id, skill: ev.skill, sessionId: ev.session_id, ts });
    }
  }
  return [...byId.values()];
}

/**
 * Persist NEW terminal dispositions to the shadow log, idempotent on SUGGESTION_ID.
 * Pending dispositions are not persisted (re-evaluated on a later run). Returns the
 * rows actually written.
 */
export function persistDispositions(rows, outPath, nowIso) {
  const already = new Set();
  if (existsSync(outPath)) {
    for (const r of readJsonl(outPath)) if (r.suggestion_id) already.add(r.suggestion_id);
  }
  const toWrite = rows.filter(
    (r) => TERMINAL.has(r.disposition) && !already.has(r.suggestion.suggestionId),
  );
  if (toWrite.length === 0) return [];
  mkdirSync(dirname(outPath), { recursive: true });
  const lines = toWrite.map((r) =>
    JSON.stringify({
      ts: nowIso,
      event: 'skill:disposition',
      mode: 'shadow',
      suggestion_id: r.suggestion.suggestionId,
      skill: r.suggestion.skill,
      session_id: r.suggestion.sessionId,
      suggested_at: r.suggestion.ts,
      disposition: r.disposition,
      engaged: r.engaged,
      acted: r.acted,
      artifact_exists: r.artifactExists,
    }),
  );
  appendFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  return toWrite;
}

// ── CLI / hook ────────────────────────────────────────────────────────────────
const HERE = fileURLToPath(new URL('.', import.meta.url));
const expand = (p) => (p && p.startsWith('~') ? p.replace('~', homedir()) : p);

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

async function readStdinJson() {
  if (process.stdin.isTTY) return {};
  try {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function cliMain() {
  const args = parseArgs(process.argv.slice(2));
  const asJson = !!args.json;

  // Load the projector + validator + map from the built library. SHADOW: if the build
  // is absent, degrade to a non-blocking notice rather than failing a session.
  let classifyDisposition, validateSkillActed, expectedArtifactFor, EventLedger;
  try {
    const dist = pathToFileURL(resolve(HERE, '../../packages/workflows/dist/tracking')).href;
    ({ classifyDisposition } = await import(`${dist}/skill-acted-rate.js`));
    ({ validateSkillActed } = await import(`${dist}/skill-acted-validator.js`));
    ({ expectedArtifactFor } = await import(`${dist}/expected-artifact.js`));
    ({ EventLedger } = await import(`${dist}/ledger.js`));
  } catch {
    if (!asJson) console.error('[reconcile-skill-acted] shadow: workflows build not found — run `pnpm --filter @core/workflows build`. Skipping (non-blocking).');
    process.exit(0);
  }

  const stdin = await readStdinJson();
  const sessionId = args.session ? String(args.session) : (stdin.session_id || undefined);

  const suggPath = expand(args['suggestion-telemetry'] ?? '~/.claude/suggestion-telemetry.jsonl');
  const toolPath = expand(args.tool ?? '~/.claude/tool-telemetry.jsonl');
  const ledgerRoot = expand(args['ledger-root'] ?? '~/selfco/tracking');
  const program = args.program ? String(args.program) : 'opav-loop';
  const outPath = expand(args.out ?? join(ledgerRoot, 'skill-dispositions.jsonl'));
  const windowMs = args.window ? Number(args.window) : DEFAULT_WINDOW_MS;
  const nowMs = args.now ? Date.parse(String(args.now)) : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const suggestions = suggestionRecords(readJsonl(suggPath), { sessionId });
  const toolTelemetry = readJsonl(toolPath);
  const actedEvents = await new EventLedger(program, ledgerRoot).read().catch(() => []);

  const rows = projectDispositions(
    suggestions,
    { toolTelemetry, actedEvents, nowMs, windowMs },
    { classifyDisposition, validateSkillActed, expectedArtifactFor },
  );

  const counts = {};
  for (const r of rows) counts[r.disposition] = (counts[r.disposition] ?? 0) + 1;

  if (asJson) {
    // DELIBERATELY no capture-rate number (deferred-data: needs accumulation + gold set).
    console.log(JSON.stringify({ mode: 'shadow', session: sessionId ?? 'all', counts, rows: rows.map((r) => ({ suggestion_id: r.suggestion.suggestionId, skill: r.suggestion.skill, disposition: r.disposition })) }, null, 2));
    process.exit(0);
  }

  const written = persistDispositions(rows, outPath, nowIso);
  const summary = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)';
  // SHADOW: counts only — NEVER a rate. Note the known undercount (path coverage gap).
  console.error(`[reconcile-skill-acted] ${sessionId ?? 'all'}: ${summary} | +${written.length} recorded (shadow; engagement=inline-follow only, undercounts Skill-tool/script paths)`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cliMain();
}
