# Getting Started

## Prerequisites

- **Node v24.11.1** — pinned via `.nvmrc`. Use `fnm use` to switch.
- **pnpm** — used everywhere. `npm install -g pnpm` if not present.
- **Claude Code** — commands require the Claude Code CLI.

## Install

```bash
pnpm install
pnpm build
```

## Use commands in Claude Code

Commands are available immediately in Claude Code when you open this repo — no build step required.

```
/plan-feature add user auth
/validate
/investigate why is the agent failing
/push-all
```

See [docs/commands.md](commands.md) for the full command reference.

## Install commands into a sibling repo

```bash
./scripts/install-agents.sh cv-builder
./scripts/install-agents.sh cv-builder --force   # overwrite existing symlinks
```

This symlinks `.claude/commands/` and `domain-knowledge/` into the target repo. The target repo gets the full command stack without copying files.

## Run the TypeScript CLI

```bash
cp .env.example .env    # add ANTHROPIC_API_KEY
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js "/summarize packages/workflows/src/types.ts"
```

## Run the development workbench

The workbench is a 6-tile tmux environment that starts all Frame OS repos simultaneously.

```bash
/workbench           # start
/workbench --status  # check status
/workbench --kill    # stop
```

See `domain-knowledge/workbench-architecture.md` for tile layout and keybindings.

## Add a new command

1. Create `.claude/commands/mycommand/mycommand.md` — immediately available as `/mycommand` in Claude Code.
2. Optionally add `knowledge/` subdirectory for reference material.
3. Register in `packages/workflows/src/registry.ts` if you also want CLI support.

## Run tests

```bash
pnpm test
pnpm test:watch
pnpm vitest run packages/workflows/src/__tests__/parseCommand.test.ts
```
