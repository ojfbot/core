# MrPlug Architecture

Source: https://github.com/ojfbot/MrPlug

## Overview

A browser extension (Chrome/Firefox) that injects a UI overlay into any web page, allowing users to interact with an AI assistant about DOM elements and UI/UX feedback. Fundamentally different architecture from the other three projects — no server, no LangGraph, no Carbon Design System.

## Extension structure (target monorepo — issue #9)

```
packages/
  content-script/   Lightweight UI overlay injected into pages. CRITICAL: <100KB uncompressed, <30KB gzipped.
  background/       Service worker. AI API calls live here. No bundle size limit.
  popup/            Extension popup UI. <500KB.
  options/          Extension options page. <500KB.
  shared/           Common types, utilities, constants. CRITICAL: <50KB uncompressed.
```

Build tooling: Vite per package, pnpm workspaces, Lerna for monorepo orchestration.

## AI provider pattern (issue #16)

Currently: single `AIAgent` class with if/else for OpenAI vs. Anthropic in `src/lib/ai-agent.ts`.

Target: factory pattern with shared interface:
```typescript
interface IAIProvider {
  analyzeFeedback(userInput, elementContext, conversationHistory, agentMode): Promise<AIResponse>;
  validateApiKey(): boolean;
  getProviderName(): string;
  getModelName(): string;
}

class AIProviderFactory {
  static createProvider(apiKey: string): IAIProvider
}
```

Both OpenAI and Anthropic are supported. AI calls must live in the **background** package only — never in content-script.

## Security concerns

### Prompt injection from DOM (issue #15 — HIGH severity)

`src/lib/ai-agent.ts:106-136` (`formatUserPrompt`) directly interpolates:
- User input text
- DOM element class names, IDs, text content
- Computed CSS styles (all key-value pairs)

A malicious page can craft elements whose text content, classes, or computed styles contain prompt injection attacks that override system instructions.

**Required mitigations:**
- Strip/escape special characters from all DOM-sourced content before interpolation
- Use message roles correctly (system vs user) to separate instructions from user-controlled content
- Limit computed styles to a safe subset (known safe CSS properties only)
- Truncate DOM content to a maximum length
- Never include raw innerHTML

### API key storage

API keys are stored in extension storage (chrome.storage.local). Keys must be masked in UI (show last 4 chars only), validated on input, and never logged.

### Content script ↔ background messaging

Messages pass via `chrome.runtime.sendMessage`. Background must validate `sender.tab` origin before acting on messages. Messages should be typed and validated — not accepted as `any`.

## Bundle size enforcement (issue #13)

Content script has a hard limit: **<100KB uncompressed, <30KB gzipped**. This is non-negotiable for extension performance and Chrome Web Store compliance.

Enforcement: Vite `bundle-size-enforcer` plugin configured per package. CI must fail on regression. `@mrplug/shared` is also critical: <50KB uncompressed.

**`/extension-audit` and `/validate` note:** Any PR adding dependencies to `content-script` or `shared` must report the bundle size delta.

## Multithread chat (issue #18)

Each DOM element gets its own chat thread. Clicking an element opens or resumes its thread. UI: scrollable session list in modal, each session titled by element with a summary logline.

## MCP integration attempt (issue #23)

A WebSocket + HTTP MCP server was built to allow real-time communication between the extension and Claude Code terminal sessions. It was **functional but unstable** and has been deleted (commit 792f936). The architecture documented in #23 is a future direction, not current state.

## Key differences from other projects

| Dimension | cv-builder/TripPlanner/BlogEngine | MrPlug |
|-----------|----------------------------------|--------|
| Runtime | Node.js server | Browser extension |
| AI calls | Server-side (agent-graph) | Background service worker |
| Auth | JWT + thread ownership | API key in extension storage |
| UI framework | Carbon Design System | Custom (React for popup/options) |
| Agent framework | LangGraph | Direct AI API calls |
| Deployment | Container/server | Chrome Web Store |
| Bundle constraints | None critical | Content script <100KB CRITICAL |
| Security threat model | Network, SQL injection, thread access | Prompt injection from DOM, CSP, messaging |

## Key open issues

| # | Area | Description |
|---|------|-------------|
| #9 | Infra | Lerna monorepo setup (packages: content-script, background, popup, options, shared) |
| #16 | Architecture | Provider factory pattern for AI services |
| #15 | Security | Prompt injection from DOM content in formatUserPrompt |
| #13 | Performance | Bundle size enforcement (Vite plugin + CI) |
| #18 | Feature | Multithread chat sessions per DOM element |
| #12 | Infra | Shared package for common types/utils/constants |
| #11 | Infra | Background package for AI processing |
| #10 | Infra | Content-script package with size enforcement |
| #23 | Docs | MCP integration attempt documentation |
| #5 | Polish | Production UI/UX polish |
