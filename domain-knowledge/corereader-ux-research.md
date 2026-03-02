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
| Roadmap | `domain-knowledge/frame-os-context.md` roadmap table | 1 |
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
│  Commands  │  ADRs  │  Roadmap                                  │
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

**Roadmap tab**

The phases table from `frame-os-context.md` rendered as a visual stepped timeline.

- Carbon `ProgressIndicator` (stepped, horizontal) for phase status at a glance
- Phase rows: phase number + what + repo(s) + status tag (Complete / In progress / Not started / Blocked)
- Click a phase row → expand to show associated ADRs and open GitHub issues (cross-links to ADRs tab)
- Source: `GET /api/roadmap` — parsed from frame-os-context.md roadmap table by the API

**CondensedChat — present but staged**

A minimal chat input in the footer of both tabs reads:
> "Ask about the codebase — available in Phase 4"

The input is visible but disabled with a clear affordance. This is the TBCoNY
"assistant-centric" principle applied to Phase 1: the AI's entry point is on-screen
even before it's wired, so the UI doesn't feel like a static doc browser.

If the chat can be wired to frame-agent even in Phase 1 (read-only queries only —
no mutations), that should be done. "What does ADR-0007 mean for TripPlanner?" is
immediately valuable and demonstrates the single-gateway architecture.

### Phase 2 — add two tabs

```
│  Commands  │  ADRs  │  Roadmap  │  OKRs  │  Docs  │
```

- **OKRs** — Current cycle objectives + KR list. Status tag per KR (Done / In progress /
  Not started). Progress bar per objective. Source: `decisions/okr/`.
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

> **Read first:** `domain-knowledge/shell-mf-integration.md` — the canonical reference
> for every MF integration pattern below. CoreReader must follow it exactly to avoid
> the multi-session debugging loop that cv-builder, BlogEngine, and TripPlanner went
> through.

### Shell integration — required from day one

CoreReader must implement these patterns **at scaffold time**, not as a follow-up PR.
All three client apps (cv-builder PR #103, BlogEngine PR #22, TripPlanner PR #13)
added them retroactively — the result was CSS-less remotes, z-index wars, and a11y
regressions. CoreReader scaffolds correctly from the start.

**`vite.config.ts`:**
```typescript
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'
import federation from '@originjs/vite-plugin-federation'

// cssInjectedByJs BEFORE federation
cssInjectedByJs({
  jsAssetsFilterFunction: ({ fileName }) =>
    fileName.includes('__federation_expose_Dashboard') ||
    fileName.includes('__federation_expose_Settings'),
}),
federation({
  name: 'core_reader',
  filename: 'remoteEntry.js',
  exposes: { './Dashboard': './src/components/Dashboard' },
  shared: {
    react: { singleton: true, requiredVersion: false },
    'react-dom': { singleton: true, requiredVersion: false },
    '@carbon/react': { singleton: true, requiredVersion: false },
  },
}),
```

**`Dashboard.tsx` — always export with double-Provider + `shellMode` prop:**
```tsx
interface DashboardProps { shellMode?: boolean }

function DashboardContent({ shellMode }: DashboardProps) {
  // suppress heading in shell: {!shellMode && <Heading>CoreReader</Heading>}
  // add CSS classes: ['dashboard-wrapper', shellMode && 'shell-mode'].filter(Boolean)
}

function Dashboard({ shellMode }: DashboardProps) {
  return <Provider store={store}><DashboardContent shellMode={shellMode} /></Provider>
}
export default Dashboard
```

**`ThreadSidebar.tsx` — `inert` wrapper from day one:**
```tsx
<div {...(!isExpanded ? { inert: '' } : {})}>
  <div className={`thread-sidebar ${isExpanded ? 'expanded' : ''}`}>
    ...
  </div>
</div>
```

**`Dashboard.css` — shell-mode block (copy verbatim from shell-mf-integration.md):**
- `.dashboard-wrapper.shell-mode { margin-top: 4.5rem; }`
- `.dashboard-wrapper.with-sidebar { margin-right: calc(320px + 2rem); }`
- `.dashboard-wrapper.shell-mode .cds--tabs { flex-shrink: 0; flex-direction: column; }`
- `.dashboard-wrapper.shell-mode .cds--tab-panels { flex: 1; min-height: 0; overflow: hidden; }`
- `.dashboard-wrapper.shell-mode .cds--tab-content { max-height: none; height: 100%; overflow-y: auto; }`
- `.dashboard-wrapper .cds--tabs--contained .cds--tab--list { display: flex; background-color: var(--cds-layer-accent-01, #393939); }`
- `.dashboard-wrapper .cds--tabs--contained .cds--tabs__nav-item { flex: 1 0 auto; }`

**`CondensedChat.css` — positioning formulas:**
- `right: calc(72px - 1rem)` (no sidebar)
- `right: calc(320px + 3rem)` (sidebar open — `.with-sidebar` state)

**`ThreadSidebar.css` — positioning constants:**
- `right: 1rem; top: calc(48px + 0.5rem); height: calc(100vh - 48px - 1rem)`
- Collapsed: `transform: translateX(calc(100% + 1rem)); visibility: hidden; transition: transform 0.3s ease, visibility 0s 0.3s`
- Expanded: `transform: translateX(0); visibility: visible; transition: transform 0.3s ease, visibility 0s`

### browser-app components to generate as stubs

- `Dashboard.tsx` — MF export with `shellMode` prop + double-Provider (see above)
- `DashboardContent.tsx` — inner component, separates Provider boundary from logic
- `CommandsTab.tsx` — ContentSwitcher + filter bar (Tier/Phase/Search) + command list
- `CommandCard.tsx` — expandable card with markdown render via `react-markdown`
- `ADRsTab.tsx` — nested ContentSwitcher lens views (All / By Status / By Repo) + ADR list
- `ADRCard.tsx` — expandable card, `Repos affected` + `Commands affected` Tag pills (cross-linked)
- `RoadmapTab.tsx` — Carbon ProgressIndicator (stepped) + expandable phase rows with ADR cross-links
- `ThreadSidebar.tsx` — `inert` wrapper from day one; CSS sidebar pattern (not Carbon SideNav)
- `CondensedChat.tsx` — disabled state footer in Phase 1; sidebar-aware positioning

### API routes to stub

- `GET /api/commands` — returns `CommandManifest[]`: `{ name, tier, phase, description, knowledgeFiles }`
- `GET /api/commands/:name` — returns full markdown content + knowledge file list
- `GET /api/adrs` — returns `ADRManifest[]`: `{ number, title, status, date, reposAffected, commandsAffected }`
- `GET /api/adrs/:number` — returns full markdown content
- `GET /api/roadmap` — returns `RoadmapPhase[]`: `{ phase, what, repos, status }`
- `GET /api/tools` — ADR-0007 capability manifest stub

### API parsers to scaffold

- `parseCommands(coreRepoPath)` — `fs.readdirSync('.claude/commands/')`, reads `<name>.md`
  header comment block (Tier, Phase metadata from the CLAUDE.md commands table)
- `parseADRs(coreRepoPath)` — reads `decisions/adr/*.md`, extracts via `gray-matter`:
  `Status`, `Date`, `OKR`, `Repos affected`, `Commands affected`
- `parseRoadmap(coreRepoPath)` — reads `domain-knowledge/frame-os-context.md`, extracts
  the `## The roadmap phases` table via `remark`

### devDependencies to include at scaffold

```json
"vite-plugin-css-injected-by-js": "^4.0.1",
"@originjs/vite-plugin-federation": "^1.4.1",
"gray-matter": "^4.0.3",
"react-markdown": "^9.0.0",
"remark-gfm": "^4.0.0"
```

### Not in scope for scaffold

- OKR/Docs parsers (Phase 2)
- Mutation API (Phase 3)
- Agent graph stub (Phase 4 — note: CondensedChat footer present but disabled)
