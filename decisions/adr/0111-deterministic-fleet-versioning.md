# ADR-0111: Fleet versions are computed by deterministic tools, never chosen
slug: deterministic-fleet-versioning
serial: 0111
rev:
Date: 2026-11-22
Date accepted: 2026-11-22
Status: Accepted
domain: meta
type: convention
OKR:
Commands affected: /push-all, /deploy, /pr-review
Repos affected: core (adopts and hosts the shared pieces); every fleet repo adopts later, one pull request each
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [always-green-ci-policy, shared-github-actions-repo, pnpm-workspaces, fleet-runner-in-core]
  parent:
  part-of-series:

---

## Context

Versions in the fleet were chosen by hand, or by whichever model wrote the change. Core shows the
result: `@core/fleet-runner` is at `0.2.5-bookcase.2`, `@core/native-dispatch` at `0.4.5`, the rest
at `0.1.0`, and nothing records why, or what changed between two of them. Service repos have the
same gap, and a staged service needs to be able to say exactly which revision it is running.

The owner decided (2026-11-22, [#654](https://github.com/ojfbot/core/issues/654)): "we need to use
deterministic tools and not rely on pure llm generation for this", and to "promote that to full
CircusGreen fleet level". Later the same day, on scope: "all packages should use release-please and
commitlint". A version number is a function of the commits since the last release. Computing that
function is mechanical work, and an LLM will not do it the same way twice.

## Decision

Every package in every fleet repo uses both **commitlint** and **release-please**. There are no
exceptions and no per-package opt-outs.

1. **Commit messages are Conventional Commits, enforced by commitlint at two points.** A local
   `commit-msg` git hook, installed through the repo's own package manager (`pnpm install` runs a
   `prepare` script; no global tool), and a CI job that lints **every commit in the pull request
   and the pull request title** (the title is what a squash merge writes to the default branch).
   Neither is ever skipped: no `--no-verify`, no "advisory" mode.
2. **Versions and changelogs come from release-please in manifest mode.** `fix` is a patch, `feat`
   a minor, `!` or a `BREAKING CHANGE` footer a major. Below 1.0 a breaking change bumps the
   minor and a `feat` still bumps the minor (`bump-minor-pre-major: true`,
   `bump-patch-for-minor-pre-major: false`); the rule is set in each repo's release-please
   config and not decided per release. There is **one release PR per package**; merging it writes
   the changelog and creates the tag `<package>-vX.Y.Z`. A package that has never been released
   starts at its current version.
3. **No hand-edited versions.** A CI check refuses any change to a `package.json` `version` (and to
   an existing manifest entry) outside release-please's own PR. The same check fails a repo that has
   a `package.json` release-please does not cover, so "every package" is enforced, not hoped for.
4. **A tag never deploys.** Releasing is separate from shipping. A service's stage and promote steps
   take the tag and its exact commit, and going live still needs the owner's yes naming the
   revision.
5. **The shared pieces live in Core and repos pin them by commit SHA.** Core holds the commitlint
   config (`packages/commitlint-config`), the reusable GitHub workflows
   (`reusable-commitlint.yml`, `reusable-release-please.yml`, `reusable-version-edit-check.yml`),
   the check script (`scripts/fleet-versioning/`) and the hook installer. A repo calls the workflows
   as `ojfbot/core/.github/workflows/<file>@<commit-sha>`; a reusable workflow reads the rules and
   scripts from Core at that same commit (`job.workflow_sha`), so one pin controls everything and a
   change to Core cannot alter any repo's checks until that repo moves its pin.
6. **The scope rule is about shape, not a list.** A scope is optional and, when present, lowercase
   kebab-case; any such name is accepted in any repo. It is not an enumerated list: a list per repo
   goes stale whenever a package is added, and release-please attributes a commit to a package by
   the files it changes, not by its scope.

How a repo adopts all of this is in `domain-knowledge/versioning-convention.md`.

## Consequences

### Gains
- A version is reproducible: the same commits give the same version, with no judgment involved.
- Every release has a changelog and a tag, so a staged revision can be traced to what it contains.
- Review gets simpler: a release PR is generated, and a hand-made version change is a CI failure.
- One pin per repo moves the whole convention, and Core's own CI exercises the workflows first.

### Costs
- Every contributor, human or agent, must write conventional commit messages; a wrong one is
  rejected locally before it exists. Squash-merge repos must also name the PR title correctly.
- Two checks and one release PR per package add CI minutes. The jobs fetch commit history only and
  install one tool, to stay under a minute on a private repo.
- release-please's own PRs and tags do not trigger other workflows when made with the default
  `GITHUB_TOKEN`. A repo that requires checks on release PRs must give it a token (documented in the
  reusable workflow).
- A package already on a pre-release version (`0.2.5-bookcase.2`) starts the manifest at exactly that
  string, and release-please keeps the suffix when it bumps (`0.2.6-bookcase.2`). Any consumer that
  accepts only plain `x.y.z` must be dealt with before that package's first release PR is merged:
  either a one-time `release-as` or retiring the suffix.

### Neutral
- The root `package.json` of a workspace is a package like any other and is versioned too; its
  release excludes the paths of the workspace packages so it does not duplicate their releases.
- Commit types that do not release (`docs`, `chore`, `ci`, `test`, `build`, `style`, `refactor`)
  never open a release PR by themselves.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Hand-chosen or LLM-chosen versions with a changelog written afterwards | The thing the owner ruled out: not reproducible, and nothing checks it. |
| semantic-release | Publishes on merge, so a merge would also ship; the fleet needs release and deploy kept apart, with a human yes between them. |
| changesets | Needs a hand-written change file per change, which is the manual step this removes. |
| Husky for the hook | Its generated hook directory is untracked, so a fresh git worktree (common here) silently has no hook until `pnpm install` runs there. Tracked hooks under `.githooks/` with `core.hooksPath` have no such gap. |
| An enumerated scope list per repo | Goes stale and blocks commits for naming reasons; versions do not depend on scope. |
| commitlint in CI only | Finds the mistake after the commit and the push; the local hook finds it before. |
| Copying the config and workflows into each repo | Drifts. A SHA-pinned reference makes every repo's checks a known Core revision. |
| One monorepo-wide version | Packages release at different rates and consumers pin individual ones; the owner chose one release PR per package. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-11-22 owner decision recorded on ojfbot/core#654 |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
