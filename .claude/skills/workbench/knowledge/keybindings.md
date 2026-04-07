# Keybindings & Shortcuts

## pnpm Script Conventions

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Start dev server |
| `pnpm dev:all` | API + browser-app together |
| `pnpm dev:api` | API server only (port 3001) |
| `pnpm build` | Production build (includes security checks) |
| `pnpm lint` | ESLint with @frame/eslint-plugin |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm type-check` | TypeScript without emitting |
| `pnpm test` | Run test suite |
| `pnpm security:verify` | Full security audit |

## Claude Code

| Command | Action |
|---------|--------|
| `/help` | Show available commands |
| `/commit` | Create a commit |
| `/<skill>` | Invoke a skill (e.g., `/techdebt`, `/validate`) |
| `! <cmd>` | Run shell command in session |

## Terminal (zsh)

| Alias | Action |
|-------|--------|
| `fnm use` | Switch to project's Node version |
| `pnpm --filter <pkg> <cmd>` | Run command in specific package |
| `pnpm -r <cmd>` | Run command across all packages |
