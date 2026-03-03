# ADR-0013: Safe Demo Deployment — Frame OS at frame.jim.software

Date: 2026-03-02
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /deploy, /validate, /frame-dev
Repos affected: shell, tripplanner, cv-builder, blogengine

---

## Context

Frame OS is ready for external demo at `frame.jim.software`. The shell renders all
four sub-apps (cv-builder, blogengine, tripplanner, purefoy) as Module Federation
remotes via ADR-0012. The frame-agent (port 4001) is the single LLM gateway (ADR-0002).

Three categories of live connection exist that carry risk in a public demo:

1. **Shell → frame-agent**: NL messages routed to Claude via Anthropic API — incurs
   LLM billing and requires ANTHROPIC_API_KEY deployed to a server.
2. **Sub-app frontends → own APIs**: data CRUD (threads, trips, bios, posts) — requires
   databases and potentially OpenAI API keys deployed server-side.
3. **Shell → sub-app MF bundles**: static asset fetches over HTTP — no LLM or data risk,
   but requires CORS headers on remote origins.

Without user sessions or authentication, any live API connection also exposes
unauthenticated data endpoints to the public internet.

**Options evaluated:**

- **Option A** *(chosen)*: No frame-agent deployed; shell renders graceful offline state;
  sub-apps served as Vercel static deployments with empty `VITE_API_URL` → axios fails
  fast → existing error guards show empty UI. Zero server cost.
- **Option B**: Deploy frame-agent with a feature flag disabling Anthropic calls (returns
  canned responses). Sub-apps still need empty API config. More moving parts, higher
  operational risk, no meaningful benefit over Option A for a wireframe demo.

## Decision

Deploy Frame OS at `frame.jim.software` as a **UI wireframe** with no live API or LLM
connections. All interactive features that require a server will render in a clear empty
or offline state. No production secrets are embedded in deployed bundles.

### Architecture

```
frame.jim.software  (Vercel — shell-app static build)
  ├── loads cv.jim.software/assets/remoteEntry.js     (Vercel — cv-builder static)
  ├── loads blog.jim.software/assets/remoteEntry.js   (Vercel — blogengine static)
  ├── loads trips.jim.software/assets/remoteEntry.js  (Vercel — tripplanner static)
  └── [frame-agent NOT deployed — shell renders offline badge]
```

### Implementation phases

| ID | Repo | Task | Status |
|----|------|------|--------|
| D1 | tripplanner | Centralized `src/api/client.ts` — axios instance with `baseURL: VITE_API_URL ?? ''` | Done |
| D2 | all sub-apps | Empty-state audit — confirm no crash when API unavailable | Ongoing |
| D3 | shell | Demo mode guard — empty `VITE_FRAME_AGENT_URL` disables input, shows offline badge | Done |
| D4 | shell, tripplanner | `.env.production` files with empty API vars and correct MF remote URLs | Done |
| D5 | all sub-apps | `vercel.json` per sub-app — CORS headers on MF remote origins | Pending |
| D6 | all | Vercel projects created, domains configured | Pending |
| D7 | DNS | CNAME records pointing subdomains to Vercel | Pending |
| D8 | all | CI/CD pipeline for Vercel deploys on push to `main` | Out of scope (Phase 2) |
| D9 | — | Smoke test checklist (see Checkpoints) | Pending |

### D1 — Tripplanner API client

Sub-app axios calls use bare `import axios from 'axios'` with relative paths. In MF
context relative paths resolve to the HOST origin (`frame.jim.software`), not the remote
origin (`trips.jim.software`). A centralized axios instance with `VITE_API_URL` as
`baseURL` decouples the API target from the document origin and makes demo mode
(empty `VITE_API_URL`) explicit.

```typescript
// tripplanner/packages/browser-app/src/api/client.ts
import axios from 'axios'
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})
```

All Redux thunks replace bare `axios.*()` with `apiClient.*()`.

### D3 — Shell offline mode

`VITE_FRAME_AGENT_URL` already read in `ShellHeader.tsx`. When set to empty string
(nullish coalescing does NOT trigger on `''`), `frameAgentUrl === ''` → `agentAvailable`
is `false` → input and submit button disabled, placeholder reads
"Agent offline — demo mode".

### D4 — .env.production files

`shell/packages/shell-app/.env.production`:
```
VITE_FRAME_AGENT_URL=
VITE_REMOTE_CV_BUILDER=https://cv.jim.software
VITE_REMOTE_BLOGENGINE=https://blog.jim.software
VITE_REMOTE_TRIPPLANNER=https://trips.jim.software
VITE_REMOTE_PUREFOY=https://purefoy.jim.software
VITE_REMOTE_CORE_READER=https://reader.jim.software
```

`tripplanner/packages/browser-app/.env.production`:
```
VITE_API_URL=
```

## Consequences

### Benefits
- Zero server cost and zero LLM billing for the demo deployment.
- No secrets in Vercel environment variables for Phase 1.
- Sub-app error states are already coded (Array.isArray guards, rejected handlers).

### Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| MF remote CORS block | High (default) | `vercel.json` with `Access-Control-Allow-Origin: *` on each remote (D5) |
| Sub-app crash on empty API | Low | Existing `Array.isArray` guards + rejected error handlers; D2 audit confirms |
| Users confused by blank sub-app panels | Medium | D3 offline badge makes agent status explicit; sub-apps show empty state chrome |
| API keys inadvertently bundled | Low | Keys are server-side env vars only; Vite strips `VITE_` prefix vars not explicitly referenced |
| Sub-app CSS not injected in MF context | Prevented | All remotes follow ADR-0012 pattern (`vite-plugin-css-injected-by-js` scoped to expose chunks) |
| Remote version skew after future deploy | Low (Phase 1) | Pin remote URLs to specific deploy hashes in Phase 2 CI/CD |

## Checkpoints

1. **D1 + D3 local smoke test**: Run shell with `VITE_FRAME_AGENT_URL=''` and
   tripplanner with `VITE_API_URL=''`; confirm shell shows offline badge; confirm
   tripplanner panels render without crash.
2. **D4 build verification**: `pnpm build` in shell-app; inspect `dist/assets/remoteEntry.js`
   to confirm hardcoded localhost URLs are absent.
3. **D5 + D6 remote isolation test**: Load sub-app builds from their Vercel domains directly
   (standalone) — confirm they render their Dashboard without errors.
4. **D7 integration test**: Open `frame.jim.software`; confirm all four remotes load (DevTools
   Network tab shows `remoteEntry.js` from correct subdomains, 200 OK, no CORS errors).
5. **Go/no-go gate**: All four checkpoints pass before sharing demo URL externally.
