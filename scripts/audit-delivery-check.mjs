#!/usr/bin/env node
// audit-delivery-check.mjs — deterministic delivery oracle for the 2026-07-04 audit program
// (MULTIAGENT-SDLC-AUDIT / AGENTIC-INTEGRATION-PLAN / FLEET-COORDINATION-EXTENSIONS).
//
// Every promised slice has a machine-checkable predicate here. Statuses:
//   DELIVERED  — the predicate holds; evidence shown
//   PARTIAL    — a weaker form holds (e.g. docs honest about a gap, but gap not closed)
//   MISSING    — not started (the expected state at baseline; not a failure)
//   REGRESSED  — a baseline truth from the audit date no longer holds (always a failure)
//   SKIP       — target repo not on disk; nothing asserted
//
// Shadow by default (exit 0). `--check` exits 1 on any REGRESSED or on program staleness
// (>STALE_DAYS since the last commit touching program files while work remains undelivered).
// `--json` emits machine-readable output for the weekly measurement session / standup.
//
// Design rule: predicates are cheap, deterministic, and print their evidence so a human can
// spot-check any verdict in seconds. No LLM, no network.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIBLINGS = path.resolve(CORE, "..");
const STALE_DAYS = 14;

const repoPath = (repo) => (repo === "core" ? CORE : path.join(SIBLINGS, repo));

function read(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

// grep helper: returns "path:line: text" for the first match, else null
function grep(file, re) {
  const body = read(file);
  if (body === null) return null;
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]))
      return `${path.relative(SIBLINGS, file)}:${i + 1}: ${lines[i].trim().slice(0, 120)}`;
  }
  return null;
}

function inRepo(repo, rel) {
  return path.join(repoPath(repo), rel);
}

const D = (evidence) => ({ status: "DELIVERED", evidence });
const P = (evidence) => ({ status: "PARTIAL", evidence });
const M = (evidence) => ({ status: "MISSING", evidence });
const R = (evidence) => ({ status: "REGRESSED", evidence });
const S = (evidence) => ({ status: "SKIP", evidence });

// A check may declare `baseline: true` — meaning the predicate was TRUE on 2026-07-04,
// so a failure is REGRESSED, not MISSING.
const CHECKS = [
  // ---- Baseline regression guards (true at audit time; must stay true) ----
  {
    id: "BASE.1",
    slice: "ADR-0093",
    title: "suggestion_id still minted at suggestion time",
    repo: "core",
    baseline: true,
    run: () => grep(inRepo("core", "scripts/hooks/suggest-skill.sh"), /suggestion_id|SUGGESTION_ID/),
  },
  {
    id: "BASE.2",
    slice: "queue",
    title: "queue-claim still CAS (atomic conditional claim)",
    repo: "core",
    baseline: true,
    run: () => grep(inRepo("core", "scripts/hooks/bead-emit.mjs"), /queue-claim|queue.*claim/i),
  },
  {
    id: "BASE.3",
    slice: "odometer",
    title: "record-movement still refuses non-merged PRs",
    repo: "core",
    baseline: true,
    run: () => grep(inRepo("core", "scripts/record-movement.mjs"), /merged/i),
  },

  // ---- H0: commit the ground truth ----
  {
    id: "H0.1",
    slice: "H0",
    title: "OPAV master plan committed to the repo",
    repo: "core",
    run: () => {
      for (const p of [
        inRepo("core", "OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md"),
        inRepo("core", "decisions/OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md"),
      ])
        if (existsSync(p)) return D(path.relative(SIBLINGS, p));
      return M("file not found in core root or decisions/");
    },
  },
  {
    id: "H0.2",
    slice: "H0/O9",
    title: "gate spine functional (workflows dist built or build-on-demand)",
    repo: "core",
    run: () =>
      existsSync(inRepo("core", "packages/workflows/dist/tracking/gate-event.js"))
        ? D("packages/workflows/dist/tracking/gate-event.js exists")
        : grep(inRepo("core", "scripts/gate-event.mjs"), /build-on-demand|buildIfMissing/) ??
          M("no dist build and no build-on-demand path in gate-event.mjs"),
  },
  {
    id: "H0.3",
    slice: "H0/T11",
    title: "daily-logger CLAUDE.md no longer claims nonexistent bead-store.ts",
    repo: "daily-logger",
    run: () => {
      const claude = inRepo("daily-logger", "CLAUDE.md");
      if (!existsSync(claude)) return S("repo/CLAUDE.md not on disk");
      const claims = grep(claude, /bead-store\.ts/);
      if (!claims) return D("no bead-store.ts reference remains");
      return existsSync(inRepo("daily-logger", "src/bead-store.ts"))
        ? D("bead-store.ts now exists on disk")
        : M(`doc still claims absent file — ${claims}`);
    },
  },
  {
    id: "H0.4",
    slice: "H0/P1",
    title: "cockpit docs honest about github/standup adapters",
    repo: "morning-cockpit",
    run: () => {
      const claude = inRepo("morning-cockpit", "CLAUDE.md");
      if (!existsSync(claude)) return S("repo/CLAUDE.md not on disk");
      const built =
        existsSync(inRepo("morning-cockpit", "packages/server/src/adapters/github.ts")) &&
        existsSync(inRepo("morning-cockpit", "packages/server/src/adapters/standup.ts"));
      if (built) return D("both adapters now exist on disk");
      const honest = grep(claude, /NOT BUILT|not built|planned|unbuilt/i);
      return honest ? P(`adapters absent but docs flag it — ${honest}`) : M("docs list adapters as live; files absent");
    },
  },

  // ---- H1/I1: trace identity ----
  {
    id: "I1.1",
    slice: "H1/I1",
    title: "trace_id minted/threaded in telemetry lib or bead emitter",
    repo: "core",
    run: () =>
      grep(inRepo("core", "scripts/hooks/_lib.sh"), /trace_id/) ??
      grep(inRepo("core", "scripts/hooks/bead-emit.mjs"), /trace_id/) ??
      M("no trace_id in _lib.sh or bead-emit.mjs"),
  },
  {
    id: "I1.2",
    slice: "H1/I1",
    title: "Claude-Session commit trailers parsed by a consumer",
    repo: "daily-logger",
    run: () => {
      if (!existsSync(inRepo("daily-logger", "src"))) return S("repo not on disk");
      for (const f of ["src/collect-context.ts", "src/collect-telemetry.ts"]) {
        const hit = grep(inRepo("daily-logger", f), /Claude-Session/);
        if (hit) return D(hit);
      }
      return M("no consumer parses Claude-Session trailers");
    },
  },

  // ---- H2/T1: repoint dead consumers ----
  {
    id: "H2.1",
    slice: "H2/T1",
    title: "daily-logger reads the live skill-dispositions stream",
    repo: "daily-logger",
    run: () => {
      const f = inRepo("daily-logger", "src/collect-telemetry.ts");
      if (!existsSync(f)) return S("file not on disk");
      return grep(f, /skill-dispositions/) ?? M("collect-telemetry.ts still reads only the frozen skill-telemetry stream");
    },
  },

  // ---- H4/I6: validation gate + manual-path guard ----
  {
    id: "H4.1",
    slice: "H4/I6",
    title: "day-runner records test/success-criterion checks on the slice",
    repo: "core",
    run: () =>
      grep(inRepo("core", "scripts/day-runner.mjs"), /success_criterion|runChecks|checks\s*[:=]/) ??
      M("day-runner verify is still PR-shape only (no test/criterion check)"),
  },
  {
    id: "H4.2",
    slice: "H4/O3",
    title: "record-movement manual path stamped/guarded",
    repo: "core",
    run: () =>
      grep(inRepo("core", "scripts/record-movement.mjs"), /manual-unverified|override-reason/) ??
      M("manual movement path has no unverified stamp or override reason"),
  },

  // ---- H5/F2: retry, dedup, quarantine ----
  {
    id: "H5.1",
    slice: "H5/F2",
    title: "queue has attempts/quarantine semantics",
    repo: "core",
    run: () =>
      grep(inRepo("core", "scripts/hooks/bead-emit.mjs"), /quarantin|attempts/i) ??
      grep(inRepo("core", "scripts/day-runner.mjs"), /quarantin|attempts/i) ??
      M("no attempts counter or quarantined state in queue layer"),
  },

  // ---- H6: first shadow-gate promotion ----
  {
    id: "H6.1",
    slice: "H6",
    title: "roadmap/northstar lint wired into CI",
    repo: "core",
    run: () => {
      const dir = inRepo("core", ".github/workflows");
      if (!existsSync(dir)) return S("no workflows dir");
      for (const f of readdirSync(dir)) {
        const hit = grep(path.join(dir, f), /roadmap-lint|northstar-lint/);
        if (hit) return D(hit);
      }
      return M("no CI workflow invokes roadmap-lint/northstar-lint");
    },
  },

  // ---- H7/E1: re-measurement cadence ----
  {
    id: "H7.1",
    slice: "H7/E1",
    title: "a second skill-metrics snapshot exists (first re-measurement)",
    repo: "core",
    run: () => {
      const dir = inRepo("core", "docs");
      const snaps = readdirSync(dir).filter((f) => /^skill-metrics-\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
      return snaps.length > 1
        ? D(`${snaps.length} snapshots; latest ${snaps[snaps.length - 1]}`)
        : M(`only ${snaps.join(", ") || "none"} — cadence never resumed`);
    },
  },

  // ---- I2: outcome capture ----
  {
    id: "I2.1",
    slice: "I2",
    title: "outcome field captured where humans touch agent output",
    repo: "core",
    run: () =>
      grep(inRepo("core", "scripts/hooks/bead-emit.mjs"), /outcome.*(accepted|rejected)/i) ??
      grep(inRepo("daily-logger", "src/schema.ts"), /outcome/) ??
      M("no outcome field in bead emitter or article schema"),
  },

  // ---- I3: failure taxonomy ----
  {
    id: "I3.1",
    slice: "I3",
    title: "failure taxonomy exists and is versioned",
    repo: "core",
    run: () => {
      for (const p of ["decisions/failure-taxonomy.md", "failure-taxonomy.md"])
        if (existsSync(inRepo("core", p))) return D(p);
      return M("decisions/failure-taxonomy.md absent — the weekly error-analysis ritual has not run");
    },
  },

  // ---- I4: golden suites ----
  {
    id: "I4.1",
    slice: "I4",
    title: "first golden eval suite exists (daily-logger)",
    repo: "daily-logger",
    run: () => {
      const root = repoPath("daily-logger");
      if (!existsSync(root)) return S("repo not on disk");
      if (existsSync(path.join(root, "evals"))) return D("evals/ directory exists");
      const srcTests = path.join(root, "src", "__tests__");
      if (existsSync(srcTests)) {
        const evalFiles = readdirSync(srcTests).filter((f) => /eval|golden/i.test(f));
        if (evalFiles.length) return D(`src/__tests__/${evalFiles[0]}`);
      }
      return M("no evals/ dir or golden/eval test files");
    },
  },

  // ---- I5: deterministic fact-check + calibrated judge ----
  {
    id: "I5.1",
    slice: "I5/TD-001",
    title: "verifyFileExistenceClaims implemented",
    repo: "daily-logger",
    run: () => {
      const src = path.join(repoPath("daily-logger"), "src");
      if (!existsSync(src)) return S("repo not on disk");
      for (const f of readdirSync(src).filter((f) => f.endsWith(".ts"))) {
        const hit = grep(path.join(src, f), /verifyFileExistenceClaims/);
        if (hit) return D(hit);
      }
      return M("designed in TECHDEBT since March; still unbuilt");
    },
  },
  {
    id: "I5.2",
    slice: "I5/P7",
    title: "missing article status no longer implicitly published",
    repo: "daily-logger",
    run: () => {
      const f = inRepo("daily-logger", "src/build-api.ts");
      if (!existsSync(f)) return S("file not on disk");
      const bad = grep(f, /implicitly accepted/i);
      return bad ? M(`still defaults missing status to accepted — ${bad}`) : D("implicit-accept default removed");
    },
  },

  // ---- I8: SLOs in standup ----
  {
    id: "I8.1",
    slice: "I8/H7",
    title: "frame-standup carries an SLO/error-budget block",
    repo: "core",
    run: () =>
      grep(inRepo("core", ".claude/skills/frame-standup/SKILL.md"), /\bSLOs?\b|error.budget/i) ??
      M("standup skill has no SLO block"),
  },

  // ---- F1: verifiability-sorted dispatch ----
  {
    id: "F1.1",
    slice: "F1",
    title: "roadmap schema carries autonomy_fit / machine check field",
    repo: "core",
    run: () =>
      grep(inRepo("core", "decisions/northstar/roadmap-schema.md"), /autonomy_fit|`check`|check:/) ??
      M("schema has no machine-checkable success-command field"),
  },

  // ---- F5: problems-view taxonomy ----
  {
    id: "F5.1",
    slice: "F5",
    title: "cockpit liveness knows Stalled/Zombie states",
    repo: "morning-cockpit",
    run: () => {
      const f = inRepo("morning-cockpit", "packages/shared/src/liveness.ts");
      if (!existsSync(f)) return S("file not on disk");
      return grep(f, /stalled|zombie/i) ?? M("liveness still only live/idle/dark");
    },
  },
  {
    id: "F5.2",
    slice: "F5/P2",
    title: "stale seeded critical chain removed or badged",
    repo: "morning-cockpit",
    run: () => {
      const f = inRepo("morning-cockpit", "packages/server/src/fleet-config.ts");
      if (!existsSync(f)) return S("file not on disk");
      const stale = grep(f, /empty log/i);
      return stale ? M(`resolved blocker still shown as #1 critical — ${stale}`) : D("stale 'bead_events empty log' chain gone");
    },
  },

  // ---- F6: context budgets ----
  {
    id: "F6.1",
    slice: "F6",
    title: "context-budgets doc carries the ~100k hard line",
    repo: "core",
    run: () =>
      grep(inRepo("core", ".claude/skills/orchestrate/knowledge/context-budgets.md"), /100[k,]|100,?000|dumb zone/i) ??
      M("no numeric context ceiling in context-budgets.md"),
  },

  // ---- F10: operational hygiene ----
  {
    id: "F10.1",
    slice: "F10",
    title: "Dolt >= 2.1.0 pin documented (GC/writer deadlock fix)",
    repo: "core",
    run: () => {
      for (const p of ["docs", "decisions", "scripts"]) {
        const dir = inRepo("core", p);
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir)) {
          const full = path.join(dir, f);
          if (!/\.(md|mjs|sh)$/.test(f)) continue;
          if (f === "audit-delivery-check.mjs") continue; // never match this checker itself
          const hit = grep(full, /[Dd]olt.*2\.1\.0|2\.1\.0.*[Dd]olt/);
          if (hit) return D(hit);
        }
      }
      return M("no Dolt version pin found in docs/decisions/scripts");
    },
  },

  // ---- P6: vault sync freshness (recurring, not one-shot) ----
  {
    id: "P6.1",
    slice: "P6/H7",
    title: `selfco sync ran within ${STALE_DAYS} days`,
    repo: "selfco",
    run: () => {
      const log = path.join(SIBLINGS, "selfco", "wiki", "log.md");
      const body = read(log);
      if (body === null) return S("selfco/wiki/log.md not on disk");
      const dates = [...body.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] sync \|/gm)].map((m) => m[1]).sort();
      if (!dates.length) return M("no sync entries in wiki/log.md");
      const last = dates[dates.length - 1];
      const age = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      return age <= STALE_DAYS ? D(`last sync ${last} (${age}d ago)`) : M(`last sync ${last} (${age}d ago; > ${STALE_DAYS}d)`);
    },
  },
];

// ---- program freshness: has anything moved lately? ----
function programFreshness() {
  const tracked = [
    "MULTIAGENT-SDLC-AUDIT-2026-07-04.md",
    "AGENTIC-INTEGRATION-PLAN-2026-07-04.md",
    "FLEET-COORDINATION-EXTENSIONS-2026-07-04.md",
    "decisions/northstar/roadmap-l2-ojfbot.md",
    "decisions/northstar/status.jsonl",
    "scripts/audit-delivery-check.mjs",
  ];
  try {
    const iso = execFileSync("git", ["-C", CORE, "log", "-1", "--format=%cI", "--", ...tracked], {
      encoding: "utf8",
    }).trim();
    if (!iso) return { days: null, note: "no commits touch program files" };
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return { days, note: `last program commit ${iso.slice(0, 10)} (${days}d ago)` };
  } catch {
    return { days: null, note: "git unavailable" };
  }
}

// ---- run ----
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const gate = args.includes("--check");

const results = CHECKS.map((c) => {
  let r;
  try {
    r = c.run();
    // grep-style checks return a string (evidence) or null
    if (typeof r === "string") r = D(r);
    if (r === null) r = c.baseline ? R("baseline predicate no longer holds") : M("predicate not satisfied");
  } catch (e) {
    r = c.baseline ? R(`check threw: ${e.message}`) : M(`check threw: ${e.message}`);
  }
  if (c.baseline && r.status === "MISSING") r = R(r.evidence);
  return { id: c.id, slice: c.slice, title: c.title, repo: c.repo, ...r };
});

const counts = {};
for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
const fresh = programFreshness();
const undelivered = results.filter((r) => r.status === "MISSING" || r.status === "PARTIAL").length;
const stale = fresh.days !== null && fresh.days > STALE_DAYS && undelivered > 0;
const regressed = (counts.REGRESSED ?? 0) > 0;

if (asJson) {
  console.log(
    JSON.stringify(
      { date: new Date().toISOString().slice(0, 10), counts, stale, freshness: fresh, results },
      null,
      2
    )
  );
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log("audit-delivery-check — 2026-07-04 program\n");
  for (const r of results)
    console.log(`  ${pad(r.status, 10)} ${pad(r.id, 7)} ${pad(r.slice, 12)} ${r.title}\n  ${" ".repeat(10)} └─ ${r.evidence}`);
  console.log(
    `\n  summary: ${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(" · ")}`
  );
  console.log(`  freshness: ${fresh.note}${stale ? `  ⚠ STALE (> ${STALE_DAYS}d with ${undelivered} undelivered)` : ""}`);
  if (regressed) console.log("  ⚠ REGRESSION: a baseline truth from the audit no longer holds");
  if (gate) console.log(`  gate: ${regressed || stale ? "FAIL" : "PASS"} (--check gates on regression/staleness only)`);
}

process.exit(gate && (regressed || stale) ? 1 : 0);
