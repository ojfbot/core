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
