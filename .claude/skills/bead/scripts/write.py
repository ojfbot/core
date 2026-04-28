#!/usr/bin/env python3
"""
Scaffold a new bead from template.

Usage:
    python write.py <type> --title TITLE [--actor ACTOR] [--to RECIPIENT]
                            [--hook HOOK] [--responding-to BEAD_ID]
                            [--root PATH] [--project NAME]
                            [--supersedes BEAD_ID]

Type is one of: brief | report | decision | discovery
"""
from __future__ import annotations
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATES = SKILL_DIR / "templates"
VALID_TYPES = ("brief", "report", "decision", "discovery")


def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:50]


def make_id(bead_type: str, title: str, when: datetime) -> str:
    return f"{when:%Y%m%d-%H%M}-{bead_type}-{slugify(title)}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("bead_type", choices=VALID_TYPES)
    ap.add_argument("--title", required=True)
    ap.add_argument("--actor", default="chat-claude")
    ap.add_argument("--to", default="")
    ap.add_argument("--hook", default="")
    ap.add_argument("--responding-to", default="")
    ap.add_argument("--supersedes", default="")
    ap.add_argument("--root", type=Path, default=Path(".handoff"))
    ap.add_argument("--project", default="")
    args = ap.parse_args()

    when = datetime.now(timezone.utc).replace(microsecond=0)
    bead_id = make_id(args.bead_type, args.title, when)
    session_id = when.isoformat().replace("+00:00", "Z")

    template_path = TEMPLATES / f"{args.bead_type}.md"
    if not template_path.exists():
        sys.exit(f"Template not found: {template_path}")

    text = template_path.read_text(encoding="utf-8")
    text = text.format(
        id=bead_id,
        title=args.title,
        actor=args.actor,
        to=args.to or "TODO",
        hook=args.hook or "null",
        responding_to=args.responding_to or "null",
        session_id=session_id,
        created_at=session_id,
        project=args.project or "TODO",
    )

    # Inject `supersedes` for decisions if provided
    if args.bead_type == "decision" and args.supersedes:
        text = text.replace("status: live\n", f"supersedes: {args.supersedes}\nstatus: live\n")

    args.root.mkdir(parents=True, exist_ok=True)
    out_path = args.root / f"{bead_id}.md"
    if out_path.exists():
        sys.exit(f"Bead already exists: {out_path}")
    out_path.write_text(text, encoding="utf-8")
    print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
