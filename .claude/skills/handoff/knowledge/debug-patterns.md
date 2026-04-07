# Debug Patterns for Handoff

## Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ENOENT: no such file or directory, scandir '.../packages/tsconfig'` | CI clones dependency repo from main, but package hasn't merged yet | Merge dependency PR first, then re-run CI |
| `Pull request is not mergeable` | Merge conflict from parallel PRs | Rebase on updated main: `git fetch origin && git rebase origin/main` |
| `Unknown skill: skill-loader` | Skill invoked without being installed | Symlink: `ln -s ../../../core/.claude/skills/<skill> .claude/commands/<skill>` |

## Platform-Specific Gotchas

### macOS vs Linux
| Issue | macOS | Linux |
|-------|-------|-------|
| MD5 hashing | `md5 -q` (BSD) | `md5sum \| cut -d' ' -f1` (GNU) |
| `readlink -f` | Not available (use `greadlink -f` via coreutils) | Works natively |
| File paths | Case-insensitive by default | Case-sensitive |
| `sed -i` | Requires `sed -i ''` (empty backup ext) | `sed -i` works directly |

### Detection pattern
```bash
if command -v md5sum &>/dev/null; then
  HASH=$(echo "$input" | md5sum | cut -d' ' -f1)
else
  HASH=$(echo "$input" | md5 -q)
fi
```

## Where to Find Logs

| Log | Location |
|-----|----------|
| Tool usage telemetry | `~/.claude/tool-telemetry.jsonl` |
| Skill invocations | `~/.claude/skill-telemetry.jsonl` |
| Session metadata | `~/.claude/session-telemetry.jsonl` |
| Lint cache | `/tmp/claude-lint-cache-<session_id>/` |
| Skill dedup state | `/tmp/claude-skill-suggest-<session_id>` |

## Known Flaky Behaviors

- Module Federation `remoteEntry.js` only generated on `vite build`, not `vite dev`
- Vercel header rules: specific paths must come AFTER catch-all `(.*)` (later = higher priority)
- `pnpm audit` may report false positives — check with `--audit-level=high`
