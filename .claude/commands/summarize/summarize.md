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

---

$ARGUMENTS
