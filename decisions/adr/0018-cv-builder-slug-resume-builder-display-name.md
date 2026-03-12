# ADR-0018: Separate cv-builder repo slug from Resume Builder display name

Date: 2026-03-11
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Commands affected: /gastown, /doc-refactor
Repos affected: core, cv-builder, shell

---

## Context

cv-builder is a GitHub repository whose slug is used in clone URLs, CI environment variables, ADR links, blog article URLs, and external references. The display name "CV Builder" needed to change to "Resume Builder" for two reasons:

1. **Audience clarity:** "CV" is not universally understood outside UK/European contexts. "Resume Builder" is immediately legible to a North American audience, including the TBCoNY hiring context.
2. **Demo track alignment:** Gas Town Sprint 1 landed in cv-builder in the same PR window. The sprint introduced user-facing UI changes, making it the natural moment to update all display surfaces.

Renaming the GitHub repo slug itself would break: clone URLs, CI environment variables referencing `cv-builder`, ADR cross-links, blog article URLs, and any external bookmarks or documentation that references the repo by path.

---

## Decision

Keep the GitHub repo slug `cv-builder` permanently. Update all user-facing and documentation surfaces to use "Resume Builder" as the product name.

Specifically:

- **Repo slug:** stays `cv-builder` — no GitHub rename
- **npm package scope:** changes from `@cv-builder/*` to `@resume-builder/*`
- **All UI display surfaces:** say "Resume Builder" (app switcher label, page titles, marketing copy)
- **Documentation and ADRs:** use "Resume Builder" as the product name; use "cv-builder" only when referring to the GitHub repo slug or a filesystem path (e.g. `/Users/yuri/ojfbot/cv-builder`)
- **CLAUDE.md:** must document the split identity explicitly so contributors are not confused

---

## Identity reference

| Surface | Value |
|---------|-------|
| GitHub repo slug | `cv-builder` |
| Filesystem path | `/Users/yuri/ojfbot/cv-builder` |
| npm scope | `@resume-builder/*` |
| Product display name | Resume Builder |
| Shell app switcher label | Resume Builder |
| ADR / doc product name | Resume Builder |

---

## Consequences

### Gains
- Zero broken links: clone URLs, CI env vars, ADR cross-links, and blog article URLs remain valid indefinitely.
- Display-name migration is a one-PR change confined to UI strings and documentation — no downstream breakage.
- npm scope rename from `@cv-builder/*` to `@resume-builder/*` is a clean break with no legacy consumers outside the monorepo.

### Costs
- Contributors must hold a two-identity mental model: the repo is `cv-builder`; the product is Resume Builder. This split is non-obvious and must be documented wherever contributors first encounter it (CLAUDE.md, domain-knowledge file, this ADR).

### Neutral
- If GitHub ever provides transparent repo redirect (URL alias), the slug could be renamed at low cost. That is the trigger for revisiting this decision.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Rename the GitHub repo slug to `resume-builder` | Breaks clone URLs, CI environment variables, ADR cross-links (`decisions/adr/` paths embed the repo name), and any external documentation or bookmarks. Cost is high; benefit is cosmetic. |
| Keep display name as "CV Builder" | Reduces audience clarity for non-UK/European viewers. The TBCoNY pitch context specifically favours "Resume Builder". Opportunity cost given Gas Town Sprint 1 was already changing UI surfaces. |
| Rename slug and set up GitHub redirect | GitHub redirects are best-effort and break when the new name is claimed by another repo. Not a durable solution. |
