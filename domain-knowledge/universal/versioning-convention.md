# Fleet versioning convention

Decision: `adr:deterministic-fleet-versioning`. Versions are computed by tools from commit types;
nobody, human or model, chooses a version number. **Every package in every fleet repo uses both
commitlint and release-please.** A tag never deploys anything by itself.

## What the tools do

| Concern | Tool | Where it runs |
|---|---|---|
| Commit message shape | commitlint, shared rules from Core | `commit-msg` git hook (local) and a CI job over every commit in the PR plus the PR title |
| Version, changelog, tag | release-please, manifest mode | CI on push to the default branch; one release PR per package; tag `<package>-vX.Y.Z` |
| No hand-edited versions | `check-versions.mjs` | CI on pull requests |

### Commit types and what they release

`fix` is a patch, `feat` a minor, `!` after the type (or a `BREAKING CHANGE:` footer) a major.
Below 1.0 a breaking change bumps the minor and `feat` still bumps the minor. `perf`, `revert`,
`docs`, `style`, `refactor`, `test`, `build`, `ci` and `chore` are allowed and never open a release
by themselves. Anything else is rejected.

```
feat(fleet-runner): add a stage dry run
fix: refuse a lease that expired during claim
feat(read-model-contract)!: drop the v1 snapshot shape
```

The **scope is optional** and, when present, lowercase kebab-case (`fleet-runner`, not
`Fleet Runner`). It is for the reader. release-please decides which package a commit belongs to by
the files it changed, so a wrong scope never changes a version. Squash-merge repos: the PR title is
the commit that lands, so it must pass too.

## Rules a contributor follows

- Never edit a `version` in a `package.json` or the `.release-please-manifest.json` by hand. CI
  fails the pull request. Merge the release PR instead.
- Never skip the hook (`--no-verify`) and never weaken a commitlint rule to get a commit through.
  Fix the message.
- A new package: add it to `release-please-config.json` (`packages`, with a unique `component`)
  and to the manifest at its starting version, in the same PR as its `package.json`.
- Release PRs are merged like any PR. Merging one tags and writes the changelog; to ship the
  tagged code, stage it and get the owner's yes naming the revision, as for any release.

## Adopting it in a repo

Each adoption is one PR, pinned to a Core commit SHA (`<core-sha>` below; never a branch or tag).

1. **Dependencies and hook.** In the repo's root `package.json`:

   ```json
   {
     "scripts": { "prepare": "sh scripts/install-git-hooks.sh" },
     "devDependencies": {
       "@commitlint/cli": "21.2.4",
       "@core/commitlint-config": "github:ojfbot/core#<core-sha>&path:/packages/commitlint-config"
     }
   }
   ```

   Copy `scripts/install-git-hooks.sh` and `.githooks/commit-msg` from Core at `<core-sha>`, and add
   `commitlint.config.mjs` containing `export { default } from '@core/commitlint-config';`. Run
   `pnpm install`: the `prepare` script sets `core.hooksPath` to the tracked `.githooks/`, which
   works in every worktree of the clone (the setting is shared, the hook files are tracked).
   Why tracked hooks and not Husky: Husky's generated directory is untracked, so a new worktree has
   no hook until installed there.
2. **release-please files.** Copy Core's `release-please-config.json` shape: `release-type`
   (`node`, or the language's type), `separate-pull-requests: true`, `include-component-in-tag`,
   `tag-separator: "-"`, `bump-minor-pre-major: true`, `bump-patch-for-minor-pre-major: false`,
   one `packages` entry per package with a unique `component`, and `bootstrap-sha` set to the
   default branch tip at adoption so history before it is not turned into a first release. The
   manifest starts each package at its **current** version. A workspace root that is also a
   package lists the other packages' paths in `exclude-paths`.
3. **Workflows.** Three small caller files, each pinned:

   ```yaml
   # .github/workflows/versioning.yml
   on: { pull_request: { types: [opened, edited, synchronize, reopened] } }
   permissions: { contents: read }
   jobs:
     commitlint:
       uses: ojfbot/core/.github/workflows/reusable-commitlint.yml@<core-sha>
     versions:
       uses: ojfbot/core/.github/workflows/reusable-version-edit-check.yml@<core-sha>
   ```

   ```yaml
   # .github/workflows/release-please.yml
   on: { push: { branches: [main] } }
   permissions: { contents: write, pull-requests: write }
   jobs:
     release-please:
       uses: ojfbot/core/.github/workflows/reusable-release-please.yml@<core-sha>
       secrets: inherit
   ```

   Moving the pin to a newer Core commit is a deliberate PR in that repo.
4. **Repo settings.** Allow GitHub Actions to create pull requests. If checks are required on the
   release PR, add a `RELEASE_PLEASE_TOKEN` secret (fine-grained, this repo only): PRs made with the
   default token do not start other workflows.
5. **Check it.** `pnpm exec commitlint --from <default-branch> --to HEAD` locally, and
   `node <core>/scripts/fleet-versioning/check-versions.mjs coverage` (set `RELEASE_PLEASE_CONFIG` /
   `RELEASE_PLEASE_MANIFEST` for non-default paths) to confirm every package is covered.

Non-Node packages (Python, etc.) use the matching release-please `release-type` and still get a
manifest entry and a component; the coverage check currently finds packages by `package.json`, so a
repo with other package kinds lists them in its PR and extends the check in Core first.

## What the checks guarantee, and what they do not

They refuse a hand-edited version, an uncovered `package.json`, a malformed commit or PR title, and
duplicate tag names. They do not decide whether a change deserves `feat` or `fix`; that stays a
reviewer's call, and a wrong type is fixed by correcting the commit or PR title before merge.

## In Core

Core adopts all of this by local path (so a PR that changes a workflow is tested by itself):
`.github/workflows/versioning.yml` and `release-please.yml`, `release-please-config.json`,
`.release-please-manifest.json`, `commitlint.config.mjs`, `.githooks/commit-msg`, and
`scripts/fleet-versioning/` (tests: `pnpm test:versioning`). `pnpm verify` runs the coverage check and
lints HEAD through `ci/build-test`; run `pnpm exec commitlint --from origin/main --to HEAD` for the
whole branch.
