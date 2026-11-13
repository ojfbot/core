# ADR-XXXX: One untracked env file per application package, read through one settings module
slug: package-env-files
serial: draft
rev:
Date: 2026-11-13
Status: Proposed
domain: meta
type: convention
OKR: ns:l2-ojfbot#P2
Commands affected: none (a repository convention plus a CI check)
Repos affected: core
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [fleet-runner-in-core]
  parent:
  part-of-series:

---

## Context

Core is becoming the home of deployed, headless services: fleet-runner, and the Selfco workers
under the fleet-runner map's "Selfco workers as a core service" note. Those services need
configuration and secrets on hosts where nobody is logged in and there is no desktop keychain.

Today's practice is uneven:

- **One example file for the whole repository.** The root `.env.example` lists only
  `ANTHROPIC_API_KEY`. It does not say which package reads it.
- **A narrow ignore rule.** `.gitignore` excludes files named `.env`, but not `.env.local`,
  `.env.production` and other variants. Nothing fails a change that commits an env file, and
  core is a public repository.
- **Configuration read ad hoc.** `fleet-runner` reads twelve `FLEET_*` variables at the points
  that use them; `workflows` reads `ANTHROPIC_API_KEY` and its Dolt settings directly. There is no
  single place that lists what a package needs, checks it, or keeps values out of error messages.

The operator directed, on 2026-11-13, that every **application package** (not the repository as a
whole) use an env file that is never committed, as the mechanism for sensitive values, resolved in
source as named constants. The rule is recorded now; existing packages migrate later, each in its
own reviewed change.

## Decision

**Each application package under `packages/<name>/` keeps its own `.env`, which is never committed.**
A committed `.env.example` beside it lists every key with no real value. The package reads its
environment **only** through one settings module, which exposes typed, named constants.

1. **Files.** `packages/<name>/.env` holds the real values, at mode 600 on any host. Next to it,
   `packages/<name>/.env.example` lists every key, each with a blank value or a `<placeholder>`,
   plus a comment saying what it is for and whether it is secret.
2. **Ignore rule.** `.gitignore` excludes `.env` and `.env.*` at every depth, except `.env.example`.
3. **The CI check.** `scripts/env-files-check.mjs` runs in CI.
   - It **fails** when a tracked file is an env file other than `.env.example`.
   - It **fails** when a tracked `.env.example` carries a value that looks real, meaning anything
     other than blank or a `<placeholder>`. A short, obviously fake value such as `sk-ant-...` only
     **warns**.
   - It **warns**, for now, on packages still being migrated: a package that reads its environment
     but has no `.env.example`, and the legacy root `.env.example`.
4. **One settings module per package.** `src/settings.ts`, or `settings.py` for a Python package,
   is the only code that reads the environment.
   - It loads the package's `.env` once. Real environment variables override the file, so a
     deployment or a test can inject values.
   - It refuses a `.env` that other users can read.
   - It validates every key and returns a frozen object of named constants. Callers import
     `settings.endpoint`, never `process.env.FLEET_ENDPOINT`.
   - Errors name the missing or invalid **key**, never its **value**.
   - A `*_FILE` key, a path to a secret file, stays allowed. The module reads the file and exposes
     the secret under a named constant.
   - Templates: `scripts/templates/package-settings/`.
5. **Scope of "application package".** This covers a package that runs as a process or service:
   it has a CLI, a server or a scheduled entry point. A pure library or contract package has no
   `.env`; it takes its configuration from its caller.

## Consequences

### Gains

- Each service's configuration surface is listed in one reviewed file, its `.env.example`, and
  validated in one module.
- A committed secret or real-looking example value fails CI before it reaches the public repository.
- Headless deployments get one uniform mechanism. The deployment writes `packages/<name>/.env`
  from its own secret store, and no keychain or login session is needed.
- Values never leak through error messages, and tests inject settings rather than mutating
  `process.env`.

### Costs

- A secret in a mode-600 file is only as safe as the host account. On a workstation that is weaker
  than a keychain. Packages may keep resolving a secret through a `*_FILE` path or a keychain
  command inside their settings module where that is stronger. The rule fixes where configuration
  is declared and read, not one storage backend.
- Existing packages need migration. Until then the check warns rather than fails for them.

### Neutral

- **Migration order, each change separate and reviewed:**
  - `workflows`, which also takes over the root `.env.example`;
  - `fleet-runner`, through its own hardening review;
  - the Selfco workers, when they move into core. Until that move, the Selfco capture worker keeps
    its out-of-repo env file and its keychain secrets.
- Once every package is migrated, the warnings in item 3 become failures.
