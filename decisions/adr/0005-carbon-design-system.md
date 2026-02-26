# ADR-0005: IBM Carbon Design System for sub-app UI components

Date: 2026-01
Status: Accepted
OKR: 2026-Q1 / O1 / KR2
Commands affected: /validate, /scaffold-app
Repos affected: cv-builder, blogengine, tripplanner, shell

---

## Context

The Frame OS sub-apps need a shared UI component library that provides consistent visual language, accessible components out of the box, and enough design structure to let the engineering focus stay on AI interactions rather than rolling custom components. The choice also signals design discipline to a portfolio audience.

## Decision

Use IBM Carbon Design System (`@carbon/react`) for all sub-apps. Carbon provides the component primitive layer. Custom CSS handles layout and interaction patterns specific to each sub-app.

## Consequences

### Gains
- Accessible components out of the box — keyboard navigation, ARIA roles, screen reader support are handled by Carbon.
- Consistent typographic scale, spacing tokens, and color system across apps without a custom design token infrastructure.
- Carbon's component API is stable and well-documented; onboarding to a new sub-app is predictable.
- The `/scaffold-app langgraph-app` template includes Carbon wiring by default.

### Costs
- Carbon has a strong visual identity (IBM's). Frame sub-apps will look "Carbon-like" unless custom styling is applied on top.
- The visual craft gap in the portfolio (identified in the TBCoNY gap analysis) is partly a Carbon side-effect — the shell chrome and at least one sub-app surface needs deliberate premium visual treatment to show design authorship beyond "Carbon defaults."
- Bundle size: Carbon components are not tree-shaken by default in all configurations. Requires explicit import style (`import { Button } from '@carbon/react'`, not barrel imports).

### Neutral
- Carbon is an IBM product; there is no alignment between Frame's product direction and IBM's. This is a pure tooling choice.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Tailwind CSS + shadcn/ui | More flexible but less opinionated. Would require more upfront design decisions. Good for bespoke craft; premature for the current build pace. |
| Material UI | Over-represented in portfolios. Google visual identity is harder to override than Carbon. |
| Custom component library | Not justified at current scale. Would be pure overhead with no return. |
| Radix UI primitives only | Headless only — still requires full styling decisions for every component. Deferred until a dedicated design pass. |
