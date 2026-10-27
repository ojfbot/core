#!/usr/bin/env python3
"""Acceptance battery for the two agent-discipline hooks. One command:

    python3 scripts/__tests__/test_discipline_hooks.py

Every case is a failure that actually happened this session, or a legitimate command
that must not be blocked. A guard with false positives gets disabled, so the allow
cases matter as much as the block cases.
"""
import json
import os
import subprocess
import sys

HOOKS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hooks")
GUARD = os.path.join(HOOKS, "git-guard.py")
VERIFY = os.path.join(HOOKS, "verify-outward-writes.py")


def run(hook, command):
    p = subprocess.run([hook], input=json.dumps(
        {"tool_name": "Bash", "tool_input": {"command": command}}),
        capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


BLOCK, ALLOW = "block", "allow"

GUARD_CASES = [
    # (expectation, command, why this case exists)
    (BLOCK, "git add -A", "the CORR-027 contamination"),
    (BLOCK, "git add .", "same family"),
    (BLOCK, "cd /repo && git add --all", "after a cd"),
    (BLOCK, 'git commit -am "x"', "stages every tracked change"),
    (BLOCK, "git commit -a -m x", "separated form"),
    (BLOCK, 'gh pr review 19 --approve -F f | tail -2 || gh pr comment 19 -F f && echo "posted"',
     "the exact chain that reported a review that was never posted"),
    (BLOCK, "ls | head -2 && echo done", "pipeline then &&"),
    (BLOCK, 'gh pr comment 16 --body-file f >/dev/null && echo "posted"', "echoed success"),
    (BLOCK, "git push && echo pushed", "echoed success"),
    (ALLOW, "git add docs/correspondence/REGISTER.md docs/x.md", "explicit paths"),
    (ALLOW, "git commit -m 'message with && and | inside'", "operators inside quotes"),
    (ALLOW, "sed 's|a|b|' file > out", "sed delimiters are not pipelines"),
    (ALLOW, 'grep -E "x && y" file', "operators inside double quotes"),
    (ALLOW, "grep x file | head -3", "an ordinary pipeline"),
    (ALLOW, "ls | head -2 ; true || echo hi", "separate statements"),
    (ALLOW, "gh pr comment 16 --body-file f", "the write on its own"),
    (ALLOW, "gh pr view 19 --json comments", "a read-back"),
    (ALLOW, "python3 tests/test_design_package.py", "unrelated command"),
    (ALLOW, "set -o pipefail; ls | head -2 && echo ok", "explicitly opted in to pipefail"),
]

VERIFY_CASES = [
    ("gh pr comment 19 --body-file f", "gh pr view 19"),
    ("gh pr review 19 --body-file f", "gh pr view 19"),
    ("git push", "origin/"),
    ("git commit -m x", "--name-status"),
    ("gh pr create --title x", "gh pr list"),
    ("python3 tests/x.py", None),
    ("gh pr view 19 --json comments", None),
]


def main():
    failures = []
    print("git-guard.py")
    for want, cmd, why in GUARD_CASES:
        code, out = run(GUARD, cmd)
        got = BLOCK if code == 2 else ALLOW
        ok = got == want
        if not ok:
            failures.append(f"{cmd!r}: wanted {want}, got {got}")
        print(f"  [{'ok ' if ok else 'FAIL'}] {got:5} {cmd[:62]:<62} — {why}")

    print("\nverify-outward-writes.py")
    for cmd, expect in VERIFY_CASES:
        _, out = run(VERIFY, cmd)
        fired = "VERIFY BEFORE REPORTING" in out
        ok = (expect is not None) == fired and (expect is None or expect in out)
        if not ok:
            failures.append(f"{cmd!r}: expected {expect!r}, fired={fired}")
        state = "fires" if fired else "quiet"
        print(f"  [{'ok ' if ok else 'FAIL'}] {state:5} {cmd[:62]:<62} — expect {expect}")

    print()
    if failures:
        print(f"FAILED ({len(failures)}):")
        for f in failures:
            print("  " + f)
        return 1
    print(f"OK — {len(GUARD_CASES) + len(VERIFY_CASES)} cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())
