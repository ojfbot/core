# Adversarial Probing Methodology

## Why This Exists

The Airbnb false-negative incident (April 2026): a resume scored "Not Evident" for cross-platform mobile collaboration (R5) despite the candidate having:
- Swift fundamentals from an iOS bootcamp
- Extensive mobile API coordination through GraphQL Client Data Services work
- Regular liaison with iOS mobile developers about TypeScript GraphQL schema changes

The false negative went undetected through the entire resume generation and review pipeline. This methodology exists to systematically prevent that class of error.

## Probe Types

### 1. Technology Inference Probe

**Question:** Does any listed technology or framework imply this skill?

**Examples:**
| Listed Technology | Implies |
|---|---|
| GraphQL | API consumers including mobile clients |
| Module Federation | Build system expertise, micro-frontend architecture |
| Kubernetes | Container orchestration, infrastructure ops |
| Redux | State management patterns, event-driven architecture |
| WebSocket | Real-time systems, bidirectional communication |
| OAuth/JWT | Security, authentication flows, token management |
| Playwright/Cypress | E2E testing, CI integration, browser automation |

**How to apply:** For each "Not Evident" requirement, check every technology on the resume. Ask: "Would someone using [technology X] necessarily have exposure to [requirement Y]?"

### 2. Role Inference Probe

**Question:** Does the role context or team structure imply cross-functional exposure?

**Examples:**
| Role Context | Implies |
|---|---|
| "Client Data Services" | Mobile client coordination (clients = iOS, Android, web) |
| "Platform team" | Cross-team collaboration, API design for consumers |
| "Staff engineer" | Mentoring, architecture reviews, cross-org influence |
| "Led migration from X to Y" | Change management, stakeholder communication |
| "15+ consumer teams" | API governance, versioning, breaking change management |

**How to apply:** For each gap, decompose the candidate's stated roles. What does "leading" or "architecting" actually require day-to-day?

### 3. Achievement Decomposition Probe

**Question:** Could any listed achievement have required this skill as a necessary sub-task?

**Examples:**
| Achievement | Hidden sub-tasks |
|---|---|
| "Reduced build time by 60%" | Build system profiling, CI pipeline optimization, caching strategies |
| "Migrated 200K LOC to TypeScript" | Type system design, gradual adoption strategy, team training |
| "Shipped real-time collaboration" | WebSocket architecture, conflict resolution, state synchronization |
| "Designed GraphQL schema for 15+ teams" | API versioning, schema governance, consumer coordination (including mobile) |

**How to apply:** Take the achievement and work backward: what would someone actually need to DO to accomplish this? Each sub-task is potential evidence.

### 4. Adjacent Skill Check

**Question:** Is there a closely related skill that could be legitimately reframed?

**Examples:**
| Required Skill | Adjacent Skills |
|---|---|
| React Native | React + mobile API work + any native mobile exposure |
| Python ML pipelines | Python scripting + data processing + LLM integration |
| AWS Lambda | Any serverless (Vercel, Cloudflare Workers) + AWS experience |
| Rust | C/C++ + systems programming + performance optimization |
| Vue.js | React (same paradigm, different syntax) |

**How to apply:** Check if the candidate has 2+ adjacent skills that, combined, demonstrate capability. This produces an "Adjacent Gap" classification, not a rating upgrade — the user must verify.

## Decision Tree

```
Is the requirement scored "Not Evident" or "Partially Met"?
├── YES → Run all 4 probes
│   ├── Probe finds direct evidence → Upgrade to "Met" or "Strongly Met"
│   │   └── Note: "Upgraded via [probe type]: [evidence]"
│   ├── Probe finds indirect evidence → Classify as "Framing Gap" or "Adjacent Gap"
│   │   └── Generate rewrite suggestion / ask user to verify
│   └── All probes find nothing → Confirm as "True Gap"
│       └── Note: "Confirmed gap after adversarial probing"
└── NO → No probing needed
```

## Anti-patterns

- **Wishful thinking:** Don't upgrade ratings based on "they probably did X." Only upgrade when the evidence chain is clear.
- **False adjacency:** "Knows JavaScript" does not imply "Knows Rust." Adjacent skills must share real conceptual overlap.
- **Skipping probes:** Run ALL four probes before accepting a gap. The Airbnb incident was caught by role inference, which was the third probe tried.
- **Silent upgrades:** Always document which probe found the evidence and what the evidence chain is.
