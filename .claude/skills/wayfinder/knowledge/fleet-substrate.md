# Wayfinder — fleet substrate and charting modes

`/wayfinder` is installed at user scope (`scope: ["user"]` in `skill-catalog.json`), so it can
fire in any repo on this machine — including repos with no northstars, no `core/decisions/`, and
no fleet tracker. It therefore charts in one of **two modes**, decided by substrate
resolvability rather than by path.

## Deciding the mode

```bash
node "<skill>/scripts/resolve-anchor.mjs" --detect          # human
node "<skill>/scripts/resolve-anchor.mjs" --detect --json   # { mode, core_root, reason, registry_entries }
```

The script walks ancestors of the cwd looking for `decisions/northstar/README.md`, and for
`core/decisions/northstar/README.md` (the sibling-repo vantage — cwd is `~/ojfbot/<app>`, core is
`~/ojfbot/core`). **Full** mode requires that registry to parse with at least one entry.
Everything else is **lite**.

Detection is deliberately *not* a `~/ojfbot` path prefix: a core checkout moved elsewhere still
charts in full mode, and a scratch directory that happens to be named `ojfbot` does not.

Announce the mode in one line at the start of a charting session. A lite map must never be
mistaken for an anchored one.

## What changes between modes

| | **full** (substrate resolves) | **lite** (it doesn't) |
|---|---|---|
| Map path | `<core_root>/decisions/wayfinder/<slug>.md` | `<cwd>/decisions/wayfinder/<slug>.md` |
| `northstar:` anchor | resolve-or-fail via the script | omitted — a claimed anchor is an **error**, never a silent skip |
| Ticket projection | GitHub child issues, `wayfinder:<type>`, native blocked-by edges | table rows in the map only; `tracker_issue:` omitted |
| selfco reference read | yes (design-time, read-only) | skipped |
| Handoff | `/plan-feature --from-conversation` → `/orchestrate --emit=github-issues`, slices appended to the northstar's roadmap | `/plan-feature` only; no roadmap append |

Full-mode maps all land in one library under core, which is what lets any surface enumerate every
open frontier in a single read. Lite-mode maps stay local to the repo that produced them.

## Resolving an anchor

```bash
node "<skill>/scripts/resolve-anchor.mjs" --anchor=ns:l2-ojfbot#P1
```

Exit 0 with the resolved property, or exit 1 with the reason. This is the mechanism behind
"resolve-or-fail" — run it before writing a `northstar:` line, and do not write the anchor if it
fails.

## Sharp edges

- **Slugs are immutable identity** (ADR-0087) and are matched verbatim. `buddy-check` is
  registered *without* the `l1-` prefix; `l1-virtuallight` is lowercase while its directory is
  `virtualLight`. Never case-fold or prefix-normalize either — the script won't, and neither
  should prose in a map.
- **Registered-but-absent is usually a vantage artifact,** not a registry lie: a sibling checkout
  missing from this working copy. `northstar-lint.mjs` downgrades these to WARNs and `--detect`
  keeps full mode; only anchors pointing into an absent file fail, and they fail individually
  with `unreachable: true`.
- **Registry paths are core-root-relative** (`../<app>/.claude/northstar.md`). Resolution belongs
  to `northstar-fm.mjs`; don't hand-join paths.
- **The registry is markdown frontmatter, not JSON.** Only `northstar-fm.mjs`'s constrained,
  `LIST_KEYS`-gated parser is safe on it. Import it; never reimplement or `JSON.parse` it.
- **A known parser gap:** inline YAML comments are not stripped, so `slug: buddy-check   # NB: …`
  parses with the comment attached. `resolve-anchor.mjs` works around this for slug comparison
  only. Tracked as `decisions/defects/dr-northstar-fm-inline-comment-not-stripped.md` — don't
  "fix" it with a naive strip, which would truncate live roadmap values containing `PR #165`.

## The selfco read (full mode, charting only)

Per `adr:bonded-pair-division-of-labor` (**draft**), the operational spine carries *work objects*
(beads, registry, slices, instances) and the selfco vault carries *understanding objects* (lenses,
entity pages, syntheses), which the spine reads **at design time only**.

Charting is design time. Before enumerating fog, consult `~/selfco/wiki/` — `synthesis/`,
`concepts/`, and `entities/` — for prior thinking that bears on the Destination, and cite what you
use under the map's `## Notes`. The `operating-surface-bonded-pair` map already does this by hand,
citing the `precedent-survey-methodology` corpus as its design-judgment source.

Strictly read-only and one-way. Wayfinder never writes to the vault, and never treats a vault page
as a decision — vault pages inform ticket bodies; the decision still belongs to the user in that
ticket's session. Skip entirely when `~/selfco` is absent or in lite mode.

## Read order for a charting session

1. `resolve-anchor.mjs --detect` → mode.
2. Full mode only: `decisions/northstar/README.md` frontmatter → `registry:` + `roadmaps:`.
3. `resolve-anchor.mjs --anchor=…` for the Destination's claimed properties.
4. `~/selfco/wiki/` for prior lenses and syntheses on the Destination.
5. Existing maps in the map library — an initiative may already be charted, or its fog may
   already be someone else's `## Out of scope`.
