#!/usr/bin/env python3
"""Sanitized fingerprint of this machine's Claude configuration, for cross-machine parity.

Two Macs cannot read each other's ~/.claude, and copying it would move credentials.
This prints only comparable facts — skill names and the commit they resolve to, hook
script names per event, instruction headings and a hash of the managed block, plugin
ids — so two fingerprints can be diffed through a coordination channel.

It never prints file contents, absolute paths, settings values, or account
identifiers (the account-synced skill bucket name embeds one and is dropped).

Usage:
  claude-config-fingerprint.py --device NAME [--out FILE]
  claude-config-fingerprint.py --compare A.json B.json
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import shlex
import subprocess
import sys

HOME = pathlib.Path.home()
CLAUDE = HOME / ".claude"
SCRIPT_SUFFIXES = (".sh", ".py", ".mjs", ".js")
CATALOG = pathlib.Path(".claude/skills/skill-loader/knowledge/skill-catalog.json")


def core_root(path):
    """The Core checkout containing path, recognized by its catalog, not its directory name."""
    # A home folder also "contains" the catalog through its skill-loader symlink, so
    # require a git root whose skill-loader directory is real.
    for parent in pathlib.Path(path).resolve().parents:
        loader = parent / ".claude/skills/skill-loader"
        if (parent / ".git").exists() and loader.is_dir() and not loader.is_symlink() \
                and (parent / CATALOG).is_file():
            return parent
    return None


def git(repo, *args):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def repo_state(path):
    top = git(path, "rev-parse", "--show-toplevel")
    if not top:
        return None
    return {
        "repo": pathlib.Path(top).name,
        "branch": git(top, "rev-parse", "--abbrev-ref", "HEAD"),
        "commit": git(top, "rev-parse", "--short=7", "HEAD"),
        "dirty": bool(git(top, "status", "--porcelain")),
    }


def code_skills():
    skills = {}
    root = CLAUDE / "skills"
    if not root.is_dir():
        return skills
    for entry in sorted(root.iterdir()):
        if entry.name == "synced" or entry.name.startswith("."):
            continue
        if entry.is_symlink():
            target = entry.resolve()
            info = {"kind": "link" if target.exists() else "broken-link"}
            if target.exists():
                state = repo_state(target)
                if state:
                    info.update(state)
        elif entry.is_dir():
            info = {"kind": "copy"}
        else:
            continue
        info["has_skill_md"] = (entry / "SKILL.md").is_file()
        skills[entry.name] = info
    return skills


def account_skills():
    names = set()
    synced = CLAUDE / "skills" / "synced"
    if synced.is_dir():
        for bucket in synced.iterdir():
            if bucket.is_dir():
                names.update(p.name for p in bucket.iterdir() if p.is_dir())
    return sorted(names)


def hook_location(token):
    path = pathlib.Path(token).expanduser()
    if core_root(path):
        return "core"
    if str(path).startswith(str(CLAUDE)):
        return "claude-home"
    return "other"


def hooks(settings):
    out = {}
    for event, entries in sorted((settings.get("hooks") or {}).items()):
        names = []
        for entry in entries:
            for hook in entry.get("hooks", []):
                try:
                    tokens = shlex.split(hook.get("command", ""))
                except ValueError:
                    tokens = []
                script = next((t for t in tokens if t.endswith(SCRIPT_SUFFIXES)), None)
                if script:
                    label = pathlib.Path(script).name
                    matcher = entry.get("matcher")
                    names.append({"script": label, "matcher": matcher,
                                  "location": hook_location(script),
                                  "ledger_root_set": any(t.startswith("--ledger-root=") for t in tokens)})
                else:
                    names.append({"script": "<inline>", "matcher": entry.get("matcher"),
                                  "location": "inline", "ledger_root_set": False})
        out[event] = sorted(names, key=lambda h: (h["script"], h["matcher"] or ""))
    return out


def instructions():
    path = CLAUDE / "CLAUDE.md"
    if not path.is_file():
        return {"present": False}
    text = path.read_text()
    heading = re.compile(r"^## +(.+?)\s*$", re.M)
    start = text.find("<!-- managed:start")
    end = re.search(r"<!-- managed:end[^>]*-->", text)
    if start >= 0 and end:
        block = text[start:end.end()]
        # Hash from the first newline: the start marker's trailing text varies by install.
        body = block[block.find("\n") + 1:]
        return {
            "present": True,
            "managed": True,
            "managed_sha256": hashlib.sha256(body.encode()).hexdigest()[:16],
            "managed_headings": heading.findall(block),
            "own_headings": heading.findall(text[:start] + text[end.end():]),
        }
    return {"present": True, "managed": False, "own_headings": heading.findall(text)}


def claude_version():
    try:
        r = subprocess.run(["claude", "--version"], capture_output=True, text=True, timeout=20)
        return r.stdout.strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None


def catalog_drift(skills):
    """Compare installed links with the catalog of the Core checkout they resolve into."""
    for name, info in skills.items():
        if info.get("kind") == "link":
            core = core_root(CLAUDE / "skills" / name / "SKILL.md")
            if core:
                data = json.loads((core / CATALOG).read_text())
                wanted = {s["name"] for s in data["skills"] if "user" in (s.get("scope") or [])}
                have = set(skills)
                return {"catalog_user_scope": len(wanted),
                        "missing": sorted(wanted - have),
                        "not_in_catalog": sorted(have - wanted)}
    return None


def fingerprint(device):
    settings_path = CLAUDE / "settings.json"
    settings = json.loads(settings_path.read_text()) if settings_path.is_file() else {}
    skills = code_skills()
    return {
        "schema": "ojfbot-claude-fingerprint/1",
        "device": device,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "claude_code_version": claude_version(),
        "settings_present": settings_path.is_file(),
        "settings_keys": sorted(settings),
        "code_skills": skills,
        "catalog_drift": catalog_drift(skills),
        "account_skills": account_skills(),
        "hooks": hooks(settings),
        "instructions": instructions(),
        "plugins": sorted(k for k, v in (settings.get("enabledPlugins") or {}).items() if v),
    }


def compare(a, b):
    rows = []
    def diff(label, x, y):
        if x != y:
            rows.append((label, x, y))
    da, db = a["device"], b["device"]
    diff("claude_code_version", a["claude_code_version"], b["claude_code_version"])
    # Group skills that differ the same way, so 25 links on one commit read as one line.
    groups = {}
    for name in sorted(set(a["code_skills"]) | set(b["code_skills"])):
        x, y = a["code_skills"].get(name), b["code_skills"].get(name)
        fx = None if x is None else (x.get("kind"), x.get("repo"), x.get("commit"), x.get("dirty"))
        fy = None if y is None else (y.get("kind"), y.get("repo"), y.get("commit"), y.get("dirty"))
        if fx != fy:
            groups.setdefault((fx, fy), []).append(name)
    for (fx, fy), names in groups.items():
        rows.append((f"skills ({len(names)}): {', '.join(names)}", fx, fy))
    sa, sb = set(a["account_skills"]), set(b["account_skills"])
    diff("account skills only on one side", sorted(sa - sb), sorted(sb - sa))
    for event in sorted(set(a["hooks"]) | set(b["hooks"])):
        x = [(h["script"], h["matcher"]) for h in a["hooks"].get(event, [])]
        y = [(h["script"], h["matcher"]) for h in b["hooks"].get(event, [])]
        diff(f"hooks {event}", x, y)
    ia, ib = a["instructions"], b["instructions"]
    diff("managed instructions hash", ia.get("managed_sha256"), ib.get("managed_sha256"))
    diff("own instruction headings", ia.get("own_headings"), ib.get("own_headings"))
    diff("plugins", a["plugins"], b["plugins"])
    if not rows:
        print(f"{da} and {db}: no differences")
        return 0
    print(f"{len(rows)} difference(s): {da} | {db}")
    for label, x, y in rows:
        print(f"- {label}\n    {da}: {x}\n    {db}: {y}")
    return 1


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--device")
    ap.add_argument("--out")
    ap.add_argument("--compare", nargs=2, metavar=("A", "B"))
    args = ap.parse_args(argv)
    if args.compare:
        a, b = (json.loads(pathlib.Path(p).read_text()) for p in args.compare)
        return compare(a, b)
    if not args.device:
        ap.error("--device is required unless --compare is used")
    text = json.dumps(fingerprint(args.device), indent=2, sort_keys=True) + "\n"
    if args.out:
        pathlib.Path(args.out).write_text(text)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
