#!/usr/bin/env python3
"""
Show a chronological timeline of beads in a `.handoff/` directory.

Usage:
    python replay.py [--root PATH] [--since YYYY-MM-DD] [--type TYPE] [--actor NAME]
"""
from __future__ import annotations
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("replay.py requires PyYAML (pip install pyyaml)")

BEAD_FRONTMATTER_RE = re.compile(r"^---\n(.+?)\n---\n(.*)", re.DOTALL)


def to_datetime(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            s = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def fmt_dt(dt: datetime | None) -> str:
    if dt is None:
        return "?"
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt.tzinfo else dt.strftime("%Y-%m-%dT%H:%M:%S")


def parse_bead(path: Path) -> dict | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    m = BEAD_FRONTMATTER_RE.match(text)
    if not m:
        return None
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None
    fm["_path"] = path
    return fm


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path(".handoff"))
    ap.add_argument("--since", type=str, default=None,
                    help="ISO date YYYY-MM-DD; show beads on or after")
    ap.add_argument("--type", type=str, default=None,
                    choices=("brief", "report", "decision", "discovery"))
    ap.add_argument("--actor", type=str, default=None)
    args = ap.parse_args()

    if not args.root.exists():
        sys.exit(f"Not found: {args.root}")

    cutoff = None
    if args.since:
        try:
            cutoff = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
        except ValueError:
            sys.exit(f"Invalid --since: {args.since}; expected YYYY-MM-DD")

    beads = []
    for p in sorted(args.root.glob("*.md")):
        if p.name == "README.md":
            continue
        b = parse_bead(p)
        if not b:
            continue
        if args.type and b.get("type") != args.type:
            continue
        if args.actor and b.get("actor") != args.actor:
            continue
        ts = to_datetime(b.get("created_at"))
        if cutoff and (ts is None or ts < cutoff):
            continue
        b["_ts"] = ts
        beads.append(b)

    beads.sort(key=lambda b: b.get("_ts") or datetime.min.replace(tzinfo=timezone.utc))

    for b in beads:
        ts = fmt_dt(b.get("_ts"))
        type_ = b.get("type", "?")
        actor = b.get("actor", "?")
        title = b.get("title", "?")
        extra = ""
        if type_ == "brief" and b.get("to"):
            extra = f" → {b.get('to')}"
        elif type_ == "report" and b.get("responding_to") and b.get("responding_to") != "null":
            extra = f" ↩ {b.get('responding_to')}"
        print(f"{ts}  {type_:10}  {actor:15}  {title}{extra}")

    if not beads:
        print("(no matching beads)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
