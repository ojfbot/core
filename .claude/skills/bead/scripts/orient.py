#!/usr/bin/env python3
"""
Read recent beads from a `.handoff/` directory and produce an orientation
summary. Run this at the start of any session in a project that has a
`.handoff/` directory.

Usage:
    python orient.py [--root PATH] [--days N] [--actor NAME]

Defaults:
    --root .handoff
    --days 14
    --actor (any)
"""
from __future__ import annotations
import argparse
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("orient.py requires PyYAML (pip install pyyaml)")

BEAD_FRONTMATTER_RE = re.compile(r"^---\n(.+?)\n---\n(.*)", re.DOTALL)


def to_datetime(value) -> datetime | None:
    """PyYAML auto-parses ISO timestamps to datetime; sometimes we get strings.
    Return tz-aware datetime or None."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            # Tolerate trailing Z (Python <3.11) and naive strings
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
    fm["_body"] = m.group(2).lstrip()
    return fm


def load_beads(root: Path) -> list[dict]:
    if not root.exists():
        return []
    beads = []
    for p in sorted(root.glob("*.md")):
        if p.name == "README.md":
            continue
        bead = parse_bead(p)
        if bead and bead.get("type") in ("brief", "report", "decision", "discovery"):
            beads.append(bead)
    # Sort by created_at descending. Use to_datetime so strings and datetimes mix safely.
    beads.sort(key=lambda b: to_datetime(b.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return beads


def orient(root: Path, days: int, actor: str | None) -> str:
    beads = load_beads(root)
    if not beads:
        return f"No beads in {root}. Project has no handoff history yet."

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent = []
    for b in beads:
        ts = to_datetime(b.get("created_at"))
        if ts is None:
            continue
        if ts >= cutoff and (actor is None or b.get("actor") == actor):
            recent.append(b)

    out = []
    out.append(f"# Orientation — {root.resolve()}")
    out.append("")
    out.append(f"**{len(beads)} total beads** in ledger; **{len(recent)} in last {days} days**.")
    out.append("")

    # Latest bead
    if beads:
        last = beads[0]
        out.append(f"## Most recent bead")
        out.append("")
        out.append(f"- **{last.get('type')}** — *{last.get('title')}*")
        out.append(f"- actor: `{last.get('actor')}`")
        out.append(f"- created: {fmt_dt(to_datetime(last.get('created_at')))}")
        if last.get("type") == "brief" and last.get("to"):
            out.append(f"- **addressed to: `{last.get('to')}`**")
        out.append(f"- file: `{last['_path'].name}`")
        out.append("")

    # Open hooks (briefs without a closing report)
    briefs = [b for b in beads if b.get("type") == "brief" and b.get("status") == "live"]
    responded = {b.get("responding_to") for b in beads if b.get("type") == "report"}
    open_briefs = [b for b in briefs if b.get("id") not in responded]

    if open_briefs:
        out.append(f"## Open briefs ({len(open_briefs)})")
        out.append("")
        for b in open_briefs[:5]:
            out.append(f"- *{b.get('title')}* — `{b.get('to')}` — {fmt_dt(to_datetime(b.get('created_at')))}")
        out.append("")

    # Recent discoveries
    discoveries = [b for b in recent if b.get("type") == "discovery"]
    if discoveries:
        out.append(f"## Recent discoveries ({len(discoveries)})")
        out.append("")
        for b in discoveries[:5]:
            out.append(f"- *{b.get('title')}* — {fmt_dt(to_datetime(b.get('created_at')))}")
        out.append("")

    # Recent decisions
    decisions = [b for b in recent if b.get("type") == "decision"]
    if decisions:
        out.append(f"## Recent decisions ({len(decisions)})")
        out.append("")
        for b in decisions[:5]:
            out.append(f"- *{b.get('title')}* — {fmt_dt(to_datetime(b.get('created_at')))}")
        out.append("")

    # Suggested next action
    out.append("## Suggested next action")
    out.append("")
    if open_briefs:
        top = open_briefs[0]
        out.append(f"Open brief addressed to `{top.get('to')}`:")
        out.append(f"  → *{top.get('title')}*")
        out.append(f"  → read: `{top['_path'].name}`")
    else:
        out.append("No open briefs. Ask the user what to work on.")

    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path(".handoff"))
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--actor", type=str, default=None)
    args = ap.parse_args()
    print(orient(args.root, args.days, args.actor))
    return 0


if __name__ == "__main__":
    sys.exit(main())
