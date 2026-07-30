# ADR-XXXX: The installed agent harness is tracked, not gitignored

slug: installed-harness-is-tracked
serial: draft
rev:
Date: 2026-07-30
Status: Proposed
domain: meta
type: convention
OKR: _pending_
Commands affected: /fleet-onboard, /skill-loader
Repos affected: all repos targeted by scripts/install-agents.sh
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [skill-directories-over-flat-files, skills-directory-rename-from-commands, skill-telemetry-and-intent-matching, ubiquitous-language-layer]
  parent:
  part-of-series:

---

## Context

`scripts/install-agents.sh` wires a sibling repo into the fleet agent harness by writing symlinks
into `../../core`: `.claude/skills/<name>` per skill (adr:skill-directories-over-flat-files), the
`.claude/commands → skills` compat link (adr:skills-directory-rename-from-commands),
`.claude/settings.json` plus `scripts/hooks/` (adr:skill-telemetry-and-intent-matching),
`domain-knowledge/` (adr:ubiquitous-language-layer), and `decisions/core`.

**No ADR has ever said whether the result gets committed.** Left undecided, the fleet drifted into
four different answers, measured 2026-07-30:

| Repo | Tracked harness paths | Behaviour |
|---|---|---|
| mirrorworld | 77 | tracks everything, including `personal-knowledge/` |
| daily-logger | 46 | tracks `.claude/`, gitignores `domain-knowledge/` + `personal-knowledge/` |
| morning-cockpit | 1 | effectively untracked |
| silicon-empires | 1 | effectively untracked |
| fairway | 0 | untracked |
| bldgblog-corpus | 0 | untracked |
| capture-agent | 0 (before this ADR) | installed 2026-07-28, never committed |

The capture-agent case is what forced the decision. A full install ran on 2026-07-28 and was never
committed, so 34 skills, the telemetry hook, and the UL layer existed **only on the machine that ran
the installer**. Nothing in the repo recorded that the harness was supposed to be there, so the
absence was indistinguishable from a repo that had never been onboarded.

Two facts constrain the choice:

1. These are mode-`120000` entries. Git stores the **link path**, not the target's content. Tracking
   them therefore cannot leak core's contents into a sibling repo, and cannot desynchronise from
   core — the link always resolves to whatever core currently holds.
2. A clone without a sibling `core/` checkout gets dangling links. Dangling symlinks are inert to
   git and to language tooling; they matter only to an agent that tries to read them, which is
   already broken in that environment for want of core.

## Decision

**Commit the installed harness.** Every path `install-agents.sh` writes is tracked in the target
repo, following the mirrorworld convention.

One exception: **`personal-knowledge/` is never installed or tracked in a sibling repo.**
`install-agents.sh:20` already describes it as a "local file, gitignored" and `core/CLAUDE.md`
scopes it to core only; the installer should stop writing it, and existing instances are removed.

## Consequences

### Gains

- A repo's harness state becomes **legible from the repo itself**. "Which skills does this repo
  have?" is answered by `git ls-files .claude/skills/`, not by trusting that someone ran a script.
- Onboarding gaps become reviewable. The capture-agent bead gap — 9 beads in `.handoff/` and no
  `bead` skill — was invisible for two days precisely because nothing was committed.
- `/fleet-onboard --reconcile` gains a real signal to diff against, instead of inferring intent from
  an uncommitted working tree.
- CI runners and fresh clones get the harness. This matters now that adr:always-green-ci-policy rev A
  puts capture-agent inside required-check enforcement.

### Costs

- A standalone clone (no sibling `core/`) carries dangling symlinks. Inert, but they will look like
  breakage to anyone unfamiliar with the layout — the README of an onboarded repo should say so.
- Repo file counts grow by ~48 entries. Every one is a link, so byte cost is negligible, but
  `git status` and diff review get noisier on the onboarding commit itself.
- The six drifted repos are now non-conformant by definition. This ADR does **not** retrofit them;
  that is a separate sweep, deliberately deferred because three of them (`mc-perf`, `mc-motion`,
  `core`) had in-flight branches at filing time.

### Neutral

- Tracking a symlink pins the *path*, not the version. Skills stay live-updating from core, which is
  the existing behaviour and is unchanged by this decision.
- Repos that vendor rather than symlink (if any appear later) are out of scope here.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Gitignore the whole harness; `install-agents.sh` is the reproducer | Makes harness state invisible to review and to CI. This is the status quo that let capture-agent sit un-onboarded-looking for two days, and that produced four different answers across the fleet. |
| daily-logger split — track `.claude/`, ignore `domain-knowledge/` + `decisions/core` | Coherent, and it was the leading candidate: the ignored paths are pure reference material. Rejected because the split is hard to state as a rule anyone will remember, and it leaves `/fleet-onboard --reconcile` with a partial picture. The dangling-clone cost it avoids is small and already accepted for `.claude/`. |
| Vendor real files instead of symlinks | Duplicates core's skills into every repo and immediately desynchronises. Directly contradicts adr:skill-directories-over-flat-files. |
| Leave it undecided, per-repo choice | This is what produced the drift being fixed. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-30 — fleet drift measured across 7 repos while closing capture-agent's uncommitted 2026-07-28 install |
| Implementation start | 2026-07-30 — capture-agent onboarding commit |
| Implementation end | _pending_ — six drifted repos not retrofitted; see Costs |
