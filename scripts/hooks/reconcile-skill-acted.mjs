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
//   - suggestions   ← ~/.claude/suggestion-telemetry.jsonl — BOTH populations
//                     (rm:rm-l1-core#S3), tagged:
//                     `skill:suggested` (population:installed) and
//                     `skill:suggested-uninstalled` (population:uninstalled); the
//                     SUGGESTION_ID join root, S0. Until 2026-07-17 the installed
//                     population was silently excluded (522 of 790 suggestions unscored
//                     — RCA d92e3b15); it is now scored and tagged, never dropped.
//   - engaged       ← detectEngagement() (independent SKILL.md-Read or Skill-tool
//                     invocation in tool-telemetry)
//   - acted         ← C2-valid skill:acted in the spine ledger (validateSkillActed)
//   - artifactExists← a Write/Edit to a path matching the skill's expected_artifact
//                     pattern in-session (independent artifact-existence proxy)
//   - disposition   ← classifyDisposition() (skill-acted-rate.ts)
//
// ── KNOWN GAPS carried forward as C3 findings (do NOT silently ship past these) ──
//
// (1) USE-vs-MAINTENANCE — CLOSED by rm:rm-l1-core#S16 (adr:two-track-skill-telemetry).
//     The discriminator now lives HERE: sessions that mutate the suggested skill's own
//     files classify `skill-authoring` (excluded from the use numerator AND denominator),
//     and the same pass emits the shadow `skill:authoring` evolution stream
//     (skill-authoring.jsonl). Precedence: a C2-valid `acted` still outranks authoring
//     (product-near-definition refinement); an artifact WITHOUT a self-report does not
//     (gold 66B372CC). Audit-reads not tied to a suggestion still don't inflate counts
//     (recorder stays suggestion-scoped); the litter surface inherits detectAuthoringEdits.
//
// (2) PATH COVERAGE — CLOSED by rm:rm-l1-core#S17 gap (e). `engaged` covers all three
//     follow paths: SKILL.md Read, Skill-tool invocation (name-normalized), and skill
//     scripts/ execution via Bash (input_summary signal) — all from the catch-all
//     tool-telemetry (see corroborate-follow.mjs).
//
// Usage:
//   node scripts/hooks/reconcile-skill-acted.mjs                  # Stop hook (session from stdin)
//   node scripts/hooks/reconcile-skill-acted.mjs --session=SID    # one session
//   node scripts/hooks/reconcile-skill-acted.mjs --window=86400000 [--now=ISO]
//   node scripts/hooks/reconcile-skill-acted.mjs --json           # machine-readable, no persist
//   node scripts/hooks/reconcile-skill-acted.mjs --rebuild        # reproject ALL suggestions and
//                                                                 # REPLACE the shadow file (backup
//                                                                 # kept). The shadow log is a
//                                                                 # projector VIEW, not a spine
//                                                                 # ledger — rebuilding it after a
//                                                                 # predicate change is how stale
//                                                                 # classifications get corrected.
//   (test injection) --suggestion-telemetry=PATH --tool=PATH --ledger-root=DIR --out=PATH
//                    --authoring-out=PATH  (skill:authoring evolution stream, default
//                                           <ledger-root>/skill-authoring.jsonl)

import { existsSync, appendFileSync, mkdirSync, writeFileSync, copyFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectEngagement, detectAuthoringEdits, collectAuthoringEvents } from './skill-acted-detect.mjs';
import { readJsonl } from './corroborate-follow.mjs';

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // grace window for an artifact to appear
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
const TERMINAL = new Set(['acted', 'skill-authoring', 'engaged_no_act', 'capture_miss', 'ignored']);

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
  // Use-vs-maintenance discriminator (adr:two-track-skill-telemetry): skill-dir
  // mutations at/after the suggestion, suggestion-scoped like every other signal
  // (gold EBE96AA0). Independent (catch-all telemetry), never agent self-report.
  const authoring =
    detectAuthoringEdits({ skill: suggestion.skill, sessionId: suggestion.sessionId, sinceIso: suggestion.ts, toolTelemetry }).length > 0;

  const disposition = classifyDisposition({ suggestion, engaged, acted, artifactExists, actExpected, withinWindow, authoring });
  return { suggestion, disposition, engaged, acted, artifactExists, authoring };
}

/**
 * Project a set of suggestions. Pure. Returns one row per suggestion.
 */
export function projectDispositions(suggestions, ctx, deps) {
  return suggestions.map((s) => classifyOne(s, ctx, deps));
}

/** Denominator populations: which suggestion events are scored, and how tagged. */
const SUGGESTION_POPULATIONS = {
  'skill:suggested': 'installed',
  'skill:suggested-uninstalled': 'uninstalled',
};

/**
 * Dedup suggestion-telemetry to one SuggestionRecord per SUGGESTION_ID (earliest ts).
 * BOTH populations are scored — installed (`skill:suggested`) and uninstalled
 * (`skill:suggested-uninstalled`) — each record tagged with its `population` so the
 * two are reported side by side, never silently merged or excluded.
 */
export function suggestionRecords(events, { sessionId } = {}) {
  const byId = new Map();
  for (const ev of events) {
    const population = SUGGESTION_POPULATIONS[ev.event];
    if (!population) continue;
    if (!ev.suggestion_id || !ev.skill || !ev.session_id) continue;
    if (sessionId && ev.session_id !== sessionId) continue;
    const ts = ev.suggested_at || ev.ts;
    if (!ts) continue;
    const prev = byId.get(ev.suggestion_id);
    if (!prev || ts < prev.ts) {
      byId.set(ev.suggestion_id, { suggestionId: ev.suggestion_id, skill: ev.skill, sessionId: ev.session_id, ts, population });
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
  appendFileSync(outPath, dispositionLines(toWrite, nowIso).join('\n') + '\n', 'utf8');
  return toWrite;
}

/** Serialize disposition rows to shadow-log JSONL lines. */
function dispositionLines(rows, nowIso) {
  return rows.map((r) =>
    JSON.stringify({
      ts: nowIso,
      event: 'skill:disposition',
      mode: 'shadow',
      suggestion_id: r.suggestion.suggestionId,
      skill: r.suggestion.skill,
      session_id: r.suggestion.sessionId,
      suggested_at: r.suggestion.ts,
      population: r.suggestion.population,
      disposition: r.disposition,
      engaged: r.engaged,
      acted: r.acted,
      artifact_exists: r.artifactExists,
      authoring: r.authoring ?? false,
    }),
  );
}

/**
 * EVOLUTION TRACK (adr:two-track-skill-telemetry, SHADOW): append one
 * `skill:authoring` event per session×skill pair with skill-dir mutations,
 * idempotent on the pair. Append-only event stream (not a rebuildable view) —
 * authoring happened whether or not later predicates change. No consumer reads
 * it until its own capture-quality pass. Returns the events actually written.
 */
export function persistAuthoringEvents(events, outPath, nowIso) {
  const already = new Set();
  if (existsSync(outPath)) {
    for (const r of readJsonl(outPath)) if (r.session_id && r.skill) already.add(`${r.session_id} ${r.skill}`);
  }
  const toWrite = events.filter((e) => !already.has(`${e.session_id} ${e.skill}`));
  if (toWrite.length === 0) return [];
  mkdirSync(dirname(outPath), { recursive: true });
  appendFileSync(
    outPath,
    toWrite
      .map((e) =>
        JSON.stringify({
          ts: e.ts ?? nowIso,
          recorded_at: nowIso,
          event: 'skill:authoring',
          mode: 'shadow',
          skill: e.skill,
          session_id: e.session_id,
          files_touched: e.files_touched,
          kind: e.kind,
        }),
      )
      .join('\n') + '\n',
    'utf8',
  );
  return toWrite;
}

/**
 * REPLACE the shadow file with a fresh projection of every terminal disposition.
 * The shadow log is a VIEW (derived, reproducible from telemetry) — after a
 * predicate/denominator change, append-idempotence would freeze stale rows forever,
 * so a rebuild rewrites the view wholesale. The previous file is kept as
 * `<out>.bak.<ts>`; returns {written, backedUp}.
 */
export function rebuildDispositions(rows, outPath, nowIso) {
  const toWrite = rows.filter((r) => TERMINAL.has(r.disposition));
  mkdirSync(dirname(outPath), { recursive: true });
  let backedUp = null;
  if (existsSync(outPath)) {
    backedUp = `${outPath}.bak.${nowIso.replace(/[:.]/g, '-')}`;
    copyFileSync(outPath, backedUp);
  }
  writeFileSync(outPath, toWrite.length ? dispositionLines(toWrite, nowIso).join('\n') + '\n' : '', 'utf8');
  return { written: toWrite, backedUp };
}

/**
 * DEAD-RULER GUARD (rm:rm-l1-core#S17 gap (a)): when the reconciler cannot load its
 * projector (unbuilt dist/tracking — the loops.md STANDING INVARIANT), it must fail
 * LOUDLY, not vanish: append a `reconciler-dead` event to the loop-health stream so a
 * dead ruler leaves evidence instead of silently accumulating zero dispositions.
 * Auto-build was rejected (Stop-hook latency + concurrent-session build races).
 * Never throws — a broken health write must not block a session stop.
 */
export function recordReconcilerDead({ reason, detail }, healthPath, nowIso = new Date().toISOString()) {
  try {
    mkdirSync(dirname(healthPath), { recursive: true });
    appendFileSync(
      healthPath,
      JSON.stringify({ ts: nowIso, event: 'reconciler-dead', loop: 'hook-reconcile-skill-acted', reason, detail }) + '\n',
      'utf8',
    );
    return true;
  } catch {
    return false;
  }
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
  } catch (err) {
    // LOUD in ALL modes + durable health event (gap (a)) — the old path was
    // stderr-in-one-mode-only and left no trace, so a dead ruler read as
    // "no suggestions" for 25 days (RCA d92e3b15 family).
    const healthPath = expand(args['health-out'] ?? join(expand(args['ledger-root'] ?? '~/selfco/tracking'), 'loop-health.jsonl'));
    recordReconcilerDead({ reason: 'dist-unbuilt', detail: String(err?.message ?? err) }, healthPath);
    console.error(
      '[reconcile-skill-acted] DEAD RULER: packages/workflows/dist/tracking not loadable — dispositions are NOT being recorded. ' +
        'Run `pnpm install --frozen-lockfile && pnpm --filter @core/workflows build` (loops.md STANDING INVARIANT). ' +
        `Event appended to ${healthPath}. Exiting 0 (non-blocking).`,
    );
    process.exit(0);
  }

  const stdin = await readStdinJson();
  const sessionId = args.session ? String(args.session) : (stdin.session_id || undefined);

  const suggPath = expand(args['suggestion-telemetry'] ?? '~/.claude/suggestion-telemetry.jsonl');
  const toolPath = expand(args.tool ?? '~/.claude/tool-telemetry.jsonl');
  const ledgerRoot = expand(args['ledger-root'] ?? '~/selfco/tracking');
  const program = args.program ? String(args.program) : 'opav-loop';
  const outPath = expand(args.out ?? join(ledgerRoot, 'skill-dispositions.jsonl'));
  const authoringOutPath = expand(args['authoring-out'] ?? join(ledgerRoot, 'skill-authoring.jsonl'));
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
  const byPopulation = {};
  for (const r of rows) {
    counts[r.disposition] = (counts[r.disposition] ?? 0) + 1;
    const pop = r.suggestion.population ?? 'unknown';
    byPopulation[pop] ??= {};
    byPopulation[pop][r.disposition] = (byPopulation[pop][r.disposition] ?? 0) + 1;
  }

  if (asJson) {
    // DELIBERATELY no capture-rate number (deferred-data: needs accumulation + gold set).
    // writeSync, not console.log: console.log + process.exit races the async stdout
    // flush and truncates at ~64KiB on pipes — observed live on the 371-row ledger
    // (rm:rm-l1-core#S17 gap (d)).
    writeSync(1, JSON.stringify({ mode: 'shadow', session: sessionId ?? 'all', counts, by_population: byPopulation, rows: rows.map((r) => ({ suggestion_id: r.suggestion.suggestionId, skill: r.suggestion.skill, population: r.suggestion.population, disposition: r.disposition, engaged: r.engaged })) }, null, 2) + '\n');
    process.exit(0);
  }

  // EVOLUTION TRACK (shadow, idempotent append): one skill:authoring event per
  // session×skill pair with skill-dir mutations — suggestion-independent by design.
  const authoringWritten = persistAuthoringEvents(collectAuthoringEvents(toolTelemetry, { sessionId }), authoringOutPath, nowIso);

  const fmt = (c) => Object.entries(c).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)';
  const popSummary = Object.entries(byPopulation).map(([p, c]) => `${p}[${fmt(c)}]`).join(' ');
  if (args.rebuild) {
    const { written, backedUp } = rebuildDispositions(rows, outPath, nowIso);
    console.error(`[reconcile-skill-acted] REBUILD ${sessionId ?? 'all'}: ${popSummary} | ${written.length} rows written to ${outPath}${backedUp ? ` (previous view → ${backedUp})` : ''} | +${authoringWritten.length} skill:authoring (shadow; engagement=SKILL.md-Read|Skill-tool|script-exec)`);
    process.exit(0);
  }

  const written = persistDispositions(rows, outPath, nowIso);
  // SHADOW: counts only — NEVER a rate. Note the known undercount (path coverage gap).
  console.error(`[reconcile-skill-acted] ${sessionId ?? 'all'}: ${popSummary} | +${written.length} recorded, +${authoringWritten.length} skill:authoring (shadow; engagement=SKILL.md-Read|Skill-tool|script-exec)`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cliMain();
}
