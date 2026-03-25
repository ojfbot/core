# ADR-0030: Shared Frame UI Components Library

Date: 2026-03-24
Status: Accepted
OKR: 2026-Q1 / O1 / KR2 (premium visual treatment)
Commands affected: /scaffold-frame-app, /validate, /sweep
Repos affected: frame-ui-components, cv-builder, blogengine, TripPlanner, shell, purefoy, core-reader, gastown-pilot, lean-canvas, seh-study

---

## Context

All 9 Frame OS sub-apps had independently copy-pasted implementations of core UI components: DashboardLayout, ChatShell, ChatMessage, ThreadSidebar, MarkdownMessage, BadgeButton, and ErrorBoundary. This caused:

- **Style drift:** The same component looked different across apps (e.g. ChatShell input row layout was broken everywhere except BlogEngine, which had a correct local copy).
- **Shotgun surgery:** Fixing a CSS bug in ChatShell required patching it in every repo individually.
- **Divergent APIs:** Local BadgeButton in BlogEngine used `{ message: string }` while the shared type system uses `{ actions: Action[] }` with factory functions.
- **~2,000 lines of duplicated code** across the fleet.

## Decision

Extract shared UI components into `@ojfbot/frame-ui-components`, a standalone repo consumed as a source-dependency via `file:../../../frame-ui-components` in each sub-app's `package.json`. No build step — consumers import `.tsx` and `.css` directly.

Components are **pure and prop-driven** — no Redux, no app-specific context. Each consuming app creates thin `*Connected.tsx` wrappers that wire Redux state to component props. This extends the ADR-0029 pattern (shell prop-only boundary) to the entire fleet.

### What the library exports

**7 components:** BadgeButton, MarkdownMessage, ErrorBoundary, DashboardLayout, ThreadSidebar, ChatShell, ChatMessage (+ MetadataLoadingIndicator)

**Action type system:** `BadgeAction`, `Action` (union of ChatAction, NavigateAction, FileUploadAction, etc.), `SuggestedMessage`, factory functions (`createSimpleBadge`, `createChatAction`, `getChatMessage`, etc.)

**7 CSS style entry points:** Import as `@ojfbot/frame-ui-components/styles/<name>` (e.g. `styles/chat-shell`, `styles/thread-sidebar`)

### Import pattern

```tsx
// Component + types
import { ChatShell, ChatMessage, MarkdownMessage } from '@ojfbot/frame-ui-components'
import type { ChatDisplayState, BadgeAction } from '@ojfbot/frame-ui-components'

// Styles (side-effect imports)
import '@ojfbot/frame-ui-components/styles/chat-shell'
import '@ojfbot/frame-ui-components/styles/markdown-message'
```

### Connected wrapper pattern

```tsx
// ThreadSidebarConnected.tsx — thin Redux wrapper per app
import { ThreadSidebar } from '@ojfbot/frame-ui-components'
import type { ThreadItem } from '@ojfbot/frame-ui-components'

export default function ThreadSidebarConnected({ isExpanded, onToggle }) {
  const threads = useAppSelector(s => s.threads.threads)
  const threadItems: ThreadItem[] = threads.map(t => ({
    threadId: t.id,
    title: t.name,
    updatedAt: t.updatedAt,
  }))
  return <ThreadSidebar threads={threadItems} /* ...props */ />
}
```

## Consequences

### Gains
- Single source of truth for shared UI — bug fixes propagate automatically
- Consistent look and feel across all 9 apps
- Centralized tests (vitest) and Storybook stories alongside components
- Style entry points enable per-component CSS imports (no unused CSS)
- New apps scaffolded with `/scaffold-frame-app` get shared components by default

### Costs
- New repo to maintain (`frame-ui-components`)
- Peer dependency alignment: all consumers must have compatible `@carbon/react`, `react`, `react-markdown` versions
- If the library is ever npm-published, version coordination adds overhead

### Neutral
- Each app still needs its own `*Connected.tsx` wrappers — slightly more files, but clean separation
- `file:` dependency means `pnpm install` must resolve the sibling path; CI workflows `git clone` the repo

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| npm publish with build step | Adds versioning overhead and publish latency for a private repo cluster where all consumers are co-developed |
| Move into shell `packages/ui/` | Sub-apps should not depend on the shell host; creates circular dependency risk |
| Monorepo with all apps | Would require migrating 9 independent repos into one — high disruption, low benefit given `file:` linking works |
