# Allowed Paths for Apply Mode

`/techdebt --mode=apply` will only write to paths that match this allowlist. Any proposal targeting a path outside this list will be blocked and reported to the user for manual review.

## Allowlist

```
packages/workflows/**
packages/cli/**
domain-knowledge/**
.claude/skills/**
scripts/**
decisions/**
```

## Blocked paths (never auto-patched)

```
packages/vscode-extension/**   # VSCode extension — UI, requires manual review
src/**                         # App source in individual projects (cv-builder, etc.)
*.test.*                       # Test files — changes must be reviewed
*.spec.*
pnpm-lock.yaml                 # Lock files — never auto-modified
package.json (root)            # Root package — high blast radius
.github/**                     # CI/CD — high risk changes
```

## Why these constraints exist

The allowlist is conservative by design. The tech debt scanner can propose changes to any file, but auto-applying changes to application source, tests, or CI pipelines without human review is too risky:

1. **Application source** — business logic changes require understanding of product requirements
2. **Test files** — tests are the ground truth; auto-modifying them can silently remove coverage
3. **Lock files** — generated files that must be produced by package managers, not hand-edited
4. **CI/CD** — a broken pipeline blocks the whole team

## Adding paths to the allowlist

To add a new path, update `src/workflows/techdebt.ts:isAllowedPath()`:

```typescript
function isAllowedPath(filePath: string): boolean {
  const allowed = [
    /^packages\/workflows\//,
    /^packages\/cli\//,
    /^domain-knowledge\//,
    /^\.claude\/commands\//,
    /^scripts\//,
    /^decisions\//,
  ]
  return allowed.some(re => re.test(filePath))
}
```

And update this file.

## Per-repo overrides

Individual repos may extend or restrict the allowlist via `domain-knowledge/<repo>-techdebt-paths.md`. The `/techdebt` skill checks for this file before applying.
