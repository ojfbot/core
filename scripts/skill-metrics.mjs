#!/usr/bin/env node
// skill-metrics.mjs — adoption metrics from skill-telemetry.jsonl + suggestion-telemetry.jsonl.
// No external deps. Reads JSONL, computes invocation counts, sequencing pairs,
// suggestion-followed rate, optional baseline diff. Outputs markdown or JSON.
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

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const skillPath = expandHome(args["skill-telemetry"] ?? "~/.claude/skill-telemetry.jsonl");
const suggestionPath = expandHome(args["suggestion-telemetry"] ?? "~/.claude/suggestion-telemetry.jsonl");
const standupPath = expandHome(args["standup-telemetry"] ?? "~/.claude/standup-telemetry.jsonl");
const baselinePath = args.baseline ? expandHome(args.baseline) : null;
const format = args.format ?? "markdown";
const pairWindowSec = Number(args["pair-window"] ?? 3600);
const launchWindowSec = Number(args["launch-window"] ?? 86400); // 24h default per ADR-0054
const funnelMode = args.funnel === "standup" || args.funnel === true;
const since = args.since ? Date.parse(args.since) : Date.now() - 30 * 24 * 60 * 60 * 1000;
const until = args.until ? Date.parse(args.until) : Date.now();

// ADR-defined adoption targets. Sourced from ADRs 0044-0049 and the Pocock plan.
// When ADRs change, update this table.
const TARGETS = {
  "grill-with-docs": { invocations_30d: 10, source: "ADR-0045 + plan §Success metrics" },
  "tdd": { invocations_30d: 5, source: "ADR-0046 + plan §Success metrics" },
  "deepen": { invocations_30d: 3, source: "Plan §Success metrics — ≥3 TECHDEBT entries" },
  "triage": { invocations_30d: 1, source: "Plan §Success metrics — ≥1 full backlog pass" },
};

// Pairs of skills where we measure: did A precede B within pairWindowSec, same session?
// "Sequencing rate" = (pairs observed where A→B) / (B invocations).
const SEQUENCING_PAIRS = parseSequencingPairs(args.pairs) ?? [
  { from: "grill-with-docs", to: "plan-feature", target: 0.5, source: "ADR-0045: ≥50% of /plan-feature preceded by /grill-with-docs" },
];

const skillEvents = readJsonl(skillPath);
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

const report = {
  generated_at: new Date().toISOString(),
  window: {
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    days: Math.round((until - since) / (24 * 60 * 60 * 1000)),
  },
  sources: {
    skill_telemetry: skillPath,
    suggestion_telemetry: suggestionPath,
    standup_telemetry: funnelMode ? standupPath : null,
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
  targets: scoreTargets(counts, sequencing, TARGETS, SEQUENCING_PAIRS),
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

function scoreTargets(counts, sequencing, targetsTable, pairs) {
  const out = [];
  for (const [skill, t] of Object.entries(targetsTable)) {
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
  lines.push(`Sources: \`${r.sources.skill_telemetry}\`, \`${r.sources.suggestion_telemetry}\`${r.sources.baseline ? `, baseline=\`${r.sources.baseline}\`` : ""}`);
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

  lines.push(`## Targets vs actual (from ADRs)`);
  lines.push("");
  lines.push("| Kind | Target | Observed | Goal | Pass | Source |");
  lines.push("|------|--------|---------:|-----:|:----:|--------|");
  for (const t of r.targets) {
    const label = t.kind === "invocations" ? `\`${t.skill}\` invocations` : `\`${t.from}\` → \`${t.to}\` rate`;
    const pass = t.pass ? "✓" : "✗";
    lines.push(`| ${t.kind} | ${label} | ${t.observed} | ${t.target} | ${pass} | ${t.source} |`);
  }
  lines.push("");

  const failing = r.targets.filter((t) => !t.pass);
  if (failing.length > 0) {
    lines.push(`## Gaps`);
    lines.push("");
    for (const t of failing) {
      const what = t.kind === "invocations" ? `\`${t.skill}\` needs ${t.gap} more invocations` : `\`${t.from}\` → \`${t.to}\` rate needs +${t.gap}`;
      lines.push(`- ${what} (target: ${t.target}, observed: ${t.observed})`);
    }
    lines.push("");
  } else if (r.targets.length > 0) {
    lines.push(`_All targets met._`);
    lines.push("");
  }

  return lines.join("\n");
}

function pct(n, total) {
  if (!total) return "0.0%";
  return ((n / total) * 100).toFixed(1) + "%";
}
