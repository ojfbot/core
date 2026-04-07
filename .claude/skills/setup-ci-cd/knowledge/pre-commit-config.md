# Pre-Commit Configuration

## Husky + lint-staged

```bash
# Install
pnpm add -D husky lint-staged
npx husky init
```

### `.husky/pre-commit`
```bash
#!/bin/sh
npx lint-staged
```

### `package.json` (lint-staged config)
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,mjs,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.json": ["prettier --write"]
  }
}
```

## Security Scan Hook

### `.husky/pre-commit` (extended)
```bash
#!/bin/sh
# Block commits containing API keys
if git diff --cached --diff-filter=d | grep -qiE '(sk-ant-|ANTHROPIC_API_KEY|dangerouslyAllowBrowser)'; then
  echo "ERROR: Potential API key or security issue in staged files"
  exit 1
fi

npx lint-staged
```

## What Gets Checked

| Check | Tool | Blocks commit? |
|-------|------|---------------|
| ESLint errors | lint-staged | Yes |
| Formatting | prettier | Auto-fixes |
| API keys in diff | grep | Yes |
| Type errors | tsc --noEmit | Optional (slow) |

## Tips

- Keep pre-commit fast (< 5s) — move slow checks to CI
- Use `--no-verify` sparingly (only when hook itself is broken)
- `lint-staged` only checks staged files — fast even in large repos
