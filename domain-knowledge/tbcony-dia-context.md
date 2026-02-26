# TBCoNY / Dia — AI-Native Product Philosophy

Agent-ready reference extracted from Samir Mody's "From Arc to Dia" talk (TBCoNY CTO).
Source: https://www.youtube.com/watch?v=o4scJaQgnFA

Read this file when: building a portfolio app targeting TBCoNY, designing an AI-native workspace/browser-adjacent product, or deciding how to structure assistant architecture, evals, or security.

---

## Core thesis

Arc was a beloved, human-designed browser — an incremental improvement on existing UX.
Dia is rebuilt from the ground up around AI: the interface itself reasons, acts, remembers, and collaborates.

The browser is an **"internet computer"** — not a tab renderer. For any workspace/assistant product, this framing matters: position the app as "a mini internet computer for [some slice of the user's life]," not just a website with a chat panel.

---

## Five architectural principles for AI-native products

### 1. Assistant-centric architecture

Every feature should be designed as "assistant orchestrating UI + tools," not "UI with an optional assistant."

- At least one workflow must show the AI clearly orchestrating multiple surfaces/steps, not just answering questions.
- Assistant = central organizing primitive, not a support widget.
- Memory: the assistant knows ongoing context and goals across sessions.

Anti-pattern: slapping an LLM chat panel next to static UI = "Act 1.5," not Act 2.

### 2. Tooling for fast iteration — evals and hill climbing

TBCoNY's "Jeba" system (JePA-style) is an internal mechanism for sample-efficient prompt optimization without fine-tuning:

1. Seed with prompts.
2. Run across a task suite, scoring outputs.
3. Keep best variants via selection mechanism.
4. Use another LLM to reflect and mutate prompts (reflective prompt mutation).
5. Repeat → automatic hill climbing over prompt space.

**For portfolio apps — what to build:**
- Prompts and evals as **versioned artifacts** (e.g. JSON with `id`, `description`, `last_score`).
- A small eval set (10–30 synthetic tasks) per skill/feature.
- A "Builder Mode" UI: view current prompt chain, run against test scenarios, see graded outputs, tweak and re-run without redeploying.
- A `skills/` directory with prompt + eval definitions.
- A lightweight nightly hill-climber script that logs scores and suggests candidate prompt changes.

Anti-pattern: "AI playground hidden behind a feature flag" — only engineers can access it, sterile prompts, slow iteration.

### 3. Model behavior as a first-class design discipline

**Definition (Samir's):** Model behavior is "the function that defines, evaluates, and ships the desired behavior of models."

In practice:
- Turning principles into product requirements.
- Turning requirements into prompts and evals.
- Using those to shape the assistant's behavior and personality.

Model behavior is today at the "early web" stage — functional but not yet fully crafted. It will evolve into a specialized, prevalent discipline within product companies.

**TBCoNY formed a Model Behavior Team** staffed by non-engineers (e.g. strategy & ops). One person rewrote all prompts over a weekend, documented the rationale in a Loom, and materially improved quality.

**For portfolio apps — what to build:**
- Treat the assistant's voice, pacing, and failure modes as a design surface, like typography.
- A `behavior/` folder in the repo:
  - `principles.md` — high-level rules for the assistant.
  - `skills/*.json` — structured prompts + evals.
  - `personality.md` — spec for voice, tone, "good vs bad" example answers.
- A UI surface that lets you simulate "changing the behavior team's decisions" and see differences in responses.

### 4. AI security as emergent UX (not just infra)

Prompt injection = a third party can override the LLM's instructions via untrusted content (summarize a page, and hidden instructions exfiltrate data or execute actions).

Dia sits in a **lethal trifecta**:
- Access to private data (browser context).
- Exposure to untrusted content (the web).
- Ability to act externally (open pages, send emails, schedule events).

**Mitigation layers used by TBCoNY:**
1. Tag and scope untrusted content — wrap in explicit tags, instruct the model to treat them as lower-authority. (Noted: "easily escapable" by sophisticated attackers.)
2. System/user role separation — operating instructions in system role, user-provided content in lower-authority role.
3. Randomized tags + additional wrapping around user content.
4. **UX-level confirmations** — before any high-impact action (form submit, scheduling), show the data in plain text and require explicit user confirmation.

**For portfolio apps — what to build:**
- Never call tools blindly. Any "dangerous" action (writing to disk, hitting external API, sending anything) must:
  - Display a human-readable diff/summary: "Here's what I'm about to do…"
  - Require explicit confirmation.
- Architecture docs should explicitly call out:
  - Trusted vs untrusted input separation in prompts.
  - Where role separation is used.
  - How the UI surfaces safety (e.g., a "Security" panel showing which context is third-party).

### 5. Cultural storytelling in docs / README

Samir's close: building Dia required a company-wide shift — new tools, new disciplines (model behavior, AI security), everyone engaging with AI as a core medium.

"When you recognize a technology shift, you have to embrace it with conviction, not timidly."

**For portfolio apps:**
- Write the README like an internal AI engineer talk: what you learned, how you iterated, what "good" looks like in this system.
- Explicitly document: how the assistant is central, how you support iteration, how you treat behavior as a craft, how you handle safety.
- It's better to build a **smaller, deeply AI-native workflow** (assistant + tools + evals + security + behavior design) than a large app with thin AI sugar.

---

## Checklist for a TBCoNY-aligned portfolio project

| Dimension | Signal |
|-----------|--------|
| Assistant-centricity | At least one orchestration flow: assistant drives multi-step UI |
| Iteration tooling | Builder Mode or eval runner; prompts as versioned JSON artifacts |
| Model behavior | `behavior/principles.md`, per-skill behavior specs, tone guide |
| Security | Role separation in prompts; UX confirmations for high-impact actions |
| Cultural storytelling | README frames the app as an "internet computer" for a specific workflow |

---

## Language to use (TBCoNY-native framing)

- "internet computer" — not just a website; the AI is the OS
- "model behavior" — the discipline, not just "prompts"
- "hill climbing" — continuous eval-driven improvement
- "lethal trifecta" — private data + untrusted content + external actions = security surface
- "Act 2" — genuine AI-native rebuild, not incremental improvement
