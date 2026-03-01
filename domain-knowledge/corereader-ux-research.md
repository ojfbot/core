# CoreReader — UX Research Brief

Read this before scaffolding `core-reader`. Derived from cross-app pattern analysis
(cv-builder, blogengine, tripplanner) and TBCoNY/Dia product philosophy.

---

## What CoreReader exposes

CoreReader surfaces the `core` repo's own intelligence artifacts — the files that
define how Frame OS's AI behaves, decides, and ships. It is **the control panel for
Frame OS's own intelligence**.

| Surface | Source path | Phase |
|---------|-------------|-------|
| Commands | `.claude/commands/<name>/` | 1 |
| ADRs | `decisions/adr/` | 1 |
| OKRs | `decisions/okr/` | 2 |
| Roadmap | `domain-knowledge/frame-os-context.md` roadmap table | 2 |
| Docs | `domain-knowledge/*.md` | 2 |
| Mutations (ADRs, commands) | git worktree staging | 3 |
| Chat agent | CoreReaderDomainAgent via frame-agent | 4 |

Phase 1 deliberately limits scope to the two highest-signal surfaces for the TBCoNY
demo: Commands (shows the AI's behavioral instructions) and ADRs (shows the
architectural decisions that govern the system). These two surfaces, rendered well,
demonstrate the "internet computer" framing without any chat at all.

---

## Information architecture — tab structure

### Phase 1

```
┌─────────────────────────────────────────────────────────────────┐
│  Commands  │  ADRs                                              │
│  ──────────                                                      │
│  (Carbon ContentSwitcher — same pattern as all Frame sub-apps)  │
└─────────────────────────────────────────────────────────────────┘
```

**Commands tab**

A searchable, filterable directory of the ~30 slash commands.
Each command is a card with expand-in-place markdown rendering.

- Filter bar: `[Tier ▾] [Phase ▾] [Search]`
- Card list: command name + tier badge (1/2/3) + phase tag + one-line description
- Expanded card: full `<name>.md` rendered as markdown + knowledge file count
- No mutations — read-only

Tier metadata comes from the command's own `.md` frontmatter/header (the table in
CLAUDE.md `## Available slash commands` is the canonical source for now; Phase 2 can
parse it automatically).

**ADRs tab**

A browser for `decisions/adr/*.md`. Three lens views (TripPlanner pattern — same data,
different perspectives):

- `All` — flat list ordered by ADR number descending
- `By Status` — grouped sections: Accepted / Proposed / Superseded
- `By Repo` — grouped by repos-affected (shell, cv-builder, core, etc.)

Card: ADR number + title + status tag + date.
Expanded card: full ADR markdown + `Repos affected` tag pills + `Commands affected`
tag pills. Tags are **cross-linked** — clicking a command name in "Commands affected"
jumps to that command in the Commands tab.

**CondensedChat — present but staged**

A minimal chat input in the footer of both tabs reads:
> "Ask about the codebase — available in Phase 4"

The input is visible but disabled with a clear affordance. This is the TBCoNY
"assistant-centric" principle applied to Phase 1: the AI's entry point is on-screen
even before it's wired, so the UI doesn't feel like a static doc browser.

If the chat can be wired to frame-agent even in Phase 1 (read-only queries only —
no mutations), that should be done. "What does ADR-0007 mean for TripPlanner?" is
immediately valuable and demonstrates the single-gateway architecture.

### Phase 2 — add three tabs

```
│  Commands  │  ADRs  │  OKRs  │  Roadmap  │  Docs  │
```

- **OKRs** — Current cycle objectives + KR list. Status tag per KR (Done / In progress /
  Not started). Progress bar per objective. Source: `decisions/okr/`.
- **Roadmap** — Phase table from frame-os-context.md. Status column with colored tags.
  Visual: a horizontal phase timeline (Carbon ProgressIndicator or custom stepped flow).
- **Docs** — File tree sidebar (domain-knowledge/ files) + markdown viewer panel.
  Searchable. This is the "Library tab" pattern from blogengine.

### Phase 3 — mutations

All tabs gain an edit affordance for ADRs and commands.
Mutation flow (ADR of Record: ADR-0010 §git-worktree-staging):

1. User clicks Edit on an ADR or command file
2. A CodeMirror or `<textarea>` opens with the raw markdown
3. On Save: `POST /api/mutations/stage` → creates git worktree, writes change, returns
   unified diff
4. Diff panel renders (plain text, no syntax highlighting needed) with "What I'm about
   to do:" label (Dia security principle — UX confirmation for all mutations)
5. User confirms → `POST /api/mutations/commit` → commits in worktree, returns commit SHA
6. A "Push to remote" option appears (future: configurable branch + PR creation)

No mutation ever touches the working tree directly. All writes go through the worktree
staging API.

### Phase 4 — chat agent

CondensedChat footer becomes live. Routes to `CoreReaderDomainAgent` in frame-agent.
Agent has read access to the same filesystem the API parses.

Cmd+K search across all content (commands, ADRs, OKRs, docs) — full-text + semantic.

---

## Component recommendations

| Component | Carbon equivalent | Use |
|-----------|------------------|-----|
| Tab nav | `ContentSwitcher` | Phase 1–4 tab switching |
| Command/ADR list | `StructuredList` or custom cards | Expandable rows |
| Lens view switcher (ADRs) | `ContentSwitcher` (nested) | All / By Status / By Repo |
| Status badges | `Tag` (green/blue/gray) | ADR status, KR status, tier |
| Phase tags | `Tag` (outline) | Command phase grouping |
| Search/filter | `Search` | Commands filter bar |
| Docs file tree | `TreeView` | Phase 2 Docs tab sidebar |
| Roadmap phases | `ProgressIndicator` (stepped) | Phase 2 Roadmap tab |
| Diff view | `CodeSnippet` (multi-line) | Phase 3 mutation confirmation |
| Chat input | `TextInput` + `Button` | CondensedChat footer |
| Markdown render | `react-markdown` + `remark-gfm` | All content rendering |

---

## TBCoNY alignment mapping

| Dia principle | CoreReader implementation |
|---------------|--------------------------|
| **Assistant-centric** | CondensedChat entry point in Phase 1 (even if staged); Phase 4 live agent; AI is a visible presence from day one |
| **Evals / hill-climbing** | Commands tab exposes the prompts that define agent behavior — making them browsable is the first step toward a "Builder Mode" where prompts can be tested and scored |
| **Model behavior as design** | Commands tab = the model's behavioral instructions, rendered as a browsable design surface. When a `behavior/` folder exists, add it as a tab |
| **AI security as UX** | Phase 3 mutations show explicit diff + require confirmation before any write. Never silent. Follows the "display what I'm about to do" principle verbatim |
| **Cultural storytelling** | CoreReader itself is the story: Frame OS has a repo that reads its own architecture, surfaces its own decisions, and lets you edit them through a UI — "the AI manages its own instructions" |

---

## Pull-forward recommendation

**Wire CondensedChat in Phase 1 with read-only frame-agent queries.**

The case for pulling forward:
- A read-only chat query ("What does ADR-0007 say?") requires no mutations, no new
  agent nodes — just `CoreReaderDomainAgent` with a `readFile()` tool and the manifest
- Phase 1 becomes immediately valuable as a demo artifact: you can ask "What's the
  diff between cv-builder and TripPlanner's tool manifest?" and the agent synthesizes
  an answer from the actual ADR files
- Satisfies the TBCoNY "at least one orchestration flow" requirement in Phase 1 alone

If this is accepted, update ADR-0010 to reflect Phase 1 including a minimal
`CoreReaderDomainAgent` (read-only tool: `get_document`).

---

## Scaffold implications

The `/scaffold-app` prompt for CoreReader should specify:

**browser-app components to generate as stubs:**
- `CommandsTab.tsx` — filter bar + command list
- `CommandCard.tsx` — expandable card with markdown render
- `ADRsTab.tsx` — lens view switcher + ADR list
- `ADRCard.tsx` — expandable card with cross-link tags
- `CondensedChat.tsx` — chat footer (disabled state in Phase 1)

**API routes to stub:**
- `GET /api/commands` — scans `.claude/commands/`, returns `{ name, tier, phase, description, knowledgeFiles: string[] }`
- `GET /api/commands/:name` — returns full markdown content
- `GET /api/adrs` — scans `decisions/adr/`, parses frontmatter, returns list
- `GET /api/adrs/:number` — returns full markdown content
- `GET /api/tools` — capability manifest stub (ADR-0007)

**API parsers to scaffold:**
- `parseCommands(coreRepoPath)` — fs.readdirSync `.claude/commands/`, reads `<name>.md`
  header lines for tier/phase metadata
- `parseADRs(coreRepoPath)` — reads `decisions/adr/*.md`, extracts frontmatter fields
  (Status, Date, OKR, Repos affected, Commands affected) via gray-matter

**Not in scope for scaffold:**
- OKR/Roadmap/Docs parsers (Phase 2)
- Mutation API (Phase 3)
- Agent graph (Phase 4)
