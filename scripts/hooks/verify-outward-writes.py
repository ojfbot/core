#!/usr/bin/env python3
"""PostToolUse(Bash) — after any outward-facing write, demand the read-back.

git-guard.py blocks claiming success with `&& echo`. This is the other half: it fires
immediately after the write and names the exact verification command, so "I posted it"
is never reported from the shell's exit status alone.

Origin: 2026-09-19. A review reported as posted to PR #19 had never been posted; the
operator learned it from the reviewer, not from me. Three further false claims that
round came from reading a proxy signal instead of the artifact.
"""
import json
import re
import sys


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return 0
    if d.get("tool_name") != "Bash":
        return 0
    cmd = (d.get("tool_input") or {}).get("command", "") or ""
    checks = []

    m = re.search(r"gh\s+pr\s+(?:comment|review)\s+(\d+)", cmd)
    if m:
        checks.append(f"gh pr view {m.group(1)} --json comments,reviews"
                      "   # confirm YOUR body is present — check length or a distinctive line")
    if re.search(r"gh\s+pr\s+create", cmd):
        checks.append("gh pr list --state open --json number,title   # confirm the PR exists")
    m = re.search(r"gh\s+pr\s+merge\s+(\d+)", cmd)
    if m:
        checks.append(f"gh pr view {m.group(1)} --json state,mergedAt   # confirm it merged")
    if re.search(r"(^|[;&|]\s*)git\s+push", cmd):
        checks.append("git log --oneline -1 origin/$(git branch --show-current)"
                      "   # confirm the remote moved")
    if re.search(r"(^|[;&|]\s*)git\s+commit", cmd):
        checks.append("git status --short ; git diff --name-status main...HEAD"
                      "   # confirm the commit holds only your paths")

    if not checks:
        return 0

    print("VERIFY BEFORE REPORTING — this write is not evidence of its own success.")
    print("Run the read-back and report what it returned, not that the command exited 0:")
    for c in checks:
        print("  " + c)
    return 0


if __name__ == "__main__":
    sys.exit(main())
