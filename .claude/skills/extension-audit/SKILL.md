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

## Gotchas

- **Bundle size means the content-script bundle, not the repo total.** The trap is reporting the popup or background bundle (which can be large and fine) and missing that the content script silently imports the AI SDK or a background package. The blocking number is the *injected* bundle; trace its imports, don't read `dist/` totals.
- **DOM text in a prompt is HIGH even when the page "looks safe."** The model under-rates injection because the test page is benign. But the threat model is a *hostile* page feeding the content script — any unsanitized DOM→prompt path is minimum HIGH regardless of how trustworthy the demo site is. Severity tracks the path's existence, not the current page.
- **An unused permission is a finding, not a footnote.** It's tempting to wave through `manifest.json` permissions that "seem reasonable." Each one is attack surface and a review-store rejection risk; for every permission, prove it's actually exercised in code or flag it for narrowing/removal.
- **MV2 vs MV3 changes which checks even apply.** Running the MV3 CSP checklist (no `eval`, no remote scripts) against an MV2 extension produces false BLOCKERs and misses MV2's real gaps. Read the manifest version in Step 1 and branch the audit — don't apply one ruleset blindly.
- **No file modifications — and that includes the "obvious" one-line fix.** This skill outputs findings only. The reflex to just tighten a CSP string or narrow a permission inline violates the contract; emit the recommendation and let the developer apply it.

---

$ARGUMENTS
