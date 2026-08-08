# Core principles

Reference for `/grill-with-docs`, moved verbatim from SKILL.md: the seven principles the grill runs on.

1. **Ask before you assume.** Every silent assumption is a future bug or rework. Surface them.
2. **Resolve dependencies between decisions.** If decision A determines decision B, walk A first. Don't ask B in a vacuum.
3. **Converge on a shared mental model**, not a long list of facts. The output is a *design concept*, not a transcript.
4. **Update language artifacts in-loop.** New terms go straight into CONTEXT.md / GLOSSARY.md as drafts. Non-obvious decisions get an ADR stub.
5. **Frontier rounds, dependencies never batched.** A round may hold several mutually independent frontier questions (numbered, each with a recommended answer); any question downstream of an open answer waits for the next round. When independence is unclear, one question at a time — batched dependent questions dilute attention and let real ambiguity hide.
6. **Facts are yours to find; decisions are the user's to make.** If a question can be answered by exploring the environment — code, docs, git history, config — look it up instead of asking. Only *decisions* (trade-offs, priorities, intent) go to the user. Never answer a decision question yourself, even when the grill runs inside another skill and the user is slow to respond — an agent answering its own grill has broken the loop.
7. **Nothing is acted on until the user confirms shared understanding.** The grill's output is a proposal. No implementation, no file edits, no scaffolding, no next-skill invocation on the strength of the grill alone — the user's explicit confirmation of the design concept is the gate.
