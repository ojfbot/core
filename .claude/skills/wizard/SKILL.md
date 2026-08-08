---
name: wizard
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "wizard", "make a setup
  wizard", "walk me through setting up X", "author a wizard for", "interactive setup
  script", "guide me through the dashboard", or when a task requires steps only a human
  can perform — provisioning credentials, CI secrets, third-party dashboard
  configuration, one-off migrations or cutovers. Authors a stage-based interactive bash
  wizard from a fixed local stage library: per-stage screen clears with progress, hidden
  secret entry, idempotent .env upserts, gh secret/variable writes, closing summary.
  Do NOT invoke for steps the agent can perform itself.
---

# /wizard

You are authoring a **wizard**: a bash script that walks a human, stage by stage, through a manual procedure that is tedious to do by hand and tedious to re-explain to an AI every time. It opens each URL, says exactly what to click and copy, captures the values, writes them where they belong (`.env`, GitHub secrets), and shows how many stages remain.

**Input:** $ARGUMENTS — the manual procedure (e.g. "aws sso login setup for buddy-check", "deploy keys for the selfco Pi").

**Tier:** 2 — Multi-step procedure
**Phase:** any (setup, credentials, CI secrets, one-off migrations/cutovers)

The stage library lives at `scripts/wizard-template.sh` in this skill directory. It is re-authored locally against the upstream contract (D39, `decisions/adopt-stack/pocock-skills-v1-2.md`; ADR-0083 — never vendor upstream's file). **Your job is only to scope the procedure and author its stages** — the library above the STAGES marker is identical in every wizard and is never hand-edited.

## Core Principles

1. **Human-only steps only.** If the agent can do a step itself (`gh api`, `aws` CLI with existing credentials, a file edit), do it directly — the wizard is for steps that need a human's browser session, 2FA, payment method, or judgment.
2. **Secrets never transit the chat.** The wizard exists so credentials go terminal → `.env`/`gh secret`, unseen by the agent. Never ask the user to paste a secret into the conversation while scoping or verifying.
3. **The library is fixed.** Consistent UX across every wizard is the point. Author only below the STAGES marker.
4. **Never invent UI paths.** Where you don't know the current dashboard layout or exact command, say so and ask the user or check the docs — a wizard with wrong click-paths is worse than none.
5. **Ephemeral by default.** Save to the scratchpad or a scratch `scripts/` path; delete when the job is done. Commit only when the user wants a repeatable setup path living in the repo.

## Workflow

### Step 1 — Scope the procedure

Work out every manual step and every value captured along the way. Read the repo first — don't ask cold:

- **Setup:** `.env`, `.env.example`, `.env.*`, `README`, `docker-compose*`, framework config, and `.github/workflows/*` — every `secrets.*` / `vars.*` reference is a value the wizard must produce.
- **Migration/cutover:** current state, target state, and the irreversible actions between them.

Show the user the ordered stage list and the values each produces; confirm — they may add, drop, or reorder.

**Done when:** every stage is named in order, and for each captured value you know (a) where the human gets it, (b) where it's written (`.env`, GitHub secret, both, or nowhere — some stages are pure actions), and (c) secret (hidden entry) or public.

### Step 2 — Map each stage's journey

For each stage, write the precise path a human follows — "Dashboard → Developers → API keys → Reveal test key → copy" — which URL opens, what happens there, which variable it fills. Apply Principle 4 for anything you can't verify.

**Done when:** every stage traces to concrete instructions a stranger could follow.

### Step 3 — Author the wizard

Copy `scripts/wizard-template.sh` (from this skill's directory; resolve via the symlink if working in a sibling repo) to the target path. Replace the example stage with one `stage` per step in dependency order, and set `TOTAL_STAGES` to the number of stages written.

> **Load `knowledge/stage-library.md`** before authoring — the full helper contract, stage anatomy, re-run semantics, and set -e interactions.

Hold the bar the library sets: `open_url` before asking for the value it produces, `ask_secret` for anything secret, `write_env` every persisted value, `set_secret` only what CI actually references, `confirm` before anything irreversible, one focused task per stage (each stage clears the screen — nothing the human still needs may scroll away).

### Step 4 — Verify and hand off

- `bash -n <script>`, then `shellcheck <script>` if available; `chmod +x <script>`.
- **Do not run it end-to-end yourself** — it opens browsers and blocks on human input. Trace it statically: every value from Step 1 is captured and lands where Step 1 said; every `set_secret` name exactly matches a `secrets.*` reference in CI.
- Tell the user the run command. If it's a repeatable setup path, commit it and link it from the README so the next person runs the script instead of asking an AI.

## Gotchas

- **Never run the wizard yourself.** It blocks on `read` and opens browser windows; an agent driving it either hangs or blows through `pause` gates on EOF. Static trace + syntax check is the verification, plus at most a `bash -n`/shellcheck pass.
- **A secret captured with `ask` instead of `ask_secret` lands in terminal scrollback.** Classify every value in Step 1 and hold the classification in Step 3 — downgrading to visible entry "because it's easier to check" defeats the wizard's purpose.
- **`set_secret` names must match CI byte-for-byte.** A near-miss (`AWS_KEY` vs `AWS_ACCESS_KEY_ID`) fails silently now and cryptically at CI time. The Step 4 static trace against `secrets.*` references is what catches it — don't skip it because the wizard "looks right".
- **`TOTAL_STAGES` drifts when stages are added late.** The library warns at runtime when the counter overruns, but the human sees wrong progress the whole run. Count `stage` calls after any edit.
- **A committed wizard rots with the third-party UI.** Dashboard layouts churn; a repo wizard with stale click-paths misleads with authority. Default is ephemeral; commit only a deliberately maintained setup path.
- **Pure-action stages are legitimate.** A stage may capture nothing (run `aws sso login`, approve in browser, done) — don't force a `write_env` where there is no value; `pause` after the action is the gate.

---

$ARGUMENTS

## See Also

- `/setup-ci-cd` — wiring the CI that consumes the secrets a wizard produces.
- `/handoff` — if the setup path deserves a durable runbook, not just a script.
- `/git-guardrails` — before a wizard that touches repo settings or protected branches.
