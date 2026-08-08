# ADR: CONTEXT.md — root-level glossary with bounded deeper-pointers, routing stays in CLAUDE.md
slug: context-md-glossary-pointer-convention
serial: draft
rev:
Date: 2026-08-08
Status: Proposed
domain: meta
type: convention
OKR:
Commands affected: /wait-what (new — reads it), /grill-with-docs (stages diffs to it; path re-pointed from domain-knowledge/CONTEXT.md to root), /investigate (reads it if present, upstream-mirrored), /vault (wiki pages are pointer targets)
Repos affected: core (seeded); every fleet repo lazily; ~/selfco (pointer target, not host)
gate:
baseline:
traces:
  supersedes:
  amends: [pocock-skill-conventions-and-new-skills]
  relates-to: [claude-md-loading-discipline, wrap-absorb-reject, grill-with-docs-skill]
  parent:
  part-of-series:

---

## Context

Three surfaces have referenced a `CONTEXT.md` no repo actually has: the user-scope
ubiquitous-language rule (`~/.claude/CLAUDE.md`) searches for it, `/grill-with-docs` stages
diffs to `domain-knowledge/CONTEXT.md`, and the newly absorbed `/wait-what` (adopt-stack
pocock-skills-v1-2 D37) binds its vocabulary half to it. The convention was sanctioned but
never materialized, and the two local references disagreed on the path.

Upstream (mattpocock/skills `domain-modeling`) defines the file precisely: root-level,
created lazily when the first term is resolved, `CONTEXT-MAP.md` for multi-context repos,
and one hard rule — **"glossary and nothing else"**: no implementation details, no spec, no
scratchpad. The operator asked whether CONTEXT.md could additionally serve as a loading
surface for the fleet's large context (selfco wiki, bead environment, repo state).

## Decision

1. **Root `CONTEXT.md`, Pocock format** (Language / Relationships / Flagged ambiguities;
   canonical term + _Avoid_ list), created lazily per repo. `/grill-with-docs` re-pointed
   from `domain-knowledge/CONTEXT.md` to root. Core is seeded now with ratified fleet
   terms; other repos grow theirs the first time a grill resolves a term.
2. **One bounded extension:** a term entry MAY carry a single `→ deeper:` pointer to the
   page holding its full treatment (a selfco wiki page, a `domain-knowledge/` file, an ADR
   slug). A glossary entry with a citation is still a glossary entry. This is how the file
   bridges to the fleet's deep context without absorbing it.
3. **The loader-manifest role is rejected for CONTEXT.md.** Deciding *what context to load
   when* is CLAUDE.md's job under the Layer 0/1/2 routing of
   adr:claude-md-loading-discipline. Bead state, tracking, and repo status never enter
   CONTEXT.md. This is exactly the upstream's one hard rule, kept on purpose: the file
   stays cheap enough to read at every `/wait-what` and every grill.

## Consequences

- `/wait-what` works fully wherever a CONTEXT.md exists, and degrades to its stated
  fallback (repo CLAUDE.md + `domain-knowledge/`) where one doesn't.
- Glossary drift becomes visible in diffs: terms land one at a time, mid-grill, so a
  CONTEXT.md change in a PR is a domain-model change and reviewable as one.
- The `→ deeper:` pointer gives vault pages a stable inbound edge from code repos without
  making repos depend on the vault's presence (pointers may dangle harmlessly on machines
  without ~/selfco).
- Cost: one more root file per repo, and the discipline of keeping it pure — the named
  failure mode is CONTEXT.md quietly becoming a second CLAUDE.md. `/skill-audit` and PR
  review should flag any non-glossary content landing there.
