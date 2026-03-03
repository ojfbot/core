# ADR-0014: Layered Deployment Architecture

Date: 2026-03-02
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /deploy, /scaffold, /hardening
Repos affected: shell, cv-builder, blogengine, tripplanner, core

---

## Context

Frame OS comprises two categories of service:

1. **UI layer** — Vite static bundles (shell + sub-app MF remotes). Zero server logic.
   After `vite build`, output is a `dist/` of HTML + JS + CSS files that any CDN can serve.

2. **Services layer** — Express APIs, frame-agent (LLM gateway), SQLite/Postgres databases.
   Requires persistent compute and secrets (ANTHROPIC_API_KEY, database credentials).

These two categories have fundamentally different operational profiles:

| Dimension | UI layer | Services layer |
|-----------|----------|----------------|
| Runtime | CDN (no compute) | Container / serverless |
| Cold start | None | Seconds |
| Cost at zero traffic | $0 | ~$5–70/mo |
| Deployment speed | ~30 s | Minutes |
| Secret surface | None (env vars baked at build) | API keys, DB credentials |
| Scaling | Global CDN, automatic | Manual / autoscaling |

The existing repository state:
- `k8s/` manifests exist in the shell repo (a planned K8s topology) but **no Dockerfiles exist**.
  The K8s architecture is aspirational — it describes the intended services-layer topology
  (Nginx Ingress, cluster DNS, frame-agent sidecar) but has never been deployed.
- `shell/.github/workflows/deploy.yml` targeted **GitHub Pages** as a placeholder deploy.
  GitHub Pages does not support custom SPA routing, preview environments, or per-subdomain
  CORS headers — it was a scaffolding choice, not a production commitment.
- The demo requirement (ADR-0013) is UI-only: no APIs needed.

**Domain note:** Production shell domain is `frame.jim.software`. The existing K8s ingress
and GitHub Pages workflow reference `app.jim.software` — this is superseded by ADR-0013/0014.

## Decision

Adopt a **two-layer deployment model** in which each layer is independently deployable,
independently versioned, and connected only through build-time environment variables.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Static CDN                                            │
│                                                                 │
│  frame.jim.software     →  shell-app (Vercel)                   │
│  trips.jim.software     →  tripplanner browser-app (Vercel)     │
│  cv.jim.software        →  cv-builder browser-app (Vercel)      │
│  blog.jim.software      →  blogengine browser-app (Vercel)      │
│                                                                 │
│  VITE_FRAME_AGENT_URL   ──────────────────────────┐             │
│  VITE_REMOTE_*          (baked at build time)      │             │
│  VITE_API_URL           ───────────────────────────┤             │
└────────────────────────────────────────────────────┼────────────┘
                                                     │ (env var)
┌────────────────────────────────────────────────────▼────────────┐
│  Layer 2: Cloud Services              [not yet deployed]        │
│                                                                 │
│  frame-agent (Express + Anthropic)   port 4001                  │
│  cv-builder API (Express + SQLite)   port 3001                  │
│  tripplanner API (Express + SQLite)  port 3011                  │
│  blogengine API (Express + SQLite)   port 3006                  │
│                                                                 │
│  Provider TBD: K8s (EKS / DigitalOcean) | Railway | fly.io     │
└─────────────────────────────────────────────────────────────────┘
```

### Connection protocol

Layer 1 reads Layer 2 URLs at **Vite build time** via `VITE_*` environment variables.
Vercel project settings hold the authoritative values; local `.env.production` files
provide defaults for local builds.

When Layer 2 comes online:
1. Set `VITE_FRAME_AGENT_URL=https://api.jim.software/frame` in each Vercel project
2. Trigger a redeploy (push to main, or Vercel dashboard "Redeploy")
3. Layer 1 connects to Layer 2 — no code changes required

When Layer 2 is offline (demo mode): env vars are empty → existing error guards show
graceful empty state (ADR-0013).

### Layer 1 — CDN provider: Vercel (Phase 1)

Vercel is chosen for Phase 1 because:
- Free tier covers demo scale (100 GB bandwidth/month)
- Preview deployments on PRs with automatic URL comments
- `vercel.json` covers build command, SPA routing, and CORS headers in one file
- GitHub CI integration via token-based GitHub Actions (no GitHub App required)
- Custom domain + automatic TLS provisioning

**Long-term optionality:** The `vercel.json` config maps directly to S3+CloudFront
(swap `vercel.json` headers for CloudFront Response Headers Policy, swap `rewrites`
for CloudFront custom error pages). Migration is a one-day infrastructure task.

### Layer 1 — CI/CD: GitHub Actions → Vercel CLI

Each sub-app repo has `.github/workflows/deploy.yml`:
- `push` to `main` → `vercel deploy --prod` (production)
- `pull_request` targeting `main` → `vercel deploy` (preview) + PR comment with URL

Required GitHub secrets per repo (set after initial `vercel` CLI deploy):

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` (after `vercel link`) |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` (after `vercel link`) |

### Layer 2 — Container topology (future, K8s manifests in `shell/k8s/`)

The existing K8s manifests describe the intended services topology. They become active
when Dockerfiles are written (one per service). Provider evaluation deferred to Phase 2.

**Candidate providers:**

| Provider | Best for | Min monthly cost |
|----------|----------|-----------------|
| EKS | Full K8s (exact manifest match) | ~$70 (control plane) |
| DigitalOcean K8s | Cheaper K8s | ~$12 |
| Railway | Simple container deploys, no K8s | ~$5 |
| fly.io | Global edge containers | ~$0 (generous free tier) |
| EC2 + docker-compose | Closest to local dev | ~$5 (t4g.nano) |

Railway or fly.io are recommended for Phase 2 to avoid K8s operational overhead
until traffic demands it.

## Consequences

### Benefits
- Layer 1 is live **tonight** with no server cost.
- Future cloud migration is scoped to env var updates + one Vercel redeploy.
- The K8s architecture is preserved and can be activated when Dockerfiles are written.
- Preview environments on every PR = visual regression detection before merging.

### Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Vercel vendor lock-in | S3+CloudFront migration path is one-day work; `vercel.json` is thin |
| Build-time env var leakage | `VITE_*` vars are public by design (baked into JS bundles); no secrets in Layer 1 |
| Layer 2 cold start delay | Acceptable at MVP scale; mitigated by health-check routes and keep-alive pings |
| K8s manifests drift from reality | Review manifests at Phase 2 kickoff; ingress domain already updated (`app.` → `frame.jim.software`) |

## Superseded decisions

- Shell `deploy.yml` (GitHub Pages) → replaced by Vercel deploy workflow
- K8s ingress `app.jim.software` → superseded by `frame.jim.software` (ADR-0013)
