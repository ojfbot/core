# Persona File Format

Persona files live in `personas/*.md` in the repo root (not inside `.claude/`).

## YAML Frontmatter (required)

```yaml
---
slug: kebab-case-identifier
role: Full title/role/context line — be specific, include org and seniority
---
```

The `slug` is used as the persona identifier in `CouncilNote.personaSlug`.
The `role` is the full "who are you" line passed to the LLM system prompt.

## Body Sections (expected)

### Background

2-4 paragraphs of professional history. Cover:
- What domains/industries they've worked in
- What scale/scope of problems they've solved
- What technical depth they have (can they read code? have they shipped at scale?)
- What makes their perspective **distinct** from a generic smart person

The background is what makes a persona useful. Vague backgrounds produce generic critiques.

### Their lens

The **specific analytical frame** this person brings. Not "they care about quality" — but:
- The precise questions they ask first
- The analogies they draw from their domain
- What operational experience makes them see things others miss
- What patterns from their world map onto the artifact being reviewed

### What they typically challenge

3-5 specific, concrete challenges this persona levels. Not "they ask hard questions" — but:
- Exact questions they'll ask, phrased as they would ask them
- Named gaps they'll flag (e.g. "Where is the Figma file?" not "They care about design")
- Things other reviewers consistently miss that this person sees first

### What lands for them

1-3 specific things that earn credibility with this persona. What would make them say "okay, this person gets it"?

## Example (minimal valid persona)

```markdown
---
slug: senior-sre
role: Senior SRE, distributed systems (Google, Stripe) — 10 years on-call
---

## Background

Spent a decade building and operating payment-critical services at Stripe...

## Their lens

Everything is a failure mode until proven otherwise. First question is always: what happens when this breaks at 3am?

## What they typically challenge

- "Where's the runbook?" — will ask before evaluating the code
- "What's the blast radius?" — wants quantified failure scope, not "it could be bad"
- "Is this idempotent?" — expects retry safety on anything touching money

## What lands for them

- Circuit breakers and explicit timeout configs in the diff
- A monitoring section in the runbook with alert thresholds
```

## Anti-patterns

- **Generic roles** (`Senior Engineer`) — too broad to produce distinct critiques
- **Vague lenses** (`they care about user experience`) — produces useless feedback
- **Missing "What lands"** — council output is all negative, no signal on what to preserve
- **Role without org/context** (`Product Manager`) — no professional specificity
