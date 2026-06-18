---
name: summarize
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "summarize", "what does X
  do", "explain this file", "give me an overview of", "TL;DR this". Summarize a file,
  module, or pasted text. Use --style=brief (default, 2-4 sentences) or --style=detailed
  (full breakdown with types, patterns, concerns).
---

Summarize the following code or document.

Focus on: purpose, key responsibilities, important functions/types/interfaces, notable patterns, and any concerns worth flagging.

**Tier:** 1 — Direct analysis
**Phase:** Any time you need to understand code quickly

## Steps

- If a file path is provided: read and summarize that file.
- If text is provided directly: summarize it.
- If `--style=brief` (default): give a 2-4 sentence summary covering purpose and key points.
- If `--style=detailed`: give a thorough breakdown covering all major types, functions, patterns, dependencies, and concerns.

> **If the file is a domain-knowledge/ file, a CLAUDE.md, or an architecture doc, summarize the key decisions and constraints — not just the structure.**

## Gotchas

- **A summary that lists every function is a table of contents, not a summary.** The default failure is paraphrasing the file top-to-bottom at uniform weight. A real summary is lossy on purpose — say what the thing is *for* and what matters, and let the trivial getters/re-exports fall away. If your output is as long as skimming the file, you didn't summarize it.
- **`--style=brief` is a hard 2–4 sentence budget, not a suggestion.** The pull toward "brief but thorough" defeats the mode the user picked. If you can't fit it in four sentences, that's a signal to summarize harder, not to overflow — offer `--style=detailed` instead of quietly expanding.
- **Don't invent purpose you can't see.** For a file with no comments or obvious entry point, inferring "this probably handles auth" from a filename is a guess dressed as a summary. State what the code demonstrably does; flag the intent as inferred when you're reading tea leaves.
- **For docs, the structure is not the content.** Summarizing a CLAUDE.md or ADR by its heading list misses the job — the callout above is load-bearing: extract the decisions and constraints a reader must obey, not the section titles they could already see in the outline.

---

$ARGUMENTS
