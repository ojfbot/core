# Scaffold Validation Checklist

28-item deterministic checklist. Run every item after scaffold completes.
Report each as PASS/FAIL. If ANY fail, fix before proceeding.

## Build gate (items 1–4)

| # | Check | Command | Pass criteria |
|---|-------|---------|---------------|
| 1 | Install | `pnpm install --frozen-lockfile` | Exit 0 |
| 2 | Build | `pnpm build` | Exit 0 (all 4 packages compile) |
| 3 | Test | `pnpm test` | Exit 0 (≥1 test passes) |
| 4 | MF entry | `ls packages/browser-app/dist/assets/remoteEntry.js` | File exists |

## Port gate (items 5–7)

Start both servers before running these checks.

| # | Check | Command | Pass criteria |
|---|-------|---------|---------------|
| 5 | Browser port | `curl -sf http://localhost:<port>/assets/remoteEntry.js \| head -c 100` | Non-empty response |
| 6 | API health | `curl -sf http://localhost:<api-port>/health` | JSON with `status: "ok"` |
| 7 | Tools manifest | `curl -sf http://localhost:<api-port>/api/tools` | JSON array (ADR-0007) |

## UI structure gate (items 8–15)

Grep source files — do NOT require running servers for these.

| # | Check | File | Pattern |
|---|-------|------|---------|
| 8 | shell-mode class | `Dashboard.css` | `.shell-mode` |
| 9 | with-sidebar class | `Dashboard.css` | `.with-sidebar` |
| 10 | Carbon tab override | `Dashboard.css` | `.cds--tabs--contained` |
| 11 | Contained tabs | `DashboardContent.tsx` | `contained` on `<TabList>` |
| 12 | Heading always visible | `DashboardContent.tsx` | `<Heading` outside any conditional |
| 13 | Inert side panel | `*SidePanel.tsx` | `inert` attribute |
| 14 | Typed hooks | `store/store.ts` | `useAppDispatch` AND `useAppSelector` exports |
| 15 | Double Provider | `Dashboard.tsx` | `<Provider` AND `<QueryClientProvider` |

## Shell integration gate (items 16–24)

All checks target the shell repo at `/Users/yuri/ojfbot/shell/`.

| # | Check | File | Pattern |
|---|-------|------|---------|
| 16 | AppType union | `appRegistrySlice.ts` | `'<name>'` in AppType |
| 17 | APP_CONFIG entry | `appRegistrySlice.ts` | `'<name>':` in APP_CONFIG |
| 18 | DEFAULT_APP_TYPES | `appRegistrySlice.ts` | `'<name>'` in array |
| 19 | Remote loader | `AppFrame.tsx` | `'<name>'` in REMOTE_LOADERS |
| 20 | Settings loader | `settings-loaders.ts` | `'<name>'` in SETTINGS_LOADERS |
| 21 | Domain registry | `domain-registry.ts` | `id: '<name>'` |
| 22 | DomainType union | `meta-orchestrator.ts` | `'<name>'` in DomainType |
| 23 | MF remote | `vite.config.ts` | remote entry URL for `<name>` |
| 24 | API URL env | `frame-agent-manager.ts` | env var for `<name>` API |

## Infrastructure gate (items 25–28)

| # | Check | File | Pattern |
|---|-------|------|---------|
| 25 | frame-dev start | `frame-dev.sh` | `start_subapp` or dev block for both ports |
| 26 | frame-dev stop | `frame-dev.sh` | `stop_port` for both ports |
| 27 | frame-dev status | `frame-dev.sh` | `status_port` for both ports |
| 28 | Repo inventory | `frame-os-context.md` | New app row in inventory table |

## Remediation

If any item fails:
1. Fix the issue (most are missing files, wrong config, or missing shell edits)
2. Re-run `pnpm build && pnpm test` after any source change
3. Re-check only the failed items
4. Do not proceed to Step 10 (summary) until all 28 pass
