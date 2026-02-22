# App Templates

Canonical structures, dependency versions, and conventions for each application type in the ojfbot ecosystem. Used as the reference by `/scaffold-app`.

---

## Template: `langgraph-app`

Full-stack web application. Covers the cv-builder, TripPlanner, and BlogEngine family. See `shared-stack.md` for cross-cutting patterns.

### File structure

```
<name>/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── README.md
├── package.json                  # root: private, pnpm workspaces, scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
├── biome.json                    # linting/formatting
├── .github/
│   └── workflows/
│       └── ci.yml
└── packages/
    ├── shared/                   # common types, constants, utils
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       └── types.ts
    ├── agent-graph/              # LangGraph implementation
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── state/
    │       │   └── schema.ts     # ProjectState type + reducers
    │       ├── nodes/
    │       │   └── index.ts      # stub node exports
    │       ├── graph.ts          # CompiledGraph export
    │       └── checkpointer.ts   # SQLite checkpointer setup
    ├── api/                      # Express server
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts          # server entry, port from env
    │       ├── routes/
    │       │   ├── index.ts      # route registration
    │       │   └── health.ts     # GET /health
    │       ├── middleware/
    │       │   ├── auth.ts       # authenticateJWT
    │       │   └── ownership.ts  # checkThreadOwnership
    │       └── utils/
    │           └── logger.ts     # getLogger(module)
    └── browser-app/              # React + Carbon Design System
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx           # Carbon Shell + router
            └── components/
                └── Dashboard.tsx # placeholder tab layout
```

### Root `package.json`

```json
{
  "name": "<name>",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/src/__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: { reporter: ['text', 'lcov'] },
  },
});
```

### `packages/api` key dependencies

```json
{
  "dependencies": {
    "@<org>/<name>-agent-graph": "workspace:*",
    "@<org>/<name>-shared": "workspace:*",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.0",
    "better-sqlite3": "^11.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

### `packages/agent-graph` key dependencies

```json
{
  "dependencies": {
    "@<org>/<name>-shared": "workspace:*",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "better-sqlite3": "^11.0.0",
    "zod": "^3.23.0"
  }
}
```

### `packages/browser-app` key dependencies

```json
{
  "dependencies": {
    "@<org>/<name>-shared": "workspace:*",
    "@carbon/react": "^1.71.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

### Auth middleware pattern (`packages/api/src/middleware/auth.ts`)

```typescript
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getLogger } from '../utils/logger.js';

const log = getLogger('auth');

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  if (process.env.MOCK_AUTH === 'true') {
    (req as any).user = { userId: 'dev-user', email: 'dev@example.com' };
    return next();
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }
  try {
    (req as any).user = jwt.verify(token, process.env.JWT_SECRET!);
    next();
  } catch (err) {
    log.warn({ err }, 'JWT verification failed');
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### State schema pattern (`packages/agent-graph/src/state/schema.ts`)

```typescript
import { Annotation } from '@langchain/langgraph';

export const ProjectStateAnnotation = Annotation.Root({
  // TODO: add state fields with reducers
  messages: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  error: Annotation<string | null>({ reducer: (_, b) => b, default: () => null }),
});

export type ProjectState = typeof ProjectStateAnnotation.State;
```

### LangGraph node stub

```typescript
import type { ProjectState } from '../state/schema.js';
import { getLogger } from '../../api/src/utils/logger.js'; // or shared logger

const log = getLogger('my-node');

export async function myNode(state: ProjectState): Promise<Partial<ProjectState>> {
  // SCAFFOLD: stub — implement business logic here
  log.info('myNode called');
  return {};
}
```

### `.env.example`

```
ANTHROPIC_API_KEY=sk-ant-...          # TODO: set real value
JWT_SECRET=change-me-in-production    # TODO: set real value
MOCK_AUTH=true                        # set false in production
PORT=3001
DATABASE_PATH=.data/app.sqlite
```

### GitHub Actions CI (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['20', '22']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
```

### CLAUDE.md template

```markdown
# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Commands

\`\`\`bash
pnpm install                          # install all workspace dependencies
pnpm build                            # compile all packages
pnpm test                             # run vitest
pnpm test:watch                       # vitest watch mode
pnpm lint                             # biome check
pnpm --filter @<org>/<name>-api build # build one package
pnpm vitest run packages/api/src/__tests__/health.test.ts
\`\`\`

## Architecture

Four packages in pnpm workspaces:

| Package | Role |
|---------|------|
| `shared` | Common types, constants, utilities |
| `agent-graph` | LangGraph state machine, nodes, RAG, SQLite checkpointer |
| `api` | Express server, JWT auth middleware, SSE streaming |
| `browser-app` | React + Carbon Design System frontend |

## Key conventions

- All new Express routes under `/api/v2/` must apply `authenticateJWT`. Routes with `:threadId` must also apply `checkThreadOwnership`. Missing either blocks merge.
- Logging: `getLogger('module-name')` from `packages/api/src/utils/logger.ts`. No `console.*` in any package.
- LangGraph nodes: `async function myNode(state): Promise<Partial<State>>` — return partial state, never throw.
- State fields: always add to `ProjectStateAnnotation` with a reducer. No implicit any.
```

---

## Template: `browser-extension`

Chrome/Firefox extension. Covers the MrPlug pattern. See `mrplug-architecture.md`.

### File structure

```
<name>/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── README.md
├── manifest.json                 # Manifest V3
├── package.json                  # root: private, pnpm workspaces
├── pnpm-workspace.yaml
├── lerna.json
├── tsconfig.base.json
├── .github/
│   └── workflows/
│       └── ci.yml
└── packages/
    ├── shared/                   # CRITICAL: <50KB uncompressed
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts          # Message types for chrome.runtime messaging
    │       └── constants.ts
    ├── content-script/           # CRITICAL: <100KB uncompressed, <30KB gzipped
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts        # bundle-size-enforcer plugin
    │   └── src/
    │       └── index.ts          # NO AI imports, NO localStorage
    ├── background/               # Service worker — AI calls live here
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── messageHandler.ts # validates sender.tab before acting
    │       └── aiProvider.ts     # IAIProvider factory stub
    ├── popup/                    # <500KB
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   ├── popup.html
    │   └── src/
    │       ├── main.tsx
    │       └── Popup.tsx
    └── options/                  # <500KB
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── options.html
        └── src/
            ├── main.tsx
            └── Options.tsx
```

### `manifest.json` (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "<Name>",
  "version": "0.1.0",
  "description": "<description>",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "packages/background/dist/index.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["packages/content-script/dist/index.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "packages/popup/popup.html",
    "default_title": "<Name>"
  },
  "options_ui": {
    "page": "packages/options/options.html",
    "open_in_tab": true
  }
}
```

### `packages/shared` key types (`src/types.ts`)

```typescript
// All chrome.runtime messages must be typed — never accept `any`
export type MessageType = 'ANALYZE_ELEMENT' | 'GET_COVERAGE' | 'OPEN_THREAD';

export interface ExtensionMessage {
  type: MessageType;
  payload: unknown;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: 'openai' | 'anthropic';
}

export interface IAIProvider {
  analyzeFeedback(
    userInput: string,
    elementContext: string,
    conversationHistory: string[],
    agentMode: string,
  ): Promise<AIResponse>;
  validateApiKey(): boolean;
  getProviderName(): string;
  getModelName(): string;
}
```

### Bundle size enforcer Vite plugin (`packages/content-script/vite.config.ts`)

```typescript
import { defineConfig, type Plugin } from 'vite';
import { statSync } from 'fs';

function bundleSizeEnforcer(limitBytes: number): Plugin {
  return {
    name: 'bundle-size-enforcer',
    closeBundle() {
      const stat = statSync('dist/index.js');
      if (stat.size > limitBytes) {
        throw new Error(
          `Bundle size ${stat.size} bytes exceeds limit of ${limitBytes} bytes`
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [bundleSizeEnforcer(100_000)], // 100KB hard limit
  build: {
    rollupOptions: { input: 'src/index.ts' },
    minify: true,
  },
});
```

### Background message handler pattern

```typescript
// packages/background/src/messageHandler.ts
import type { ExtensionMessage } from '@<org>/<name>-shared';

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // SCAFFOLD: always validate sender origin before acting
  if (!sender.tab?.id) {
    console.warn('Message received without valid sender tab — ignoring');
    return false;
  }
  // AI calls belong here, never in content-script
  handleMessage(message, sender).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(msg: ExtensionMessage, sender: chrome.runtime.MessageSender) {
  // TODO: implement message routing
  return { error: 'not implemented' };
}
```

### API key storage pattern (options page)

```typescript
// Store in chrome.storage.local — NOT localStorage (accessible to page scripts)
await chrome.storage.local.set({ apiKey: key });
const { apiKey } = await chrome.storage.local.get('apiKey');

// Display: mask all but last 4 chars
const masked = apiKey ? `****${apiKey.slice(-4)}` : '(not set)';
```

### GitHub Actions CI (with bundle size check)

```yaml
name: CI
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['20', '22']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Build all packages (enforces bundle size limits)
        run: pnpm -r build
      - name: Report bundle sizes
        run: |
          echo "content-script: $(stat -c%s packages/content-script/dist/index.js 2>/dev/null || stat -f%z packages/content-script/dist/index.js) bytes"
          echo "shared: $(du -sb packages/shared/dist 2>/dev/null | cut -f1 || du -sk packages/shared/dist | awk '{print $1*1024}') bytes"
```

### `.env.example`

```
# API keys are stored in chrome.storage.local at runtime, not in .env
# This file is for build-time configuration only.
VITE_APP_NAME=<Name>   # TODO: set real value
```

### CLAUDE.md template

```markdown
# CLAUDE.md

## Commands

\`\`\`bash
pnpm install
pnpm -r build           # builds all packages; FAILS if content-script > 100KB
pnpm -r dev             # watch mode for all packages
# Load unpacked: chrome://extensions → Developer mode → Load unpacked → select repo root
\`\`\`

## Architecture

Five packages. Bundle limits are non-negotiable:

| Package | Limit | Role |
|---------|-------|------|
| `shared` | <50KB | Types, constants, utilities shared across packages |
| `content-script` | <100KB / <30KB gz | DOM overlay injected into pages. NO AI imports. NO localStorage. |
| `background` | none | Service worker. All AI API calls live here. |
| `popup` | <500KB | Extension popup UI |
| `options` | <500KB | API key configuration UI |

## Key conventions

- AI calls: background package only. Never import an AI SDK in content-script or shared.
- Messaging: all chrome.runtime messages are typed (ExtensionMessage). Background validates sender.tab before acting.
- API key storage: chrome.storage.local only. Never localStorage. Never log the key.
- DOM content in prompts: strip special chars, truncate to 2000 chars, never pass raw innerHTML.
- Adding dependencies to content-script or shared: report bundle delta in PR description.
```

---

## Template: `python-scraper`

Python knowledge base / scraper. Covers the purefoy pattern. See `purefoy-architecture.md`.

### File structure

```
<name>/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── README.md
├── pyproject.toml
├── .github/
│   └── workflows/
│       └── ci.yml
├── library/
│   ├── .gitkeep
│   └── README.md        # documents the leaf storage schema
├── documentation/
│   └── roadmap/
│       └── ROADMAP.md
└── src/
    └── <name>/
        ├── __init__.py
        ├── __main__.py  # delegates to cli.py
        ├── config.py    # pydantic-settings Config model
        ├── models.py    # Pydantic v2 leaf models
        ├── http_client.py  # rate-limited, ETag-aware
        ├── parser.py    # site-specific HTML parser stub
        ├── normalize.py # slug generation, timestamp normalization
        ├── pipeline.py  # orchestration: HttpClient → Parser → Normalize → Store → Index
        ├── store.py     # JSON leaf writer (deterministic slug paths)
        ├── index_sqlite.py  # SQLite FTS5 full-text index
        ├── cli.py       # typer CLI commands
        └── mcp_server.py   # stdio JSON-RPC MCP server
```

### `pyproject.toml`

```toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "<name>"
version = "0.1.0"
description = "<description>"
requires-python = ">=3.11"
dependencies = [
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "httpx>=0.27",
    "beautifulsoup4>=4.12",
    "lxml>=5.0",
    "typer[all]>=0.12",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-httpx>=0.30",
    "ruff>=0.6",
    "mypy>=1.10",
]

[project.scripts]
"<name>" = "<name>.cli:app"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
target-version = "py311"
line-length = 100
select = ["E", "F", "I", "N", "UP", "ANN"]

[tool.mypy]
python_version = "3.11"
strict = true
```

### `src/<name>/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="<NAME>_", env_file=".env")

    base_url: str = Field(..., description="Target site base URL")  # TODO: set default
    user_agent: str = "Mozilla/5.0 (compatible; <name>-scraper/1.0)"
    delay_s: float = 3.0
    timeout_s: float = 30.0
    max_retries: int = 3
    out_dir: str = "library"
```

### `src/<name>/models.py` — leaf model pattern

```python
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
import hashlib


class Provenance(BaseModel):
    source_url: str
    scraped_at: datetime = Field(default_factory=datetime.utcnow)
    etag: str | None = None
    content_hash: str | None = None


class Integrity(BaseModel):
    content_hash: str   # SHA-256 of content_text
    parser_version: str


# TODO: define domain-specific leaf models using this pattern:
# class ItemLeaf(BaseModel):
#     id: str
#     slug: str
#     content_text: str
#     provenance: Provenance
#     integrity: Integrity
```

### `src/<name>/http_client.py` — rate-limited ETag client

```python
import time
import httpx
from .config import Config


class HttpClient:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._client = httpx.Client(
            headers={"User-Agent": config.user_agent},
            timeout=config.timeout_s,
            follow_redirects=True,
        )
        self._etag_cache: dict[str, str] = {}

    def get(self, url: str) -> httpx.Response | None:
        """Returns None on 304 Not Modified (cached)."""
        headers: dict[str, str] = {}
        if etag := self._etag_cache.get(url):
            headers["If-None-Match"] = etag
        time.sleep(self._config.delay_s)
        response = self._client.get(url, headers=headers)
        if response.status_code == 304:
            return None
        response.raise_for_status()
        if etag := response.headers.get("ETag"):
            self._etag_cache[url] = etag
        return response

    def close(self) -> None:
        self._client.close()
```

### `src/<name>/mcp_server.py` — stdio JSON-RPC stub

```python
"""MCP server — exposes scraper tools to Claude Code via stdio JSON-RPC."""
import json
import sys
from typing import Any

MCP_TOOLS = [
    {
        "name": "scrape_item",  # TODO: rename and define real tools
        "description": "Scrape a single item and return its leaf JSON.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "slug": {"type": "string"},
                "query_context": {"type": "string"},
            },
            "required": ["slug", "query_context"],
        },
    },
]


class MCPServer:
    def list_tools(self) -> list[dict[str, Any]]:
        return MCP_TOOLS

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "scrape_item":
            return self._scrape_item(arguments)
        return {"error": f"Unknown tool: {name}"}

    def _scrape_item(self, args: dict[str, Any]) -> dict[str, Any]:
        # TODO: implement
        return {"status": "not_implemented"}

    def serve(self) -> None:
        for line in sys.stdin:
            request = json.loads(line)
            method = request.get("method")
            if method == "tools/list":
                result = {"tools": self.list_tools()}
            elif method == "tools/call":
                result = self.call_tool(
                    request["params"]["name"],
                    request["params"].get("arguments", {}),
                )
            else:
                result = {"error": f"Unknown method: {method}"}
            print(json.dumps({"id": request.get("id"), "result": result}), flush=True)
```

### `.env.example`

```
<NAME>_BASE_URL=https://example.com   # TODO: set real value
<NAME>_DELAY_S=3.0
<NAME>_TIMEOUT_S=30.0
<NAME>_OUT_DIR=library
```

### GitHub Actions CI

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: mypy src/
      - run: pytest --tb=short --cov=src --cov-report=lcov
```

### `.gitignore` additions specific to this template

```
# Scraped data (decide per project whether to track)
library/*/

# Session cookies — never commit
**/session_cookies.json

# Python
__pycache__/
*.py[cod]
.venv/
*.egg-info/
.mypy_cache/
.ruff_cache/
.pytest_cache/
*.sqlite
*.db
```

### CLAUDE.md template

```markdown
# CLAUDE.md

## Commands

\`\`\`bash
pip install -e ".[dev]"    # install with dev extras
<name> --help              # CLI entry point
python -m <name> --help    # alternative entry
pytest                     # run tests
pytest -k test_pipeline    # run specific test
ruff check .               # lint
mypy src/                  # type check
\`\`\`

## Architecture

Composable pipeline: HttpClient → Parser → Normalize → Store (JSON) → SQLite FTS5 index.

| Module | Role |
|--------|------|
| `config.py` | Pydantic-settings config, reads `<NAME>_*` env vars |
| `models.py` | Leaf Pydantic models — the canonical data schema |
| `http_client.py` | Rate-limited, ETag-aware HTTP client |
| `parser.py` | Site-specific HTML parsing → raw dict |
| `normalize.py` | Slug generation, timestamp normalization, content hashing |
| `pipeline.py` | Orchestration — wires all stages together |
| `store.py` | Writes deterministic slug-based JSON paths under `library/` |
| `index_sqlite.py` | SQLite FTS5 full-text index (rebuild from JSON) |
| `cli.py` | typer CLI commands |
| `mcp_server.py` | stdio JSON-RPC MCP server (tools for Claude Code) |

## Key conventions

- All leaf models include `Provenance` and `Integrity` fields.
- Paths under `library/` are deterministic from slug — same slug always maps to the same path.
- HTTP client always rate-limits (configurable via `<NAME>_DELAY_S`). Do not call `http_client.get()` in a tight loop.
- Re-running any pipeline stage is safe (idempotent). ETags prevent redundant fetches.
- Never commit session cookies. `**/session_cookies.json` is in `.gitignore`.
```
