# Config Reference

## Node Version

`.nvmrc`: `24.11.1` — use `fnm use` to switch.

## Package Manager

`pnpm 9.15.4` — activate via `corepack enable && corepack prepare pnpm@9.15.4 --activate`.

## TypeScript Presets (`@frame/tsconfig`)

| Preset | Use | Key settings |
|--------|-----|-------------|
| `base.json` | Shared foundation | ES2022, strict, bundler resolution |
| `node.json` | Node packages | Extends base, CommonJS output |
| `browser.json` | React/Vite apps | Extends base, JSX, DOM libs |
| `node-emit.json` | Node packages emitting JS | sourceMap: false |

Usage: `"extends": "@frame/tsconfig/browser"` in `tsconfig.json`.

## ESLint (Flat Config)

```js
// eslint.config.js
import framePlugin from '@frame/eslint-plugin'
export default [
  { plugins: { '@frame': framePlugin }, rules: { /* ... */ } }
]
```

8 custom rules — see `packages/eslint-plugin/src/rules/`.

## Claude Code Settings

Project: `.claude/settings.json` — hooks, permissions, skill symlinks.
Global: `~/.claude/settings.json` — telemetry hooks, skill suggestions.

## VS Code

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```
