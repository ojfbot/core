#!/usr/bin/env python3
"""collect.py — gather recent Claude/ojfbot activity into a JSON digest on stdout.

Read-only. The `/vault sync` skill consumes this digest and authors the notes — this script
does not touch the vault (other than reading Inbox/session-stubs.md).

Usage: collect.py [--since=7d] [--max-prompts=40]
  --since accepts: Nd (days), Nh (hours), Nw (weeks), or an ISO date YYYY-MM-DD.

Env: SELFCO_VAULT (default ~/selfco), OJFBOT_ROOT (default derived, fallback ~/ojfbot),
     CLAUDE_HOME (default ~/.claude)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent


def claude_home() -> Path:
    return Path(os.environ.get("CLAUDE_HOME", str(Path.home() / ".claude"))).expanduser()


def vault_root() -> Path:
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


def ojfbot_root() -> Path:
    env = os.environ.get("OJFBOT_ROOT")
    if env:
        return Path(env).expanduser()
    try:
        cand = HERE.parents[4]
        if (cand / "core").is_dir():
            return cand
    except IndexError:
        pass
    return Path.home() / "ojfbot"


def parse_since(spec: str) -> datetime:
    spec = spec.strip()
    m = re.fullmatch(r"(\d+)([dhw])", spec)
    if m:
        n = int(m.group(1))
        unit = {"d": "days", "h": "hours", "w": "weeks"}[m.group(2)]
        return datetime.now(timezone.utc) - timedelta(**{unit: n})
    try:
        return datetime.fromisoformat(spec).replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc) - timedelta(days=7)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_jsonl(path: Path):
    if not path.is_file():
        return
    try:
        with path.open(encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    except OSError:
        return


def ts_of(rec: dict) -> str | None:
    for k in ("ts", "timestamp", "time", "created_at"):
        if k in rec and isinstance(rec[k], str):
            return rec[k]
    return None


def in_window(rec: dict, since: datetime) -> bool:
    t = ts_of(rec)
    if not t:
        return False
    try:
        dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt >= since
    except ValueError:
        return False


def repo_from_cwd(cwd: str, oj: Path) -> str | None:
    if not cwd:
        return None
    try:
        p = Path(cwd).resolve()
        oj = oj.resolve()
        if oj in p.parents or p == oj:
            rel = p.relative_to(oj)
            return rel.parts[0] if rel.parts else None
    except (ValueError, OSError):
        pass
    return None


# ---------------------------------------------------------------------------- git

def git_activity(repo_dir: Path, since: datetime) -> dict:
    out: dict = {"branch": None, "commits": []}
    try:
        out["branch"] = subprocess.run(
            ["git", "-C", str(repo_dir), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=10).stdout.strip() or None
        log = subprocess.run(
            ["git", "-C", str(repo_dir), "log", f"--since={iso(since)}",
             "--pretty=format:%h\x1f%cI\x1f%s", "--no-merges"],
            capture_output=True, text=True, timeout=15).stdout
        for line in log.splitlines():
            parts = line.split("\x1f")
            if len(parts) == 3:
                out["commits"].append({"hash": parts[0], "date": parts[1][:10], "subject": parts[2]})
    except (subprocess.SubprocessError, OSError):
        pass
    return out


FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def bead_meta(path: Path) -> dict:
    meta = {"path": str(path), "type": None, "title": None, "created_at": None}
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return meta
    m = FM_RE.match(text)
    block = m.group(1) if m else text[:600]
    for line in block.splitlines():
        for key in ("type", "title", "created_at"):
            mm = re.match(rf"\s*{key}\s*:\s*(.+?)\s*$", line)
            if mm and meta[key] is None:
                meta[key] = mm.group(1).strip().strip('"').strip("'")
    if not meta["created_at"]:
        try:
            meta["created_at"] = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).strftime("%Y-%m-%d")
        except OSError:
            pass
    return meta


def recent_beads(repo_dir: Path, since: datetime) -> list[dict]:
    hd = repo_dir / ".handoff"
    if not hd.is_dir():
        return []
    out = []
    for f in sorted(hd.glob("*.md")):
        try:
            if datetime.fromtimestamp(f.stat().st_mtime, timezone.utc) < since:
                continue
        except OSError:
            continue
        out.append(bead_meta(f))
    return out


# ---------------------------------------------------------------------------- main

def main(argv: list[str]) -> int:
    since_spec = "7d"
    max_prompts = 40
    for a in argv:
        if a.startswith("--since="):
            since_spec = a.split("=", 1)[1]
        elif a.startswith("--max-prompts="):
            try:
                max_prompts = int(a.split("=", 1)[1])
            except ValueError:
                pass
    since = parse_since(since_spec)
    ch = claude_home()
    oj = ojfbot_root()
    v = vault_root()

    digest: dict = {
        "generated_at": iso(datetime.now(timezone.utc)),
        "since": iso(since),
        "since_spec": since_spec,
        "ojfbot_root": str(oj),
        "vault": str(v),
        "sessions": [],
        "skills": [],
        "repos": {},
        "recent_prompts": [],
        "pending_stubs": [],
        "adrs": [],
        "notes": [],
    }

    # sessions
    for rec in read_jsonl(ch / "session-telemetry.jsonl"):
        if not in_window(rec, since):
            continue
        digest["sessions"].append({
            "ts": ts_of(rec), "session_id": rec.get("session_id"),
            "repo": rec.get("repo") or repo_from_cwd(rec.get("cwd", ""), oj),
            "branch": rec.get("branch"), "model": rec.get("model"),
            "source": rec.get("source"), "cwd": rec.get("cwd"),
        })

    # skills
    for rec in read_jsonl(ch / "skill-telemetry.jsonl"):
        if not in_window(rec, since):
            continue
        digest["skills"].append({
            "ts": ts_of(rec), "skill": rec.get("skill") or rec.get("name"),
            "args": rec.get("args"), "session_id": rec.get("session_id"),
            "repo": rec.get("repo") or repo_from_cwd(rec.get("cwd", ""), oj), "cwd": rec.get("cwd"),
        })

    # recent prompts (summarize downstream — included raw but truncated)
    prompts = []
    for rec in read_jsonl(ch / "history.jsonl"):
        txt = rec.get("display") or rec.get("prompt") or rec.get("text")
        if isinstance(txt, str) and txt.strip():
            prompts.append({"ts": ts_of(rec), "text": txt.strip()[:280]})
    digest["recent_prompts"] = prompts[-max_prompts:]
    digest["notes"].append("recent_prompts is raw user input — summarize, never quote verbatim into the vault.")

    # repos: git + beads (limit to repos that show session/skill activity OR have commits in window)
    active_slugs = {s["repo"] for s in digest["sessions"] if s["repo"]} | {s["repo"] for s in digest["skills"] if s["repo"]}
    if oj.is_dir():
        for child in sorted(oj.iterdir()):
            # `.git` dir = real repo; `.git` file = linked worktree — skip worktrees
            if not (child.is_dir() and (child / ".git").is_dir()):
                continue
            slug = child.name
            ga = git_activity(child, since)
            beads = recent_beads(child, since)
            if slug in active_slugs or ga["commits"] or beads:
                digest["repos"][slug] = {"branch": ga["branch"], "commits": ga["commits"], "beads": beads}

    # pending session stubs
    stubs = v / "Inbox" / "session-stubs.md"
    if stubs.is_file():
        try:
            for line in stubs.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if line.startswith("- "):
                    digest["pending_stubs"].append(line[2:])
        except OSError:
            pass

    # ADRs (for Decisions index refresh)
    adr_dir = oj / "core" / "decisions" / "adr"
    if adr_dir.is_dir():
        for f in sorted(adr_dir.glob("[0-9]*.md")):
            title = None
            try:
                for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
            except OSError:
                pass
            digest["adrs"].append({"file": f.name, "path": str(f.relative_to(oj)), "title": title})

    json.dump(digest, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
