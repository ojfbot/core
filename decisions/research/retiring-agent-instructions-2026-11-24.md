---
type: research
ticket: "How do other teams retire standing agent instructions?"
map: decisions/wayfinder/staleness-and-retirement.md
date: 2026-11-24
scope: "Rules files, hooks, skills and tool catalogues, agent memory. Not retrieval stores or wikis (next ticket)."
sources_read: 15 pages from 13 publishers, all read 2026-11-24
---

# How other teams retire standing agent instructions

One research cycle, 2026-11-24. I read each source cited here on that date. Nothing is
cited from memory. This file recommends nothing. It ends with options the evidence makes
available, each tied to its sources.

**Grades.** **M** = measured (the source reports data or a described experiment).
**A** = asserted (the source claims it without data). **D** = documented behaviour (a
product's own documentation says the product does it). Product behaviour changes fast.
Every D finding is as of the date read.

**One word used here.** *Demote* means a description of what the sources do, not a new
term for this map: the item stays installed but stops loading in full on every turn.

## 1. Table

| # | Mechanism | Who proposes | Who approves | Signal used | Grade | Source |
|---|---|---|---|---|---|---|
| 1 | Expiry unless reinforced (memory) | The system clock | No one. Admins set the period (7–180 days) | Time since the agent last validated ("upvoted") the item | D | [S1], [S3] |
| 2 | Check citations at read time; store a corrected item | The agent using the item | No one | The item contradicts the code it cites, or the citation points nowhere | M (adversarial seeding; A/B on memory overall) | [S2] |
| 3 | Downvote past a threshold, then delete after disuse | The agent | No one | Repeated failed validation | D | [S1] |
| 4 | Hard load cap: content past the cap is not loaded | The harness, mechanically | No one | Size (lines, bytes, characters) | D | [S4], [S9b] |
| 5 | Near-cap reminder: the model shrinks its own index | Harness prompts; model edits | No one | Size of the memory index | D | [S4] |
| 6 | Skill listing budget: drop descriptions of least-used skills first | The harness | No one | Listing size against 1% of context; invocation frequency | D | [S5] |
| 7 | Size targets and length warnings for rules files | Docs; startup warning | The person who edits the file | Lines per file; combined size at start | D (warning), A (adherence claim) | [S4], [S10] |
| 8 | Periodic human review; fix the rule after a mistake | A person | A person | Contradiction; outdatedness; a mistake seen after the fact | A | [S4], [S10] |
| 9 | Model-run audit that proposes edits as a report or diff | The model, on request | The person; nothing in the files changes until they ask | Dead file or command references; contradictions; text written for older models; content derivable from the code | D | [S4], [S5] |
| 10 | Usage-and-cost report on skills, plugins, MCP servers, hooks | The tool | The person turns items off | Never invoked; not used recently; context cost; hook slowness | D | [S5] |
| 11 | Demote instead of remove: defer tools, list a skill by name only, scope a rule to paths | The developer or user | The same person | Token cost; frequency (keep the 3–5 most used tools loaded) | M (vendor internal eval) + D | [S6], [S7], [S5], [S4] |
| 12 | Background consolidation ("dreaming", "sleep-time") | A background agent | No one by default; optionally a second agent. Never the user in Letta's option | Recent transcripts; duplication; drift | M (case studies, small n) + D | [S8], [S9] |
| 13 | LLM picks DELETE when new information contradicts a stored item; graph variant marks it invalid instead | The model at write time | No one | Contradiction with a new fact | M (system level, not delete alone) | [S12] |
| 14 | Incremental curation with helpful/harmful counters and duplicate pruning | A curator model | No one | Per-item helpful/harmful counts; embedding similarity | M | [S14] |
| 15 | User deletes or asks the assistant to forget | The user | The user | Whatever the user notices | D | [S11] |

## 2. Removal: what mechanisms exist

Published mechanisms fall into five groups.

- **Time.** Only agent memory has expiry. GitHub Copilot Memory deletes a stored fact
  after a period without reinforcement. Today's default is 90 days. Organisation and
  enterprise owners can set 7 to 180 days for repository facts, and the lower setting
  wins. Retrieving an item does not reset the clock. Only an upvote does. [S1] (D). No
  source puts an expiry on a rules file, hook or skill.
- **Size.** Several products cap what loads and drop the rest. Claude Code loads the first
  200 lines or 25 KB of the memory index and drops content past that. It warns the model
  near the cap and tells it to "merge or drop stale entries". It also returns an error
  past the cap. [S4] (D). On-demand rules files over a per-file limit load only their
  start [S4] (D). Letta memory blocks carry a character limit [S9b] (D). The Claude Code
  skill listing has a budget of 1% of the context window. Past it, the descriptions of
  the least-invoked skills are dropped first [S5] (D). For always-loaded rules files the
  caps are advice, not enforcement: under 200 lines per `CLAUDE.md` [S4], under 500 lines
  per Cursor rule [S10] (both D as guidance).
- **Review.** Two vendors tell people to review rules files and remove outdated or
  conflicting instructions [S4], or to update a rule when the agent makes a mistake [S10]
  (A). Claude Code ships a model-run audit, `/doctor prompt-audit`. It reports dead
  references, contradictions and text written for older models, and proposes edits. It
  covers `CLAUDE.md`, `AGENTS.md`, rules, skills, commands, subagents and output styles
  [S4] (D). The `/doctor` checkup also proposes trims of `CLAUDE.md` content Claude could
  derive from the code. It offers to move always-loaded guidance into skills or nested
  files that load on demand [S5] (D).
- **Usage.** `/skill-doctor` reports each skill's context cost and how often it was used.
  It flags skills never invoked and says where to turn them off [S5] (D). `/doctor` lists
  unused skills, MCP servers and plugins against their context cost, and slow hooks [S5]
  (D). These reports rely on the product's own usage record.
- **Model judgment.** Memory systems let a model delete or rewrite. Copilot agents
  downvote items that fail validation. Items past a threshold stop being used and are
  deleted after disuse [S1] (D). Mem0's model chooses ADD, UPDATE, DELETE or NOOP for
  each new fact. Its graph variant marks contradicted relations invalid rather than
  deleting them [S12] (M). Letta's background "dreaming" subagents consolidate memory
  after a set number of steps or at compaction. A wider reorganisation backs up the
  memory repository first, and memory is Git-backed [S9] (D). Anthropic describes
  dreaming that checks notes against the session transcripts and rewrites wrong ones
  [S8] (M). ACE grows a context item by item and prunes duplicates by embedding
  similarity [S14] (M).

**Demotion is common; removal is rarer.** Several mechanisms shrink what loads without
removing the item: deferred tool loading [S6], name-only skill listings and
`disable-model-invocation` [S5], path-scoped rules [S4]. For tools, Anthropic advises
keeping the 3 to 5 most-used tools loaded and deferring the rest [S6] (D).

## 3. Authority: who proposes, who approves

- **Memory: the agent decides, and no person approves.** This holds for Copilot Memory
  [S1], Mem0 [S12], ACE [S14] and Letta dreaming [S9]. Letta's "Agent reviews before
  applying" option adds a second model pass. Its docs say this option does not ask the
  user [S9] (D). Copilot's cloud agent and code review do not ask approval to *store* a
  memory; the Copilot app and CLI can ask [S1] (D). No source describes a person
  approving a memory *deletion* before it happens.
- **People keep manual deletion rights, set by permissions.** In Copilot, users with
  write access can delete repository facts. Organisation and enterprise owners can export
  or delete members' preferences, in bulk or per user [S1] (D). ChatGPT users delete
  items or ask it to forget [S11] (D).
- **Rules files and skills: a person decides.** Every rules-file and skills mechanism
  found leaves the final change to a person. The model or tool only proposes: the audit
  [S4], the `/doctor` checkup ("asks for confirmation before changing anything") [S5],
  and `/skill-doctor` [S5]. Cursor lets a user tag its agent on an issue or pull request
  to update a rule [S10] (D). That puts the change into ordinary code review, but the docs
  say no more about approval.
- **Mechanical caps: no one decides.** Truncation at a load cap [S4] and dropped skill
  descriptions [S5] happen with no proposer and no approver. Claude Code writes a warning
  to the debug log when the skill listing overflows [S5] (D).
- **GitHub's stated split.** Copilot's docs place durable rules in human-maintained
  custom instructions, and accumulated detail in agent-curated memory. The docs add that
  neither one guarantees a rule is followed [S1] (D).

## 4. Signal: what triggers a removal

| Signal | Mechanisms | Needs a usage ledger? |
|---|---|---|
| Size or token cost | 4, 5, 6, 7, 11 | No. Size can be measured on the file. |
| Content check: dead references, contradictions between files, outdated model-specific text, content derivable from code | 9 | No |
| Contradiction with evidence at read time (citations) | 2, 3 | No. Validation outcomes then act as a ledger for 1 and 3. |
| Contradiction with a new fact at write time | 13 | No |
| Replay against transcripts | 12 | No, but it needs transcripts kept |
| Age since last reinforcement | 1 | Yes, in effect: the upvote record is the ledger |
| Invocation count, recency | 6, 10 | Yes (the product's own) |
| Helpful/harmful counters | 14 | Yes, per item |
| A mistake seen after the fact | 8 | No, but a person must notice |
| Hook latency | 10 | Needs timing data, not use data |

The census found no usage ledger for rules files, hooks or memory here. Six signals in
published practice work without one: size, content checks, read-time contradiction,
write-time contradiction, transcript replay and mistakes noticed by a person. For
always-loaded rules files, no source offers a way to tell which rules were *used* in a
session. The vendors' own usage reports cover skills, plugins and MCP servers, not rules
lines [S5].

## 5. Cost and harm

**Cost of not removing.**
- **Instruction count.** IFScale gave 20 models 10 to 500 simultaneous instructions. The
  best reached about 68% adherence at 500. The top reasoning models held near-perfect
  adherence through about 150 instructions, then declined. Others declined linearly or
  fell fast to a 7–15% floor. Bias towards earlier instructions peaked around 150–200
  instructions [S13] (M). Caveat: each instruction asked for one keyword in a report.
  That is a simple proxy, not agent behaviour.
- **Tool count.** Anthropic's docs say tool selection "degrades once you exceed 30–50
  available tools" [S6] (A in the docs). Its engineering post reports internal MCP evals
  with deferred loading: Opus 4 rose from 49% to 74%, Opus 4.5 from 79.5% to 88.1%. It
  also reports tool definitions using 134K tokens before optimisation [S7] (M, vendor
  internal, method not published).
- **Memory pile-up.** In one Pokémon run each, a model that saved everything wrote 413
  memory files in 225 folders and earned one badge. A later model wrote nine files and
  earned four. At one point the first model spent 17 steps creating and deleting memory
  files and took no game action [S8] (M, n = 1 per model).
- **Contradiction.** Claude Code's docs say that when two instructions conflict, Claude
  may follow either one at random, and that longer files reduce adherence [S4] (A).
- **A standing rule can itself hurt.** Telling strong models to "record only failures"
  in memory removed much of the gain memory gave them [S8] (M). This is the cost of one
  instruction, not of pile-up.

**Removals that went wrong.**
- **Rewriting collapses context.** In ACE's AppWorld case study, a model told to rewrite
  the whole context at each step shrank it from 18,282 tokens to 122 in one step.
  Accuracy fell from 66.7 to 57.1, below the 63.7 baseline with no adaptation [S14] (M).
  The authors also name "brevity bias", the drift of optimised prompts towards short,
  generic text [S14].
- **Silent truncation.** Past a load cap, Claude Code drops content on the next load
  [S4]. When the skill listing overflows, dropped descriptions take with them the keywords
  Claude needs to match a request [S5] (D). Neither is a decision. Both remove
  instructions.
- **Removal that is not complete.** Copilot hides memories it learned not to use, but they
  can stay stored until expiry, so "disappearing from the list does not necessarily mean"
  deletion [S1] (D). In ChatGPT, deleting a chat does not delete a memory made from it.
  Deleting a memory does not remove mentions in past chats, and deletion takes time to
  propagate [S11] (D).
- **No incident reports found.** I found no published account of a team removing a rule,
  hook or skill and the agent then failing.

**Cost of removing.** GitHub says it rejected an offline curation service. It names
engineering complexity and LLM cost at its scale, plus the need to reconcile at read time
anyway [S2] (A). Letta says its agent-review option costs more model tokens [S9] (D).
GitHub reports that citation checks added little latency in its tests [S2] (A).

**Benefit when stale items are handled.** GitHub seeded repositories with false memories.
Agents found the contradictions and stored corrections in every test case [S2] (M, counts
not given). Its A/B tests compared memory on and off, not with and without expiry or
correction. Coding agent merge rate was 90% against 83%; code review positive feedback
was 77% against 75% [S2] (M). In Anthropic's Pokémon case, dreaming fixed a wrong
location note, and the run with the fixed note got further [S8] (M, one case).

## 6. Gaps: where published practice says nothing

- **Hooks.** No source describes retiring a hook. The only signal found is slowness, in
  `/doctor` [S5].
- **Measured effect of pruning a rules file.** No study removes rules from a `CLAUDE.md`
  or `AGENTS.md` and measures behaviour before and after. The size targets (200 lines,
  500 lines) come with no data [S4], [S10].
- **Usage of individual rules.** No method to learn which always-loaded rule a session
  relied on.
- **Approval for removal in a team.** No source gives a separate approval path for
  *removing* an instruction, or asks whether removal should pass the same gate as
  adding one.
- **Expiry on rules, skills or hooks.** Only memory expires.
- **What happens to a retired rule or skill.** No retirement marker or archive convention
  for rules or skills. The nearest are the Mem0 graph variant (mark invalid) [S12], Letta's
  Git-backed memory and backups [S9], and Claude Code's `.trash/` folder for synced skills
  that an organisation turned off [S5].
- **Incident write-ups** of harmful removals (see §5).

## 7. Disagreements

- **Copilot's expiry period.** The January 2026 changelog says memories expire after 28
  days [S3]. The current docs say 90 days by default, configurable from 7 to 180 [S1].
  This looks like a change over time, not a conflict between teams.
- **What resets Copilot's clock.** GitHub's engineering post says the agent stores a
  validated memory again "to refresh its timestamp", and that sessions retrieve the most
  recent memories [S2]. The current docs say only an upvote resets expiry. Retrieval
  does not, and upvoted memories are more likely to be sent [S1].
- **Offline curation or read-time checks.** GitHub chose read-time verification over an
  offline curator [S2]. Letta [S9] and Anthropic [S8] run background consolidation.
  Each side gives reasons. None compares the two.
- **Whole-file rewrites.** Letta's reorganise workflow and Claude Code's error asking for a
  rewrite of the index both ask a model to restructure memory as a whole [S9], [S4]. ACE measured
  collapse under monolithic rewriting and argues for incremental edits [S14]. ACE's
  setting was a task context rewritten every step, not a memory index rewritten now and
  then. The two may not conflict.
- **Fixed rules or model judgment.** Anthropic found fixed memory-writing rules weakened
  strong models and advises giving the purpose, not the method [S8]. Vendor docs give
  fixed size targets for rules files [S4], [S10]. The two cover different things, so this
  is a tension rather than a direct contradiction.
- **Size targets differ.** 200 lines per `CLAUDE.md` [S4] against 500 lines per Cursor
  rule [S10]. Neither gives data.

## 8. Not found

- Any retirement mechanism for hooks beyond a slowness report.
- Any measured before-and-after study of pruning rules files.
- Any way to measure per-rule use in always-loaded files.
- Any approval workflow specific to removal, or any source that weighs removal against
  the gate for adding.
- Expiry dates on rules files, skills or hooks.
- Archive or tombstone conventions for retired rules or skills.
- Published incident reports of a removal that went wrong in production.
- Whether ChatGPT's "automatic prioritization" [S11] removes or demotes anything. The
  help page names it but does not describe it.

## 9. Options the evidence makes available

No recommendation. Each option is tied to the sources that show it in use.

- Expire items that are not re-validated within a set period; admin-set period [S1], [S3].
- Attach evidence (citations) to items and check them at read time; the agent rewrites
  failures [S1], [S2].
- Cap what loads, mechanically, and make the cap visible to the model so it trims
  [S4], [S9b], [S5].
- Model-run audit that proposes removals as a report or diff, applied only by a person
  [S4], [S5].
- Usage-and-cost report per item, with a person turning items off [S5].
- Demote before removing: defer, list by name only, scope to paths [S4], [S5], [S6], [S7].
- Background consolidation against transcripts, with or without a second-model review
  [S8], [S9].
- Contradiction-triggered delete at write time, or mark-invalid instead of delete [S12].
- Incremental curation with per-item helpful/harmful counters; avoid whole-file rewrites
  [S14].
- Periodic human review, or update a rule when a mistake is seen [S4], [S10].

## 10. Sources

All read 2026-11-24.

| Ref | Title | URL | Kind |
|---|---|---|---|
| S1 | About GitHub Copilot Memory (GitHub Docs) | https://docs.github.com/en/copilot/concepts/agents/copilot-memory | Vendor docs |
| S2 | Building an agentic memory system for GitHub Copilot (GitHub Blog; 2026-01-15, updated 2026-11-12) | https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/ | Engineering write-up by the team |
| S3 | Agentic memory for GitHub Copilot is in public preview (GitHub Changelog, 2026-01-15) | https://github.blog/changelog/2026-01-15-agentic-memory-for-github-copilot-is-in-public-preview/ | Vendor changelog |
| S4 | How Claude remembers your project (Claude Code docs, memory) | https://code.claude.com/docs/en/memory.md | Vendor docs |
| S5 | Extend Claude with skills (Claude Code docs, skills) | https://code.claude.com/docs/en/skills.md | Vendor docs |
| S6 | Tool search tool (Claude Platform docs) | https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool.md | Vendor docs |
| S7 | Introducing advanced tool use for Claude (Anthropic Engineering, 2025-11-24) | https://www.anthropic.com/engineering/advanced-tool-use | Engineering write-up by the team |
| S8 | The components of agent memory (Anthropic Engineering, 2026-11-06) | https://www.anthropic.com/engineering/components-of-agent-memory | Engineering write-up by the team |
| S9 | Memory & dreaming (Letta Docs) | https://docs.letta.com/configuration/memory | Vendor docs |
| S9b | Memory blocks (core memory) (Letta Docs, v1 SDK) | https://docs.letta.com/v1-sdk/memory/memory-blocks/ | Vendor docs |
| S10 | Rules (Cursor Docs) | https://cursor.com/docs/context/rules | Vendor docs |
| S11 | Memory in ChatGPT (OpenAI Help Center) | https://help.openai.com/en/articles/8590148-memory-faq | Vendor docs |
| S12 | Chhikara et al., Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory (arXiv 2504.19413v1) | https://arxiv.org/html/2504.19413v1 | Paper |
| S13 | Jaroslawicz et al., How Many Instructions Can LLMs Follow at Once? (arXiv 2507.11538v1; NeurIPS 2025) | https://arxiv.org/html/2507.11538v1 | Paper |
| S14 | Zhang et al., Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models (arXiv 2510.04618v2; ICLR 2026) | https://arxiv.org/html/2510.04618v2 | Paper |

**Read but not cited.** Chroma, "Context Rot" (https://research.trychroma.com/context-rot).
It measures long inputs in general, not standing instructions, so I left it out.
A Letta sleep-time docs URL from search results returned 404.

**Method.** Generic web searches (no fleet names). Pages fetched with `curl`, turned into
plain text and searched by keyword. I read the passages cited, not every page end to
end. Quotes are kept to one short passage per source at most.
