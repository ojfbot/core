# Bundle Constraints

Size limits and enforcement requirements for MrPlug+ browser extension packages.

## Per-package size limits

| Package | Role | Limit | Rationale |
|---------|------|-------|-----------|
| `content-script` | Injected into every page | **50 KB** (gzipped) | Injected on page load — affects perceived performance of every site |
| `background` | Service worker | 500 KB | Background worker — not on hot path, but limits AI SDK size |
| `popup` | Extension popup UI | 200 KB | User-initiated, acceptable wait |
| `options` | Settings page | 300 KB | Rarely opened |
| `shared` | Shared utilities | 100 KB | Shared across all — multiplies quickly |

## What is blocking (content script)

The following imports will push the content script over 50 KB and are **BLOCKING**:

- Any AI SDK (`@anthropic-ai/sdk`, `openai`)
- Any bundled UI framework (`react`, `vue`, `preact` with runtime)
- Any bundled CSS framework
- `lodash` (use targeted imports or native alternatives)
- Any package that bundles `node_modules` with large transitive deps

## Enforcement

CI check: `pnpm --filter @mrplug/content-script build && du -k dist/content-script.js`

If CI is not yet configured:
```bash
pnpm build
# Check sizes:
ls -lh packages/content-script/dist/
ls -lh packages/background/dist/
```

## How to check current sizes

```bash
# Build and check
pnpm build
find packages -name "*.js" -path "*/dist/*" | xargs ls -lh | sort -k5 -h

# Gzipped size (what matters for content script)
gzip -c packages/content-script/dist/index.js | wc -c
```

## Content script imports: what is safe

```typescript
// SAFE: small, tree-shakeable utilities
import { classifyElement } from '@mrplug/shared/classify'
import type { ContentMessage } from '@mrplug/shared/types'

// SAFE: browser-native APIs (no bundle cost)
import type { MessageBus } from '../types'

// UNSAFE: never import from background package
import { callAI } from '@mrplug/background/ai'  // BLOCKING

// UNSAFE: never import AI SDKs in content script
import Anthropic from '@anthropic-ai/sdk'  // BLOCKING
```

## AI calls must go through background

All AI calls must originate from the background service worker, not the content script:

```
Content script → chrome.runtime.sendMessage() → Background → AI API
```

The content script sends a typed message; the background worker makes the AI call and returns the result.
