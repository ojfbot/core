# Core agent instructions

Read [CLAUDE.md](CLAUDE.md) for repository boundaries and working rules; they apply
to Codex and other coding agents too. Before architectural decisions or code,
read [the product context](domain-knowledge/frame-os-context.md). Use pnpm only.

Run the full `pnpm verify` before marking a PR ready and paste its summary into the PR: it
runs every pull-request CI job locally in a Linux container, so failures show up before the PR
leaves draft (see the README, "Run the CI checks locally"). Never weaken a check to pass it.

Read [shared agent defaults](domain-knowledge/agent-defaults.md) for
alignment, inherited charter authority and continuation duties. For cross-session
work, also read the canonical
[HelpDesk charter coordination guide](https://github.com/ojfbot/LocalHelp/blob/main/docs/charter-coordination.md).
Preserve current human holds and keep private audit evidence at its source.

Closing a request does not finish its charter: record and pursue the next action,
owner and checkpoint, with acknowledged pickup or a visible coverage gap. Loading
this entry point is not evidence that a peer session loaded the same guidance.

## Standing follow-ups (agents own these; do not wait for the owner)

Work that must happen later is written here so any agent that loads this file can pick it up.
Check this list when you start work in `release-please-config.json` or see a failing
`versions / versions` check.

- **Remove `release-as: "0.3.0"` from the `packages/fleet-runner` entry of
  `release-please-config.json`** once `fleet-runner-v0.3.0` has been tagged (the first FleetRunner
  release; the owner chose the plain `0.3.0`, "Drop the tail"). `release-as` forces every release of
  that package to the same version, so leaving it makes later releases wrong. Open a PR titled
  `chore(release-please): drop one-shot release-as 0.3.0 for fleet-runner`, delete that one line, and
  run `pnpm verify`. The `versions / versions` check fails on every pull request and push to `main`
  from the moment the tag exists until this is done, and its message names this task; the tracking
  issue is ojfbot/core#659. Done when the tag exists and the key is gone, nothing else.
