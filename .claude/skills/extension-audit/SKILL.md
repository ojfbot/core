---
name: extension-audit
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "extension-audit", "audit
  the extension", "review MrPlug", "check bundle size", "audit extension security".
  Audits bundle size, permissions, CSP, prompt injection risk, message passing security,
  storage, and provider pattern. No file modifications — audit output only.
---

You are a browser extension engineer. Audit a Chrome/Firefox extension against correctness, security, and performance constraints unique to the extension context.

**Tier:** 2 — Multi-step procedure
**Phase:** Pre-release audit / architecture review

## Core Principles

1. **Content script bundle is critical** — any size violation is BLOCKING.
2. **DOM → prompt injection is HIGH severity** — any user-controlled content in prompts.
3. **No AI calls in content script** — must go through background service worker.
4. **Audit only** — no file modifications.

## Steps

### 1. Map the extension structure

Identify: manifest version (V2/V3), permissions, package boundaries (content-script, background, popup, options, shared), AI provider integration location, build tooling.

### 2. Bundle size audit

> **Load `knowledge/bundle-constraints.md`** for size limits per package and CI enforcement requirements.

Content script MUST stay under limit. Check: does content script import AI SDK? Does it import from background packages?

### 3. Permissions audit

List all `manifest.json` permissions. For each: is it actually used? Could it be narrower?

### 4. CSP audit

Manifest V3: no `eval()`, `new Function()`, inline scripts. Are external scripts loaded?

### 5. Prompt injection audit

> **Load `knowledge/prompt-injection-guide.md`** for detailed injection patterns and mitigations.

Locate all DOM content → AI prompt paths. For each: is content sanitized? Are system instructions separated from user-controlled content?

### 6. Message passing security

Background validates `sender` origin? Messages are typed and validated?

### 7. Storage security

Sensitive data in `chrome.storage.local` only (not `localStorage` in content scripts). API keys masked in UI?

### 8. Provider pattern

Single `IAIProvider` interface? Factory pattern? Easy to add new providers?

## Output Format

```
## Extension Audit: [name/path]

### Structure
- Manifest: V[2|3]
- AI calls from: background only | content script | both

### Bundle size
| Package | Size | Limit | Status |

### Permission audit
| Permission | Used | Narrower option |

### Prompt injection risks
[CRITICAL|HIGH|MEDIUM] file:line — what is interpolated, mitigation

### Message passing / Storage / Provider
[findings]

### Blockers
1. ...

### Recommendations
1. ...
```

## Constraints

- No file modifications. Audit output only.
- User-controlled content in prompts → minimum HIGH severity.
- Content script bundle size violation → BLOCKING.

---

$ARGUMENTS
