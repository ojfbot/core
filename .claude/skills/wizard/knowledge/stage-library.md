# Stage library contract — `scripts/wizard-template.sh`

The library section (everything above the `STAGES` marker) is identical in every wizard and never hand-edited. This file documents each helper's contract so stages can be authored without re-reading the library source.

## Helpers

| Helper | Signature | Contract |
|--------|-----------|----------|
| `banner` | `banner "Title"` | Opening frame: title, stage count, resumability note, Enter gate. Call **once**, after `TOTAL_STAGES` is set, before the first `stage`. |
| `stage` | `stage "Name"` | Clears the screen, advances the counter, prints `[n/TOTAL] Name`. One per human step. Warns at runtime if the counter overruns `TOTAL_STAGES`. |
| `say` | `say "text"` | Plain instruction line — intent, context. |
| `step` | `step "text"` | A concrete action the human takes (`→` bullet) — click this, copy that. |
| `note` | `note "text"` | De-emphasized aside (dim). |
| `warn` | `warn "text"` | Attention line (`⚠`). |
| `open_url` | `open_url URL` | Opens the human's browser: `wslview` / `explorer.exe` (WSL) → `xdg-open` (Linux) → `open` (macOS). Prints the URL either way; warns with a manual fallback when no opener works. Call it **before** asking for the value that page produces. |
| `ask` | `ask VAR "Prompt:"` | Reads visible input into `$VAR`. On re-runs, the saved `ENV_FILE` value is the default (Enter keeps it). Non-secret values only. |
| `ask_secret` | `ask_secret VAR "Prompt:"` | Like `ask` but input is hidden and never echoed. Anything credential-shaped uses this. |
| `write_env` | `write_env KEY "$KEY"` | Idempotent upsert of `KEY=value` into `ENV_FILE` (creates the file; replaces any existing line). Values containing whitespace or `#` are double-quoted, inner quotes escaped; `ask`/`ask_secret` strip that quoting when offering the saved default. |
| `set_secret` | `set_secret NAME "$VAL"` | GitHub Actions repo secret via `gh secret set`. When `gh` is missing/unauthenticated/fails, records a manual to-do that `finish` prints — the wizard never dies on a missing `gh`. |
| `set_var` | `set_var NAME "$VAL"` | GitHub Actions repo **variable** (non-secret), same fallback behavior. |
| `pause` | `pause ["msg"]` | Enter gate — the human confirms a manual action is done. Default prompt: "Press Enter to continue". |
| `confirm` | `confirm "Question?"` | y/N gate; succeeds only on yes. See set -e note below. |
| `finish` | `finish` | Clears, prints the closing summary: env keys written, secrets set, manual to-dos. Always the last line. |

Globals: `ENV_FILE` (default `.env`; override before `banner` for e.g. `.env.local`), `TOTAL_STAGES` (author-set; must equal the number of `stage` calls).

## Stage anatomy

The canonical capture stage, in order:

```bash
stage "Provider — what this stage gets"
say "One line of intent: what we're grabbing and why."
open_url "https://exact.page/that/shows/the/value"
step "Precise click-path to the value."
ask_secret THE_KEY "Paste the key:"        # ask for public values
write_env THE_KEY "$THE_KEY"               # every persisted value
set_secret THE_KEY "$THE_KEY"              # only if CI references secrets.THE_KEY
```

Pure-action stages capture nothing:

```bash
stage "AWS — SSO login"
say "Authorize this machine against the SSO portal."
step "Run in another terminal: aws sso login --profile myprofile"
step "Approve the request in the browser window it opens."
pause "Press Enter once the login has succeeded"
```

Irreversible actions get a `confirm` gate:

```bash
if confirm "Rotate the old key now (the previous one stops working)?"; then
  step "Click 'Roll key' and copy the new value."
  ask_secret NEW_KEY "Paste the new key:"
  write_env NEW_KEY "$NEW_KEY"
else
  note "Skipped — old key left in place."
fi
```

## Semantics worth knowing

- **Resumability.** `ask`/`ask_secret` read the saved value from `ENV_FILE` and offer it as an Enter-to-keep default, and `write_env` upserts — so Ctrl-C + re-run skips re-entering everything already captured. The interrupt trap prints a partial summary and says so.
- **set -e and `confirm`.** The script runs `set -euo pipefail`. A bare `confirm` answered "no" therefore exits the wizard — correct for a hard abort gate. For an optional branch, use it inside `if confirm ...; then ... else ... fi`.
- **Screen clears.** Every `stage` (and `banner`/`finish`) wipes the terminal, so a stage must be self-contained: never reference "the value above" from a previous stage. Clearing is a no-op when output is piped, so logs stay readable.
- **`gh` scope.** `set_secret`/`set_var` operate on the repo of the current working directory. If the wizard targets another repo, `cd` first in the stages section or note the manual command instead.
- **bash 3.2.** The library runs on stock macOS `/bin/bash` (3.2): empty arrays are expansion-guarded under `set -u`; no bash-4-only features. Keep authored stages to the same dialect (no `${var,,}`, no associative arrays, no `readarray`).
