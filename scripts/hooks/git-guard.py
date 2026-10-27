#!/usr/bin/env python3
"""PreToolUse(Bash) guard — blocks the shell idioms that produced false or destructive
outcomes in the lego-village-pipeline correspondence round, 2026-09-19.

Each rule exists because the failure actually happened, not because it is conceivable:

  1. `git add -A` in a clone shared with concurrent agents committed ChatGPT's untracked
     CORR-027 memo onto a Claude Code branch (PR #16, blocker TR-16-03).
  2. `gh pr review … | tail -2 || gh pr comment … && echo "review posted"` reported a
     posted review that did not exist: a pipeline's exit status is the LAST command's,
     so the `||` fallback never ran and the `&&` success line printed regardless.
  3. Chaining `&& echo <success>` onto an outward-facing write substitutes a shell echo
     for reading the artifact back.

Matching runs against a SKELETON of the command with quoted spans blanked, so operators
inside quotes (sed 's|a|b|', grep "x && y") do not false-positive. A guard that cries
wolf gets disabled, which is worse than no guard.

Exit 2 blocks the call and returns stderr to the model; anything else passes through.
Tested by scripts/__tests__/test_discipline_hooks.py — 26 cases, block and allow.
"""
import json
import re
import sys


def skeleton(s):
    """Blank the contents of quoted spans so operators inside them are not matched."""
    out, quote, esc = [], None, False
    for ch in s:
        if esc:
            out.append("_")
            esc = False
            continue
        if ch == "\\":
            out.append("_")
            esc = True
            continue
        if quote:
            out.append(ch if ch == quote else "_")
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
            out.append(ch)
            continue
        out.append(ch)
    return "".join(out)


def block(what, why, instead):
    sys.stderr.write(f"BLOCKED by git-guard: {what}\n\n")
    sys.stderr.write(f"Why: {why}\n")
    sys.stderr.write(f"Do instead: {instead}\n")
    sys.exit(2)


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return 0
    if d.get("tool_name") != "Bash":
        return 0
    cmd = (d.get("tool_input") or {}).get("command", "") or ""
    if not cmd.strip():
        return 0
    sk = skeleton(cmd)

    # --- Rule 1: wildcard staging in a shared checkout ---------------------------
    if re.search(r"(^|[;&|]\s*)git\s+add\s+(-A\b|--all\b|\.(\s|$))", sk):
        block("wildcard staging (`git add -A` / `.` / `--all`)",
              "ojfbot clones are shared with concurrent agents; untracked files may be "
              "another agent's in-flight work. This committed ChatGPT's CORR-027 memo onto "
              "a Claude Code branch and became a merge-train blocker.",
              "stage explicit paths — `git add docs/correspondence/MY-FILE.md …` — then "
              "confirm with `git status --short` and `git diff --name-status main...HEAD`.")

    if re.search(r"(^|[;&|]\s*)git\s+commit\s+(?:[^;&|]*\s)?-{1,2}(a|am|all)\b", sk):
        block("`git commit -a` (stages every tracked change)",
              "same hazard as wildcard staging in a shared checkout: it sweeps in edits you "
              "did not make.",
              "stage the paths you mean with `git add <path>…`, then `git commit` without -a.")

    # --- Rule 2: branching on a pipeline's exit status ---------------------------
    # Per statement, so `a | b ; c || d` (legitimate) is not flagged. An explicit
    # `set -o pipefail` anywhere in the command is treated as opting in.
    if "pipefail" not in sk:
        for stmt in re.split(r"[;\n]", sk):
            piped = re.search(r"[^|]\|[^|]", stmt)
            if piped and re.search(r"(\|\||&&)", stmt[piped.end():]):
                block("branching on a pipeline's exit status (`… | … || …` or `… | … && …`)",
                      "a pipeline returns the LAST command's status, so the branch tests the "
                      "wrong thing. This printed 'review posted to #19' for a review that was "
                      "never posted.",
                      "split into separate Bash calls and check the real result, or put "
                      "`set -o pipefail;` at the start if you genuinely need the chain.")

    # --- Rule 3: echoing success for an outward-facing write ---------------------
    write = r"(gh\s+(pr|issue|release)\s+(comment|review|create|merge|edit|close)|git\s+push)"
    if re.search(write, sk) and re.search(r"&&\s*(echo|printf)", sk):
        block("claiming success by `echo` after an outward-facing write",
              "an echo reports that the shell reached a line, not that the artifact exists. "
              "Three false reports this round came from proxy signals instead of the artifact.",
              "run the write alone, then VERIFY by reading it back — `gh pr view <n> --json "
              "comments`, `git log --oneline -1 origin/<branch>` — and report what it returned.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
