# Defect ledger — behavioral misreports

The third defect class. The fleet already tracks two:

| Class | Referent | Home | Detection |
|---|---|---|---|
| Tech debt | code that works but is poorly built | `TECHDEBT.md` (TD-NNN), `/techdebt` | code inspection |
| Deviation | plan-vs-territory gap, mid-task | `implementation-notes.md` + `deviation-log.mjs` | self-report in flight |
| **Behavioral misreport** | **an artifact asserts X; reality is ¬X** | **here** | verification against ground truth |

A defect report is filed when documentation, frontmatter, or a registry **claims something
that is false** — or when a mechanism is documented as live and is not. This is a sibling
of `/techdebt`, not an extension of it: `/techdebt` scopes to the workflow framework and
categorises by code quality; these are claims proven false and mechanisms proven dead.

Born from the 2026-07-29 selfco ontology + derived-truth audit, which produced ~30 such
findings with no place to file them.

## The rule that governs this directory

**Every report carries an executable probe, or it is not a report.**

The bead-ledger closure loop (TD-006, PR #290) failed because it was self-report only —
declared in prose, with nothing independently checking it: 28 open hooks, 9 reports ever
filed. Every loop in this fleet that *survived* has two sources (see
`scripts/hooks/deviation-log.mjs`, `reconcile-skill-acted.mjs`: "self-report ← the agent
writes; independent ← this hook parses reality itself and records what it finds"). So:

- **Filing** is the self-report side. Cheap, and an agent can do it mid-work.
- **`defects-lint.mjs --sweep`** is the independent side. It runs each report's probes
  against reality and decides the status. **An agent never marks its own defect closed.**

A finding with no re-derivation path is `disposition: needs-investigation` — a stub, not a
filed defect. It is honest to file a stub; it is not honest to file an unverifiable claim
as a defect.

## Schema

One file per defect: `dr-<slug>.md`. The slug is the identity (ADR-0087 — slug is the
Configuration Item identifier; no numbers to collide or renumber).

```yaml
---
type: defect-report
slug: selfco-lint-report-stale-page-count   # must equal the filename minus dr- and .md
class: false-assertion | dead-mechanism | schema-drift | phantom-reference
severity: high | medium | low
status: open | claimed | repaired | verified-closed | unreproducible
disposition: repair-doc | repair-mechanism | retire-mechanism | replicate-then-fix | needs-investigation
location: "selfco:wiki/_lint-report.md:16"   # <repo>:<path>[:<line>]
claim: "the false assertion, verbatim"
actual: "what is true instead, as of `filed`"
claim_probe: "sh command; exit 0 while the false claim is STILL present"
truth_probe: "sh command; prints current reality (informational for the repairer)"
filed: YYYY-MM-DD
filed_by: "agent:<model> | operator | <script>"
evidence: "session slug, PR, or log reference"
---
```

Body: what is wrong, why it matters, and how to repair it.

### Field notes

- **`claim_probe` is the closure signal.** Exit 0 = the false claim is still in the
  artifact. Exit non-zero = it is gone. It must probe the *artifact*, never reality —
  otherwise a defect "closes" because the world drifted rather than because anyone fixed
  the document.
- **`truth_probe` is informational**, not a gate. Its output goes in the sweep report so a
  repairing agent knows what to write without re-deriving it.
- **`actual` is stamped, not live.** It was true on `filed`. Trust `truth_probe` output
  over it — the `actual` field is itself a derived truth and will rot. That is not a flaw
  in the schema; it is the reason `truth_probe` exists.
- **`class`** — `false-assertion` (a claim that is wrong), `dead-mechanism` (documented as
  running, isn't), `schema-drift` (declared schema vs. actual usage diverged),
  `phantom-reference` (points at something that does not exist).

## Lifecycle

```
    file ──▶ open ──▶ claimed ──▶ repaired ──▶ verified-closed
                │                      │
                └──── sweep says ──────┴──▶ unreproducible
```

Only `defects-lint.mjs --sweep` writes `verified-closed`, and only when `claim_probe`
exits non-zero. Movement is appended to `defects-status.jsonl` with the probe output as
evidence — the same `{actor, source, evidence}` shape as `decisions/northstar/status.jsonl`.

## Usage

```bash
node scripts/defects-lint.mjs                  # validate schema; report open defects
node scripts/defects-lint.mjs --sweep          # run probes, classify, append movement
node scripts/defects-lint.mjs --format=summary # one line, for standup
node scripts/defect-file.mjs --help            # file a new report (dedups on claim+location)
```

`--sweep` **executes the `claim_probe` and `truth_probe` shell strings.** Treat every
defect file as executable content: it is operator-run against a local checkout, and it is
deliberately **not** wired into CI on untrusted input. An agent may file a report; review
its probes before sweeping a batch you did not write.

Exit code is 0 in all modes except `--check` (schema errors only). A measurement never
blocks — ADR-0086.

## Probe-writing constraints (learned the hard way, 2026-07-30)

**Exit codes follow grep's contract: `0` = claim present · `1` = claim gone · `>1` = the
probe failed.** The sweep maps `>1` to `probe-error`, never to `claim-gone`. This matters
because the natural-looking `test $(...) -gt 0` collapses to a shell syntax error the moment
its subshell returns empty — a renamed repo, a missing directory, an unexpected grep — and
under a naive "non-zero means gone" rule that silently **closes a live defect**. It happened:
`dr-core-adr-dangling-traces` reported `claim-gone` while all ten offending ADRs sat on disk.
Prefer `grep -q`, which already obeys the contract.

**No backslashes in probe strings.** `defect-file.mjs` escapes backslashes on write and the
frontmatter reader does not unescape, so `\n` round-trips as `\\n`. BSD `tr` then reads
`'\\n'` as the two-character set `{backslash, n}` and translates every literal `n` to a
space — `incoming` became `i comi g` in a real report. Use `paste -sd' ' -` to join lines,
not `tr`.

**Paths are repo-relative, not absolute.** The sweep runs probes with `cwd` = the core root.
An absolute `~/ojfbot/core/scripts/...` breaks in a worktree, in CI, and on any other
machine; `scripts/probes/…` works everywhere.

**Anchor `claim_probe` to the artifact, never to the world.** A claim probe that tests
reality closes when the world drifts rather than when someone repairs the document. When
`gcgcca` was renamed, the claim probe survived precisely because it greps
`wiki/entities/gcgcca.md`; only the informational `truth_probe` needed repointing.
