# /opm mode procedures

Full per-mode procedure for `model`, `render`, `lint`, and `query` — load after resolving the mode.

## Mode: model

1. **Grill first** (agent-defaults posture): restate what should be modeled, surface 2–3
   assumptions (which pipelines are in scope, what the top-level SD should contain), ask the one
   highest-leverage question. Skip only on explicit "just do it".
2. Read the repo's reality — entry points, CLAUDE.md, package scripts, CI workflows, existing
   ADRs — and draft/update the model:
   - `## SD` with 5–9 things; one `## SD1.n — <Process> in-zoom` per major pipeline.
   - Every sentence follows a template from opm-modeling.md; gerund processes, capitalized things.
   - Anchor load-bearing sentences: `[src: path]`, `[skill: name]`, `[adr: slug]`.
   - Agent vs instrument is the call that matters most — mark exactly where a human or Claude
     session *decides* vs where a tool is merely used.
3. Show the diff to the user for review (the model is a claim set — it merits the same scrutiny
   as code), then run **render**.

## Mode: render

Regenerate `opm/system.md` from `opm/system.opl` using the deterministic mapping table in
opm-modeling.md — one `flowchart TD` per section, a heading per OPD, sentences quoted beneath
each diagram as the OPL paragraph. Never hand-edit system.md; never let it drift from the .opl
(render is idempotent — run it after every model edit).

## Mode: lint

Observe-only report, three passes; exit is always success (shadow mode, ADR
opm-inspectability-layer — promotion to a gate is a later RIDM decision):

1. **Syntax** — every non-comment line matches exactly one OJF-OPL template; naming conventions
   hold; every in-zoomed thing is declared in an ancestor section.
2. **Provenance** — every `[src:]` path exists in the tree; every `[skill:]` resolves in
   `.claude/skills/`; every `[adr:]` resolves in `decisions/adr/`.
3. **Reality probes** — for sentences naming files, scripts, or workflows, spot-check the claim
   (does the consuming code read that input? does CI invoke that step?). Judgment pass, not
   parsing: report `CONFIRMED / UNVERIFIED / CONTRADICTED` per probed sentence with evidence.

Output: finding list ordered CONTRADICTED → syntax → dangling anchors → UNVERIFIED, plus a
one-line verdict (`model clean` / `n findings`). `--json` additionally emits
`{sentence, check, verdict, evidence}` lines for dashboard/telemetry consumption.

## Mode: query

Answer the question **from the model only**, quoting the exact OPL sentences that ground the
answer (they are citations — "Generating requires Claude API. [src: src/generate-article.ts]").
If the model can't answer, say so and name the sentences that are missing — offer `model` to add
them. Typical questions: "what consumes X?", "which processes does Jim gate?", "what breaks
downstream if Y is removed?" (walk consumption/result chains).
