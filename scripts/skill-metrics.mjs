#!/usr/bin/env node
// skill-metrics.mjs — adoption metrics from the live disposition ledger (ADR-0095) +
// suggestion-telemetry.jsonl. No external deps. Reads JSONL, computes invocation counts,
// sequencing pairs, suggestion-followed rate, optional baseline diff. Markdown or JSON.
// Invocations derive from skill-dispositions.jsonl (engaged:true); the legacy
// skill-telemetry stream is frozen (2026-05-12) and kept only via --skill-telemetry
// for the historical baseline. Override the live source with --dispositions=PATH.
//
// Usage:
//   node scripts/skill-metrics.mjs                                       # default paths, last 30 days, markdown
//   node scripts/skill-metrics.mjs --since=2026-04-01 --until=2026-04-28 # explicit window
//   node scripts/skill-metrics.mjs --baseline=~/.claude/skill-telemetry-baseline-2026-04-28.jsonl
//   node scripts/skill-metrics.mjs --format=json                         # raw JSON for CI
//   node scripts/skill-metrics.mjs --skill-telemetry=path --suggestion-telemetry=path
//   node scripts/skill-metrics.mjs --pair-window=3600                    # seconds for sequencing pairs (default 3600)
//   node scripts/skill-metrics.mjs --pairs=grill-with-docs,plan-feature  # explicit pairs to track
//   node scripts/skill-metrics.mjs --funnel=standup                      # include standup funnel section (ADR-0054)
//   node scripts/skill-metrics.mjs --funnel=standup --launch-window=86400 # 24h default for launched correlation

import { existsSync, readFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
// skill-telemetry.jsonl (PostToolUse Skill) went dark on 2026-05-12: ADR-0092 routes
// most skills to an inline follow that bypasses the Skill tool, so it stopped recording
// "which skill ran". The live source is now the OPAV-S1 disposition ledger (ADR-0095) —
// a skill was USED when its disposition record has engaged:true. We keep --skill-telemetry
// for the historical baseline (its events fall outside the default 30d window → contribute 0).
const skillPath = expandHome(args["skill-telemetry"] ?? "~/.claude/skill-telemetry.jsonl");
const dispositionPath = expandHome(args["dispositions"] ?? "~/selfco/tracking/skill-dispositions.jsonl");
const suggestionPath = expandHome(args["suggestion-telemetry"] ?? "~/.claude/suggestion-telemetry.jsonl");
const standupPath = expandHome(args["standup-telemetry"] ?? "~/.claude/standup-telemetry.jsonl");
const baselinePath = args.baseline ? expandHome(args.baseline) : null;
const format = args.format ?? "markdown";
const pairWindowSec = Number(args["pair-window"] ?? 3600);
const launchWindowSec = Number(args["launch-window"] ?? 86400); // 24h default per ADR-0054
const funnelMode = args.funnel === "standup" || args.funnel === true;
const dispatchFunnelMode = args.funnel === "dispatch";
const dispatchPath = expandHome(args["dispatch-telemetry"] ?? "~/selfco/tracking/dispatch-sessions.jsonl");
const since = args.since ? Date.parse(args.since) : Date.now() - 30 * 24 * 60 * 60 * 1000;
const until = args.until ? Date.parse(args.until) : Date.now();

// ── Trigger-precision mode (rm:rm-l1-core#S9) ───────────────────────────────
// Joins post-ADR-0093 suggestion fires (rows WITH a suggestion_id) against the
// HONEST disposition ledger (corroborated engagement / C2-valid acted — never the
// 5-minute-window heuristic below, which is the legacy computeSuggestionFollowed).
// Populations reported side by side; skill-authoring rows excluded from the follow
// numerator per the two-track rule (ADR-0098); the pre-0093 era counted and
// excluded, never blended.

// The 2026-07-13 skill-architecture-audit needs_work set (verdicts 38 aligned,
// 22 needs_work, 2 refactor — reproduced identically by
// `.claude/skills/skill-audit/scripts/audit-architecture.mjs` on 2026-07-17, same
// catalog). Override with --needs-work=a,b,c when the audit moves.
const NEEDS_WORK_2026_07_13 = [
  "bead", "caveman", "claude-md-audit", "claude-md-rollout", "day-run", "frame-dev",
  "git-guardrails", "init", "lint-audit", "prototype", "recon", "resume", "roadmap",
  "scaffold-app", "scaffold-frame-app", "selfco-ingest", "spec-review",
  "speculative-pass", "writing-beats", "writing-fragments", "writing-shape", "zoom-out",
];

const SUGGESTION_FIRE_EVENTS = {
  "skill:suggested": "installed",
  "skill:suggested-uninstalled": "uninstalled",
};

if (args["trigger-precision"]) {
  process.exit(triggerPrecisionMain(args));
}

// ADR-defined adoption targets. Sourced from ADRs 0044-0049 and the Pocock plan.
// When ADRs change, update this table.
const TARGETS = {
  "grill-with-docs": { invocations_30d: 10, source: "ADR-0045 + plan §Success metrics" },
  // tdd moved to the dispatch channel (adr:pocock-lifecycle-absorption): the implement
  // contract injects it into day-run / orchestrate-L3 briefs, so it is measured as a rate
  // over dispatched sessions (--funnel=dispatch), not as interactive invocations. The old
  // invocations_30d:5 target would fail forever by design.
  "tdd": { channel: "dispatch", dispatch_rate: 0.6, source: "ADR-0046 rev A + adr:pocock-lifecycle-absorption — ≥60% of dispatched sessions show evidenced tdd engagement" },
  "deepen": { invocations_30d: 3, source: "Plan §Success metrics — ≥3 TECHDEBT entries" },
  "triage": { invocations_30d: 1, source: "Plan §Success metrics — ≥1 full backlog pass" },
};

// Pairs of skills where we measure: did A precede B within pairWindowSec, same session?
// "Sequencing rate" = (pairs observed where A→B) / (B invocations).
const SEQUENCING_PAIRS = parseSequencingPairs(args.pairs) ?? [
  { from: "grill-with-docs", to: "plan-feature", target: 0.5, source: "ADR-0045: ≥50% of /plan-feature preceded by /grill-with-docs" },
];

// Map the live disposition ledger into invocation-shaped events: a record with
// engaged:true means the skill's SKILL.md was read in-session (it was used). This is
// the live "which skill ran" signal that replaces the dead skill-telemetry stream.
// NOTE (carried C3 finding): dispositions are SUGGESTION-scoped, so skills used without
// a prior suggestion are undercounted, and `engaged` is a SKILL.md Read — an authoring/
// audit read can read-without-using. Absence here is not yet proof of disuse; the litter
// surface must add a use-vs-maintenance discriminator before it acts on these counts.
const dispositionEvents = readJsonl(dispositionPath);
const dispositionInvocations = dispositionEvents
  .filter((d) => d.event === "skill:disposition" && d.engaged)
  .map((d) => ({ event: "skill:invoked", skill: d.skill, session_id: d.session_id, ts: d.ts }));

const skillEvents = [...readJsonl(skillPath), ...dispositionInvocations];
const suggestionEvents = readJsonl(suggestionPath);

const skillInWindow = skillEvents.filter((e) => inWindow(e.ts));
const skillBaseline = baselinePath ? readJsonl(baselinePath) : [];

const counts = countBySkill(skillInWindow);
const baselineCounts = countBySkill(skillBaseline);
const sequencing = computeSequencing(skillInWindow, SEQUENCING_PAIRS, pairWindowSec);
const suggestionFollowed = computeSuggestionFollowed(suggestionEvents.filter((e) => inWindow(e.ts)), skillInWindow);

// Standup funnel computation (ADR-0054). Only enabled with --funnel=standup.
const standupEvents = funnelMode ? readJsonl(standupPath) : [];
const standupInWindow = standupEvents.filter((e) => inWindow(e.ts));
const standupFunnel = funnelMode ? computeStandupFunnel(standupInWindow, skillInWindow, launchWindowSec) : null;

// Dispatch funnel (adr:pocock-lifecycle-absorption). Only enabled with --funnel=dispatch.
// Measures the brief-injection channel: dispatched sessions (day-run / orchestrate-L3) emit
// explicit markers via scripts/dispatch-emit.mjs — session-start plus evidence-bearing
// skill-used events. No inference from SKILL.md reads; absence of an emit is a measured
// outcome, not a gap to paper over.
const dispatchEvents = dispatchFunnelMode ? readJsonl(dispatchPath).filter((e) => inWindow(e.ts)) : [];
const dispatchFunnel = dispatchFunnelMode ? computeDispatchFunnel(dispatchEvents) : null;

const report = {
  generated_at: new Date().toISOString(),
  window: {
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    days: Math.round((until - since) / (24 * 60 * 60 * 1000)),
  },
  sources: {
    skill_telemetry: skillPath,
    dispositions: dispositionPath,
    suggestion_telemetry: suggestionPath,
    standup_telemetry: funnelMode ? standupPath : null,
    dispatch_telemetry: dispatchFunnelMode ? dispatchPath : null,
    baseline: baselinePath,
  },
  totals: {
    skill_invocations_in_window: countInvocations(skillInWindow),
    skill_events_total: skillEvents.length,
    suggestion_events_in_window: suggestionEvents.filter((e) => inWindow(e.ts)).length,
    suggestion_events_total: suggestionEvents.length,
    standup_events_in_window: standupInWindow.length,
    baseline_skill_events: skillBaseline.length,
  },
  invocations: counts,
  baseline_diff: baselineCounts ? diffCounts(counts, baselineCounts) : null,
  sequencing,
  suggestion_followed: suggestionFollowed,
  standup_funnel: standupFunnel,
  dispatch_funnel: dispatchFunnel,
  targets: scoreTargets(counts, sequencing, TARGETS, SEQUENCING_PAIRS, dispatchFunnel),
};

if (format === "json") {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderMarkdown(report));
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq === -1) out[a.slice(2)] = true;
    else out[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return out;
}

function expandHome(p) {
  if (!p) return p;
  return p.startsWith("~") ? resolve(homedir(), p.slice(2)) : resolve(p);
}

function readJsonl(path) {
  if (!path || !existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const out = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip malformed */ }
  }
  return out;
}

function inWindow(ts) {
  if (!ts) return false;
  const t = typeof ts === "number" ? ts : Date.parse(ts);
  return Number.isFinite(t) && t >= since && t <= until;
}

// Knowledge file loads are logged with the same skill:invoked event but the
// skill name contains :knowledge:, :templates:, or :references:. Filter those
// out — they're not user-driven invocations, they're file fetches by skills.
function isUserInvocation(e) {
  if (!e.skill) return false;
  if (e.event && e.event !== "skill:invoked") return false;
  if (/:knowledge:|:templates:|:references:/.test(e.skill)) return false;
  return true;
}

// Telemetry uses <plugin>:<skill> format ("frame-standup:frame-standup").
// ADR targets reference bare skill names ("grill-with-docs"). Take the last
// segment as the canonical skill identifier.
function normalizeSkillName(s) {
  if (!s) return s;
  const parts = s.split(":");
  return parts[parts.length - 1];
}

function countInvocations(events) {
  return events.filter(isUserInvocation).length;
}

function countBySkill(events) {
  const m = new Map();
  for (const e of events) {
    if (!isUserInvocation(e)) continue;
    const name = normalizeSkillName(e.skill);
    m.set(name, (m.get(name) ?? 0) + 1);
  }
  return Object.fromEntries([...m.entries()].sort(([, a], [, b]) => b - a));
}

function diffCounts(now, base) {
  const all = new Set([...Object.keys(now), ...Object.keys(base)]);
  const out = {};
  for (const k of all) out[k] = { now: now[k] ?? 0, baseline: base[k] ?? 0, delta: (now[k] ?? 0) - (base[k] ?? 0) };
  return Object.fromEntries(Object.entries(out).sort(([, a], [, b]) => b.delta - a.delta));
}

function parseSequencingPairs(arg) {
  if (!arg) return null;
  return String(arg).split(";").map((p) => {
    const [from, to] = p.split(",").map((s) => s.trim());
    return { from, to, target: null, source: "user-provided" };
  }).filter((p) => p.from && p.to);
}

function computeSequencing(events, pairs, windowSec) {
  const bySession = new Map();
  for (const e of events) {
    if (!e.session_id) continue;
    if (!isUserInvocation(e)) continue;
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
    bySession.get(e.session_id).push({ skill: normalizeSkillName(e.skill), ts: parseTs(e.ts) });
  }
  for (const list of bySession.values()) list.sort((a, b) => a.ts - b.ts);

  const results = [];
  for (const pair of pairs) {
    let toCount = 0;
    let pairCount = 0;
    for (const list of bySession.values()) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].skill !== pair.to) continue;
        toCount++;
        const tTo = list[i].ts;
        for (let j = i - 1; j >= 0; j--) {
          const dt = (tTo - list[j].ts) / 1000;
          if (dt > windowSec) break;
          if (list[j].skill === pair.from) { pairCount++; break; }
        }
      }
    }
    const rate = toCount > 0 ? pairCount / toCount : 0;
    results.push({
      from: pair.from,
      to: pair.to,
      pair_count: pairCount,
      to_count: toCount,
      rate: Number(rate.toFixed(3)),
      target: pair.target,
      source: pair.source,
      window_seconds: windowSec,
    });
  }
  return results;
}

function parseTs(ts) {
  if (typeof ts === "number") return ts;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

function computeSuggestionFollowed(suggestionEvents, skillEvents) {
  const FOLLOW_WINDOW_MS = 5 * 60 * 1000;
  const bySessionInvocations = new Map();
  for (const e of skillEvents) {
    if (!e.session_id) continue;
    if (!isUserInvocation(e)) continue;
    if (!bySessionInvocations.has(e.session_id)) bySessionInvocations.set(e.session_id, []);
    bySessionInvocations.get(e.session_id).push({ skill: normalizeSkillName(e.skill), t: parseTs(e.ts) });
  }

  const totals = { suggested: 0, followed: 0, ignored: 0, no_match: 0 };
  const perSkill = new Map();

  for (const e of suggestionEvents) {
    if (e.event === "skill:suggested" && e.skill) {
      totals.suggested++;
      const skill = normalizeSkillName(e.skill);
      const skillStat = perSkill.get(skill) ?? { suggested: 0, followed: 0 };
      skillStat.suggested++;
      const tSugg = parseTs(e.ts);
      const sessionList = bySessionInvocations.get(e.session_id) ?? [];
      const followed = sessionList.some((inv) => inv.skill === skill && inv.t - tSugg >= 0 && inv.t - tSugg <= FOLLOW_WINDOW_MS);
      if (followed) {
        totals.followed++;
        skillStat.followed++;
      }
      perSkill.set(skill, skillStat);
    } else if (e.event === "skill:suggestion-ignored") {
      totals.ignored++;
    } else if (e.event === "skill:no-match") {
      totals.no_match++;
    }
  }

  const followedRate = totals.suggested > 0 ? Number((totals.followed / totals.suggested).toFixed(3)) : 0;
  const perSkillSorted = Object.fromEntries([...perSkill.entries()].map(([k, v]) => [k, {
    ...v,
    rate: v.suggested > 0 ? Number((v.followed / v.suggested).toFixed(3)) : 0,
  }]).sort(([, a], [, b]) => b.suggested - a.suggested));

  return { totals, overall_followed_rate: followedRate, per_skill: perSkillSorted, follow_window_minutes: 5 };
}

function computeStandupFunnel(standupEvents, skillEvents, launchWindowSec) {
  const suggested = standupEvents.filter((e) => e.event === "standup:suggested");
  const closed = standupEvents.filter((e) => e.event === "standup:closed");
  const closedById = new Map(closed.map((e) => [e.suggestion_id, e]));

  // Index skill invocations by skill name for fast lookup.
  const skillInvocations = skillEvents
    .filter((e) => isUserInvocation(e))
    .map((e) => ({ skill: normalizeSkillName(e.skill), t: parseTs(e.ts), session_id: e.session_id }));

  const perSuggestion = suggested.map((s) => {
    const tSugg = parseTs(s.ts);
    const targetSkill = normalizeSkill(s.skill);
    const launched = skillInvocations.some((inv) => {
      if (inv.skill !== targetSkill) return false;
      const dt = (inv.t - tSugg) / 1000;
      if (dt < 0 || dt > launchWindowSec) return false;
      return true;
    });
    const closeEvent = closedById.get(s.suggestion_id);
    return {
      suggestion_id: s.suggestion_id,
      standup_id: s.standup_id,
      skill: s.skill,
      priority_id: s.priority_id,
      launched,
      addressed: launched, // v1: launched ≡ addressed
      closed: !!closeEvent,
      closure_signal: closeEvent?.closure_signal ?? null,
    };
  });

  // Aggregate counts
  const totals = {
    suggested: perSuggestion.length,
    launched: perSuggestion.filter((p) => p.launched).length,
    addressed: perSuggestion.filter((p) => p.addressed).length,
    closed: perSuggestion.filter((p) => p.closed).length,
  };
  const launchRate = totals.suggested > 0 ? Number((totals.launched / totals.suggested).toFixed(3)) : 0;
  const closureRate = totals.suggested > 0 ? Number((totals.closed / totals.suggested).toFixed(3)) : 0;
  const launchedClosureRate = totals.launched > 0 ? Number((totals.closed / totals.launched).toFixed(3)) : 0;

  // Per-skill breakdown
  const bySkill = new Map();
  for (const p of perSuggestion) {
    const k = p.skill;
    if (!bySkill.has(k)) bySkill.set(k, { suggested: 0, launched: 0, closed: 0 });
    const s = bySkill.get(k);
    s.suggested++;
    if (p.launched) s.launched++;
    if (p.closed) s.closed++;
  }
  const perSkill = Object.fromEntries(
    [...bySkill.entries()].sort(([, a], [, b]) => b.suggested - a.suggested)
  );

  // Closure signal breakdown
  const closureSignals = { "bead-status": 0, "audit-disappeared": 0, "explicit": 0, "unknown": 0 };
  for (const p of perSuggestion) {
    if (!p.closed) continue;
    const sig = p.closure_signal ?? "unknown";
    closureSignals[sig] = (closureSignals[sig] ?? 0) + 1;
  }

  return {
    launch_window_seconds: launchWindowSec,
    totals,
    launch_rate: launchRate,
    closure_rate: closureRate,
    launched_to_closed_rate: launchedClosureRate,
    per_skill: perSkill,
    closure_signals: closureSignals,
    per_suggestion: perSuggestion,
  };
}

// Normalize a /skill or skill identifier as the standup events use a leading slash
// while skill-telemetry uses plugin:name format. Strip leading slash and any prefix.
function normalizeSkill(raw) {
  if (!raw) return "";
  const stripped = String(raw).replace(/^\//, "");
  return normalizeSkillName(stripped);
}

// Sessions are grouped by session_id when the emitter had one, else by ref —
// one dispatched session per marker group. Engagement = evidence-bearing skill-used
// events joined to the same group.
function computeDispatchFunnel(events) {
  const starts = events.filter((e) => e.event === "dispatch:session-start");
  const used = events.filter((e) => e.event === "dispatch:skill-used" && e.evidence);
  const keyOf = (e) => e.session_id ?? `${e.kind}:${e.ref}`;
  const sessions = new Map();
  for (const s of starts) {
    const k = keyOf(s);
    if (!sessions.has(k)) sessions.set(k, { kind: s.kind, ref: s.ref, skills: new Set() });
  }
  let orphaned = 0;
  for (const u of used) {
    const k = keyOf(u);
    if (sessions.has(k)) sessions.get(k).skills.add(normalizeSkill(u.skill));
    else orphaned++; // skill-used with no session-start marker — emit-discipline signal
  }
  const all = [...sessions.values()];
  const byKind = {};
  for (const s of all) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  const withSkill = (name) => all.filter((s) => s.skills.has(name)).length;
  const rate = (n) => (all.length ? Number((n / all.length).toFixed(3)) : null);
  return {
    sessions_total: all.length,
    sessions_by_kind: byKind,
    tdd_sessions: withSkill("tdd"),
    tdd_rate: rate(withSkill("tdd")),
    review_sessions: withSkill("code-review"),
    review_rate: rate(withSkill("code-review")),
    orphaned_skill_used: orphaned,
  };
}

function scoreTargets(counts, sequencing, targetsTable, pairs, dispatchFunnel) {
  const out = [];
  for (const [skill, t] of Object.entries(targetsTable)) {
    if (t.channel === "dispatch") {
      // Channel-appropriate target (adr:pocock-lifecycle-absorption): scored from the
      // dispatch funnel, never from interactive invocation counts. Without --funnel=dispatch
      // (or with zero dispatched sessions) the target is unmeasurable — reported as such,
      // never as a fake fail.
      const measurable = dispatchFunnel && dispatchFunnel.sessions_total > 0;
      const observed = measurable ? (skill === "tdd" ? dispatchFunnel.tdd_rate : dispatchFunnel.review_rate) : null;
      out.push({
        kind: "dispatch-rate",
        skill,
        observed,
        target: t.dispatch_rate,
        pass: measurable ? observed >= t.dispatch_rate : null,
        gap: measurable ? Number((t.dispatch_rate - observed).toFixed(3)) : null,
        source: t.source,
      });
      continue;
    }
    const observed = counts[skill] ?? 0;
    out.push({
      kind: "invocations",
      skill,
      observed,
      target: t.invocations_30d,
      pass: observed >= t.invocations_30d,
      gap: t.invocations_30d - observed,
      source: t.source,
    });
  }
  for (const pair of pairs) {
    if (pair.target == null) continue;
    const seq = sequencing.find((s) => s.from === pair.from && s.to === pair.to);
    const observed = seq?.rate ?? 0;
    out.push({
      kind: "sequencing",
      from: pair.from,
      to: pair.to,
      observed,
      target: pair.target,
      pass: observed >= pair.target,
      gap: Number((pair.target - observed).toFixed(3)),
      source: pair.source,
    });
  }
  return out;
}

function renderMarkdown(r) {
  const lines = [];
  lines.push(`# Skill adoption metrics`);
  lines.push("");
  lines.push(`Generated: ${r.generated_at}  `);
  lines.push(`Window: ${r.window.since} → ${r.window.until} (${r.window.days} days)`);
  lines.push(`Sources: invocations from \`${r.sources.dispositions}\` (live, ADR-0095; \`skill-telemetry\` frozen since 2026-05-12), suggestions from \`${r.sources.suggestion_telemetry}\`${r.sources.baseline ? `, baseline=\`${r.sources.baseline}\`` : ""}`);
  lines.push("");

  lines.push(`## Totals`);
  lines.push("");
  lines.push(`- Skill invocations (excludes knowledge/template/reference loads): **${r.totals.skill_invocations_in_window}** in window (lifetime: ${r.totals.skill_events_total} raw events)`);
  lines.push(`- Suggestion events in window: **${r.totals.suggestion_events_in_window}** (lifetime: ${r.totals.suggestion_events_total})`);
  if (r.totals.baseline_skill_events) lines.push(`- Baseline events: ${r.totals.baseline_skill_events}`);
  lines.push("");

  lines.push(`## Invocations by skill (normalized; knowledge loads excluded)`);
  lines.push("");
  const invEntries = Object.entries(r.invocations);
  if (invEntries.length === 0) {
    lines.push("_No user invocations in window._");
  } else {
    lines.push("| Skill | Count |");
    lines.push("|-------|------:|");
    for (const [skill, count] of invEntries.slice(0, 20)) lines.push(`| \`${skill}\` | ${count} |`);
  }
  lines.push("");

  if (r.baseline_diff) {
    lines.push(`## Delta vs baseline`);
    lines.push("");
    lines.push("| Skill | Baseline | Now | Delta |");
    lines.push("|-------|---------:|----:|------:|");
    for (const [skill, d] of Object.entries(r.baseline_diff).slice(0, 20)) {
      lines.push(`| \`${skill}\` | ${d.baseline} | ${d.now} | ${d.delta >= 0 ? "+" : ""}${d.delta} |`);
    }
    lines.push("");
  }

  lines.push(`## Sequencing (skill A precedes skill B within ${r.sequencing[0]?.window_seconds ?? 3600}s, same session)`);
  lines.push("");
  if (r.sequencing.length === 0) {
    lines.push("_No pairs configured._");
  } else {
    lines.push("| From → To | Pairs | B count | Rate | Target | Pass |");
    lines.push("|-----------|------:|--------:|-----:|-------:|:----:|");
    for (const s of r.sequencing) {
      const tgt = s.target != null ? `${s.target}` : "—";
      const pass = s.target != null ? (s.rate >= s.target ? "✓" : "✗") : "—";
      lines.push(`| \`${s.from}\` → \`${s.to}\` | ${s.pair_count} | ${s.to_count} | ${s.rate} | ${tgt} | ${pass} |`);
    }
  }
  lines.push("");

  lines.push(`## Suggestion-followed rate (within ${r.suggestion_followed.follow_window_minutes}min)`);
  lines.push("");
  const sf = r.suggestion_followed;
  lines.push(`Overall: **${sf.totals.followed} / ${sf.totals.suggested}** = **${(sf.overall_followed_rate * 100).toFixed(1)}%** followed`);
  lines.push(`Ignored: ${sf.totals.ignored}, no-match: ${sf.totals.no_match}`);
  lines.push("");
  const sfEntries = Object.entries(sf.per_skill);
  if (sfEntries.length > 0) {
    lines.push("| Skill | Suggested | Followed | Rate |");
    lines.push("|-------|----------:|---------:|-----:|");
    for (const [skill, v] of sfEntries.slice(0, 20)) {
      lines.push(`| \`${skill}\` | ${v.suggested} | ${v.followed} | ${(v.rate * 100).toFixed(1)}% |`);
    }
    lines.push("");
  }

  if (r.standup_funnel) {
    const f = r.standup_funnel;
    lines.push(`## Standup funnel (ADR-0054)`);
    lines.push("");
    lines.push(`Launch window: ${f.launch_window_seconds}s (${Math.round(f.launch_window_seconds / 3600)}h). Suggestions in window: **${f.totals.suggested}**.`);
    lines.push("");
    lines.push("| Stage | Count | Rate |");
    lines.push("|-------|------:|-----:|");
    lines.push(`| Suggested | ${f.totals.suggested} | 100% |`);
    lines.push(`| Launched (≡ addressed v1) | ${f.totals.launched} | ${(f.launch_rate * 100).toFixed(1)}% |`);
    lines.push(`| Closed | ${f.totals.closed} | ${(f.closure_rate * 100).toFixed(1)}% |`);
    lines.push("");
    if (f.totals.launched > 0) {
      lines.push(`**Launched → Closed rate:** ${(f.launched_to_closed_rate * 100).toFixed(1)}% (efficacy of launched work)`);
      lines.push("");
    }
    if (Object.keys(f.per_skill).length > 0) {
      lines.push("### Per-skill funnel");
      lines.push("");
      lines.push("| Skill | Suggested | Launched | Closed | Launch% | Closure% |");
      lines.push("|-------|----------:|---------:|-------:|--------:|---------:|");
      for (const [skill, s] of Object.entries(f.per_skill)) {
        const lp = s.suggested > 0 ? ((s.launched / s.suggested) * 100).toFixed(1) : "—";
        const cp = s.suggested > 0 ? ((s.closed / s.suggested) * 100).toFixed(1) : "—";
        lines.push(`| \`${skill}\` | ${s.suggested} | ${s.launched} | ${s.closed} | ${lp}% | ${cp}% |`);
      }
      lines.push("");
    }
    const sigs = f.closure_signals;
    const sigTotal = sigs["bead-status"] + sigs["audit-disappeared"] + sigs.explicit + sigs.unknown;
    if (sigTotal > 0) {
      lines.push("### Closure signal breakdown");
      lines.push("");
      lines.push(`- bead-status: ${sigs["bead-status"]} (${pct(sigs["bead-status"], sigTotal)})`);
      lines.push(`- audit-disappeared: ${sigs["audit-disappeared"]} (${pct(sigs["audit-disappeared"], sigTotal)})`);
      lines.push(`- explicit: ${sigs.explicit} (${pct(sigs.explicit, sigTotal)})`);
      if (sigs.unknown > 0) lines.push(`- unknown: ${sigs.unknown} (${pct(sigs.unknown, sigTotal)})`);
      lines.push("");
    }
  }

  if (r.dispatch_funnel) {
    const f = r.dispatch_funnel;
    lines.push(`## Dispatch funnel (adr:pocock-lifecycle-absorption)`);
    lines.push("");
    if (f.sessions_total === 0) {
      lines.push(`_No dispatched sessions in window — the brief-injection channel has not run yet. Channel targets are unmeasurable, not failing._`);
    } else {
      const kinds = Object.entries(f.sessions_by_kind).map(([k, n]) => `${k}: ${n}`).join(" · ");
      lines.push(`Dispatched sessions in window: **${f.sessions_total}** (${kinds})`);
      lines.push("");
      lines.push("| Engagement (evidence-bearing emits only) | Sessions | Rate |");
      lines.push("|------------------------------------------|---------:|-----:|");
      lines.push(`| \`tdd\` worked test-first | ${f.tdd_sessions} | ${(f.tdd_rate * 100).toFixed(1)}% |`);
      lines.push(`| \`code-review\` self-reviewed | ${f.review_sessions} | ${(f.review_rate * 100).toFixed(1)}% |`);
      if (f.orphaned_skill_used > 0) {
        lines.push("");
        lines.push(`⚠ ${f.orphaned_skill_used} skill-used emit(s) with no session-start marker — emit-discipline gap in the briefs, investigate before trusting rates.`);
      }
    }
    lines.push("");
  }

  lines.push(`## Targets vs actual (from ADRs)`);
  lines.push("");
  lines.push("| Kind | Target | Observed | Goal | Pass | Source |");
  lines.push("|------|--------|---------:|-----:|:----:|--------|");
  for (const t of r.targets) {
    const label = t.kind === "invocations" ? `\`${t.skill}\` invocations`
      : t.kind === "dispatch-rate" ? `\`${t.skill}\` dispatched-session rate`
      : `\`${t.from}\` → \`${t.to}\` rate`;
    const pass = t.pass === null ? "— (unmeasured)" : t.pass ? "✓" : "✗";
    const observed = t.observed === null ? "—" : t.observed;
    lines.push(`| ${t.kind} | ${label} | ${observed} | ${t.target} | ${pass} | ${t.source} |`);
  }
  lines.push("");

  const failing = r.targets.filter((t) => t.pass === false);
  if (failing.length > 0) {
    lines.push(`## Gaps`);
    lines.push("");
    for (const t of failing) {
      const what = t.kind === "invocations" ? `\`${t.skill}\` needs ${t.gap} more invocations`
        : t.kind === "dispatch-rate" ? `\`${t.skill}\` dispatched-session rate needs +${t.gap}`
        : `\`${t.from}\` → \`${t.to}\` rate needs +${t.gap}`;
      lines.push(`- ${what} (target: ${t.target}, observed: ${t.observed})`);
    }
    lines.push("");
  } else if (r.targets.length > 0) {
    lines.push(`_All measurable targets met (unmeasured channel targets excluded)._`);
    lines.push("");
  }

  return lines.join("\n");
}

function pct(n, total) {
  if (!total) return "0.0%";
  return ((n / total) * 100).toFixed(1) + "%";
}

// ── Trigger precision (rm:rm-l1-core#S9) ────────────────────────────────────

/**
 * Compute per-skill trigger precision from era-0093 fires joined to honest
 * dispositions. Pure.
 *
 * A fire = one deduped SUGGESTION_ID (earliest event). An HONEST follow = the
 * joined disposition row has engaged/acted (corroborated, independent signals) and
 * is not `skill-authoring` (two-track: authoring is neither a use-follow nor an
 * ignore — counted separately). Fires with no disposition row yet are `unresolved`
 * (pending/not reconciled) and stay in the fire denominator, stated.
 */
function computeTriggerPrecision(suggestionEvents, dispositionRows, { needsWork = NEEDS_WORK_2026_07_13 } = {}) {
  const preEraCounts = { "skill:suggested": 0, "skill:suggested-uninstalled": 0 };
  const fires = new Map(); // suggestion_id -> {skill, population, ts}
  for (const e of suggestionEvents) {
    const population = SUGGESTION_FIRE_EVENTS[e.event];
    if (!population) continue;
    if (!e.suggestion_id) { preEraCounts[e.event]++; continue; } // pre-ADR-0093 era: unjoinable, excluded, counted
    if (!e.skill) continue;
    const ts = e.suggested_at || e.ts || "";
    const prev = fires.get(e.suggestion_id);
    if (!prev || ts < prev.ts) fires.set(e.suggestion_id, { skill: normalizeSkillName(e.skill), population, ts });
  }

  const dispById = new Map(
    dispositionRows.filter((d) => d.event === "skill:disposition" && d.suggestion_id).map((d) => [d.suggestion_id, d]),
  );

  const perSkill = new Map();
  for (const [sid, f] of fires) {
    const d = dispById.get(sid);
    const s = perSkill.get(f.skill) ?? {
      fires: 0, honest_follows: 0, authoring: 0, unresolved: 0,
      by_population: { installed: { fires: 0, honest_follows: 0 }, uninstalled: { fires: 0, honest_follows: 0 } },
      timeline: [],
    };
    s.fires++;
    s.by_population[f.population].fires++;
    let followed = false;
    if (!d) s.unresolved++;
    else if (d.disposition === "skill-authoring") s.authoring++;
    else if (d.engaged || d.acted) {
      followed = true;
      s.honest_follows++;
      s.by_population[f.population].honest_follows++;
    }
    s.timeline.push({ ts: f.ts, followed });
    perSkill.set(f.skill, s);
  }

  const skills = [...perSkill.entries()].map(([skill, s]) => {
    s.timeline.sort((a, b) => (a.ts < b.ts ? -1 : 1));
    let streak = 0;
    for (let i = s.timeline.length - 1; i >= 0 && !s.timeline[i].followed; i--) streak++;
    const lastFollowed = [...s.timeline].reverse().find((t) => t.followed)?.ts ?? null;
    return {
      skill,
      fires: s.fires,
      honest_follows: s.honest_follows,
      authoring_excluded: s.authoring,
      unresolved: s.unresolved,
      ignore_streak: streak,
      last_followed: lastFollowed,
      needs_work: needsWork.includes(skill),
      by_population: s.by_population,
    };
  }).sort((a, b) => b.fires - a.fires || a.skill.localeCompare(b.skill));

  return {
    era: {
      boundary: "ADR-0093 (SUGGESTION_ID minted from 2026-06-13)",
      joinable_fires: fires.size,
      pre_era_excluded: preEraCounts,
      note: "pre-era installed-suggestion events carry no suggestion_id and are STRUCTURALLY UNJOINABLE to outcomes — counted, excluded, never fudged into either denominator.",
    },
    skills,
    over_firing_tail: skills.filter((s) => s.fires > 10 && s.honest_follows === 0),
    needs_work_set: { as_of: "2026-07-13", count: needsWork.length, skills: needsWork },
  };
}

function triggerPrecisionSelfTest() {
  const failures = [];
  const expect = (cond, msg) => { if (!cond) failures.push(msg); };
  const sugg = [
    { event: "skill:suggested", skill: "summarize", suggestion_id: "A", session_id: "s", ts: "2026-07-01T00:00:00Z" },
    { event: "skill:suggested", skill: "summarize", suggestion_id: "B", session_id: "s", ts: "2026-07-02T00:00:00Z" },
    { event: "skill:suggested-uninstalled", skill: "vault", suggestion_id: "C", session_id: "s", ts: "2026-07-03T00:00:00Z" },
    { event: "skill:suggested", skill: "vault", suggestion_id: "D", session_id: "s", ts: "2026-07-04T00:00:00Z" },
    { event: "skill:suggested", skill: "adr", suggestion_id: "E", session_id: "s", ts: "2026-07-05T00:00:00Z" },
    { event: "skill:suggested", skill: "legacy-era", session_id: "s", ts: "2026-05-01T00:00:00Z" }, // no suggestion_id → pre-era
    { event: "skill:suggestion-ignored", skill: "vault", suggestion_id: "D", session_id: "s", ts: "2026-07-04T00:01:00Z" }, // echo, not a fire
  ];
  const disp = [
    { event: "skill:disposition", suggestion_id: "A", skill: "summarize", disposition: "ignored", engaged: false, acted: false },
    { event: "skill:disposition", suggestion_id: "B", skill: "summarize", disposition: "ignored", engaged: false, acted: false },
    { event: "skill:disposition", suggestion_id: "C", skill: "vault", disposition: "engaged_no_act", engaged: true, acted: false },
    { event: "skill:disposition", suggestion_id: "E", skill: "adr", disposition: "skill-authoring", engaged: true, acted: false },
  ];
  const r = computeTriggerPrecision(sugg, disp, { needsWork: ["summarize"] });
  const get = (n) => r.skills.find((s) => s.skill === n);
  expect(r.era.joinable_fires === 5, `joinable fires: want 5, got ${r.era.joinable_fires}`);
  expect(r.era.pre_era_excluded["skill:suggested"] === 1, "pre-era fire must be counted+excluded");
  expect(get("summarize").fires === 2 && get("summarize").honest_follows === 0, "summarize 2 fires / 0 follows");
  expect(get("summarize").ignore_streak === 2 && get("summarize").last_followed === null, "summarize streak 2, never followed");
  expect(get("vault").fires === 2 && get("vault").honest_follows === 1, "vault 2 fires / 1 honest follow");
  expect(get("vault").by_population.uninstalled.honest_follows === 1 && get("vault").by_population.installed.fires === 1,
    "populations reported side by side");
  expect(get("vault").ignore_streak === 1, "vault current streak 1 (D unfollowed after C followed)");
  expect(get("adr").honest_follows === 0 && get("adr").authoring_excluded === 1, "skill-authoring excluded from follows (two-track)");
  expect(r.over_firing_tail.length === 0, "no skill exceeds 10 fires in fixture");
  expect(get("summarize").needs_work === true && get("vault").needs_work === false, "needs_work cross-reference");
  return failures;
}

function renderTriggerPrecision(r, generatedAt) {
  const L = [`# Trigger-precision report (rm:rm-l1-core#S9)`, ""];
  L.push(`Generated: ${generatedAt}`);
  L.push("");
  L.push(`## Era boundary (the honest denominator)`);
  L.push("");
  L.push(`- Joinable fires (carry a SUGGESTION_ID; ${r.era.boundary}): **${r.era.joinable_fires}**`);
  L.push(`- Pre-era events counted and EXCLUDED: ${r.era.pre_era_excluded["skill:suggested"]} installed + ${r.era.pre_era_excluded["skill:suggested-uninstalled"]} uninstalled`);
  L.push(`- ${r.era.note}`);
  L.push("");
  L.push(`## Over-firing tail — >10 fires, 0 honest follows`);
  L.push("");
  if (r.over_firing_tail.length === 0) L.push("_None._");
  else {
    L.push("| Skill | Fires | Ignore streak | needs_work (2026-07-13 audit) |");
    L.push("|-------|------:|--------------:|:---:|");
    for (const s of r.over_firing_tail) L.push(`| \`${s.skill}\` | ${s.fires} | ${s.ignore_streak} | ${s.needs_work ? "yes" : "no"} |`);
  }
  L.push("");
  L.push(`## All skills with joinable fires`);
  L.push("");
  L.push(`Honest follow = corroborated engagement or C2-valid acted in the disposition ledger (never the 5-min heuristic). skill-authoring rows are excluded from follows per the two-track rule (ADR-0098). Unresolved = no disposition row yet (stays in the fire denominator).`);
  L.push("");
  L.push("| Skill | Fires (inst/uninst) | Honest follows (inst/uninst) | Authoring | Unresolved | Ignore streak | Last followed | needs_work |");
  L.push("|-------|--------------------:|-----------------------------:|----------:|-----------:|--------------:|---------------|:---:|");
  for (const s of r.skills) {
    const bp = s.by_population;
    L.push(`| \`${s.skill}\` | ${s.fires} (${bp.installed.fires}/${bp.uninstalled.fires}) | ${s.honest_follows} (${bp.installed.honest_follows}/${bp.uninstalled.honest_follows}) | ${s.authoring_excluded} | ${s.unresolved} | ${s.ignore_streak} | ${s.last_followed ? s.last_followed.slice(0, 10) : "never"} | ${s.needs_work ? "yes" : "—"} |`);
  }
  L.push("");
  L.push(`## needs_work cross-reference`);
  L.push("");
  const nwFired = r.skills.filter((s) => s.needs_work);
  L.push(`${r.needs_work_set.count} skills carry the ${r.needs_work_set.as_of} audit's needs_work verdict; ${nwFired.length} of them have joinable fires in this window. Over-firing ∩ needs_work: ${r.over_firing_tail.filter((s) => s.needs_work).map((s) => `\`${s.skill}\``).join(", ") || "(none)"}.`);
  L.push("");
  return L.join("\n");
}

function triggerPrecisionMain(args) {
  if (args.check) {
    const failures = triggerPrecisionSelfTest();
    if (failures.length) {
      process.stderr.write("trigger-precision self-test FAILED:\n" + failures.map((f) => `  ✗ ${f}`).join("\n") + "\n");
      return 1;
    }
    writeSync(1, "trigger-precision self-test: era split, honest joins, populations, streaks, two-track exclusion ✓\n");
    return 0;
  }
  const suggestionEvents = readJsonl(suggestionPath);
  const dispositionRows = readJsonl(dispositionPath);
  const needsWork = args["needs-work"] ? String(args["needs-work"]).split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const r = computeTriggerPrecision(suggestionEvents, dispositionRows, needsWork ? { needsWork } : {});
  const generatedAt = new Date().toISOString();
  if (format === "json") writeSync(1, JSON.stringify({ generated_at: generatedAt, ...r }, null, 2) + "\n");
  else writeSync(1, renderTriggerPrecision(r, generatedAt) + "\n");
  return 0;
}
