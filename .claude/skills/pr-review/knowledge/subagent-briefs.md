Reference for `/pr-review` Step 3: the full sub-agent briefs (Standards + Spec), the knowledge-file contract, and the degraded-mode rule.

**Degraded mode:** (If the Agent tool is unavailable — subagent context, headless CI — degrade to two strictly separated runs with the same self-contained briefs, e.g. sequential `claude -p` invocations; never collapse the axes into one merged pass.)

Knowledge-file contract: the smell baseline is **pasted in full** into the Standards brief — it is the axis's normative core and must appear complete in-prompt. The other knowledge files (`review-dimensions.md`, `framework-checks.md`) are passed **by path** for the sub-agent to read itself.

**Standards sub-agent** — give it the diff command + commit list, the repo's standards sources (`domain-knowledge/coding-standards.md`, framework checklists), **and the smell baseline from `knowledge/smell-baseline.md` pasted in full** (the sub-agent has no other access to it). Brief: report every documented-standard violation (cite the rule) and any baseline smell (name it, quote the hunk); documented breaches can be hard findings, baseline smells are always judgement calls; repo standards override the baseline; skip anything tooling enforces. Under 400 words. This axis also carries the dimension checklist:

> **Load `knowledge/review-dimensions.md`** for the full checklist per dimension.

**Security (auto-BLOCKED if violated):**
- New routes: auth middleware + ownership checks
- User input: validated before DB or LLM
- Env vars: documented, not logged

**Test coverage:** new code paths tested? Error cases covered? **Code quality:** no `console.log`, no TypeScript `any`, no hardcoded values that should be config. **Documentation:** change reflected in README, ADR, or inline docs? **Framework-specific** (if applicable): detect from CLAUDE.md / domain-knowledge/;
> **Load `knowledge/framework-checks.md`** if the PR touches LangGraph, RAG pipeline, browser extension, or Carbon components.

**Spec sub-agent** — give it the diff command + commit list and the spec path/contents. Brief: report (a) requirements missing or partial; (b) behavior not asked for (scope creep); (c) requirements implemented but apparently wrong. Quote the spec line for each finding; mark each acceptance criterion PASS / FAIL / UNTESTED in a table (the table doesn't count against the word cap). Under 400 words of findings. Skip (with the "no spec available" note) when step 2 found nothing.
