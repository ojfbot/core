#!/usr/bin/env python3
"""
Normalize-on-read shim for `.handoff/` beads.

The markdown bead ledger is append-only (see references/session-protocol.md), so we
must NEVER rewrite beads to fix schema drift. Instead this module canonicalizes beads
*as they are read*, so any consumer (orient.py, replay.py, the /resume reconstructor)
sees one stable shape regardless of how a given bead was written.

Observed drift in the wild (verified against core/.handoff/):
  - `status: open`            → not in the documented enum (live|closed|superseded)
  - `date:` instead of `created_at:`
  - missing `created_at` entirely → must be derived from id / filename
  - `actor: code-claude (the ... session)` → parenthetical commentary on the actor
  - `hooks:` (list of prose strings) instead of `hook:` (a single hook-id or null)
  - three filename styles: `YYYYMMDD-HHMM-type-slug.md`, `YYYYMMDD-type-slug.md`,
    `YYYY-MM-DD-slug.md`
  - Dolt-world status values (created|active|done|archived|cancelled) leaking into
    markdown when a bead is hand-copied from a queried Dolt bead

Anything that cannot be parsed at all is surfaced as a visible DRIFT record rather than
silently dropped — the whole point of /resume is that we never pretend a bead said
something it didn't.

Usage (CLI / inspection):
    python normalize.py [--root .handoff] [--json] [--drift-only]

Importable API:
    from normalize import parse_and_normalize, normalize_bead, load_normalized
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date as _date
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("normalize.py requires PyYAML (pip install pyyaml)")

BEAD_FRONTMATTER_RE = re.compile(r"^---\n(.+?)\n---\n?(.*)", re.DOTALL)

# Canonical statuses, and how the drifted / Dolt-world values map onto them.
CANONICAL_STATUS = {"live", "closed", "superseded"}
STATUS_ALIASES = {
    "open": "live",
    "created": "live",
    "active": "live",
    "in_progress": "live",
    "in-progress": "live",
    "done": "closed",
    "complete": "closed",
    "completed": "closed",
    "resolved": "closed",
    "archived": "closed",
    "cancelled": "closed",
    "canceled": "closed",
}

BEAD_TYPES = {"brief", "report", "decision", "discovery"}

# A hook-id looks like a short slug / id, not a prose sentence. Used to decide whether a
# stray `hooks:` list entry is salvageable as a hook reference or is just commentary.
HOOK_ID_RE = re.compile(r"^[A-Za-z0-9][\w.\-:/#]{0,63}$")

# Leading date in a filename: 20260613-1959-..., 20260618-..., or 2026-06-13-...
FILENAME_DATE_RE = re.compile(r"^(\d{4})-?(\d{2})-?(\d{2})(?:-(\d{2})(\d{2}))?")
# Leading date in an id field: 20260613-1959-type-slug
ID_DATE_RE = re.compile(r"^(\d{4})(\d{2})(\d{2})(?:-(\d{2})(\d{2}))?")


def _to_iso(value) -> str | None:
    """Coerce a datetime / date / string into an ISO-8601 UTC string, or None."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(value, _date):
        return f"{value.isoformat()}T00:00:00Z"
    if isinstance(value, str):
        s = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            return None
    return None


def _date_from_match(m: "re.Match | None") -> str | None:
    if not m:
        return None
    y, mo, d = m.group(1), m.group(2), m.group(3)
    hh = m.group(4) or "00"
    mm = m.group(5) or "00"
    return f"{y}-{mo}-{d}T{hh}:{mm}:00Z"


def normalize_status(value, drift: list[str]) -> str:
    if value is None:
        drift.append("status missing → assumed 'live'")
        return "live"
    s = str(value).strip().lower()
    if s in CANONICAL_STATUS:
        return s
    if s in STATUS_ALIASES:
        mapped = STATUS_ALIASES[s]
        drift.append(f"status '{value}' → '{mapped}'")
        return mapped
    drift.append(f"status '{value}' not in enum → kept verbatim")
    return s


def normalize_actor(value, drift: list[str]) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    # Strip parenthetical commentary: "code-claude (the /vault session)" → "code-claude"
    if "(" in s:
        head = s.split("(", 1)[0].strip()
        drift.append(f"actor commentary stripped: '{s}' → '{head}'")
        s = head
    return s or None


def normalize_refs(value, drift: list[str]) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        drift.append("refs was a scalar → wrapped in a list")
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        return [str(r).strip() for r in value if str(r).strip()]
    drift.append(f"refs had unexpected type {type(value).__name__} → coerced to []")
    return []


def normalize_hook(raw: dict, drift: list[str]):
    """Return (hook, extra_hooks). `hook` is a single id or None; any non-id `hooks:`
    prose entries are preserved separately so nothing is lost, but they never masquerade
    as a hook assignment."""
    hook = raw.get("hook")
    if hook is not None:
        hook = str(hook).strip()
        return (hook or None, [])

    hooks = raw.get("hooks")
    if hooks is None:
        return (None, [])
    if isinstance(hooks, str):
        hooks = [hooks]
    if not isinstance(hooks, list):
        drift.append(f"hooks had unexpected type {type(hooks).__name__} → ignored")
        return (None, [])

    ids = [h for h in (str(x).strip() for x in hooks) if HOOK_ID_RE.match(h)]
    prose = [str(x).strip() for x in hooks if not HOOK_ID_RE.match(str(x).strip())]
    if ids:
        drift.append(f"'hooks' list → hook='{ids[0]}'" + (f" (+{len(ids)-1} more)" if len(ids) > 1 else ""))
        return (ids[0], ids[1:] + prose)
    drift.append("'hooks' list held prose, not hook-ids → hook=None, preserved as notes")
    return (None, prose)


def derive_created_at(raw: dict, path: Path | None, drift: list[str]) -> str | None:
    # 1. created_at, if present and parseable
    iso = _to_iso(raw.get("created_at"))
    if iso:
        return iso
    # 2. `date:` drift
    if raw.get("created_at") in (None, "") and raw.get("date") is not None:
        iso = _to_iso(raw.get("date"))
        if iso:
            drift.append("created_at derived from 'date' field")
            return iso
    # 3. from id
    bead_id = raw.get("id")
    if bead_id:
        iso = _date_from_match(ID_DATE_RE.match(str(bead_id)))
        if iso:
            drift.append("created_at derived from id")
            return iso
    # 4. from filename
    if path is not None:
        iso = _date_from_match(FILENAME_DATE_RE.match(path.name))
        if iso:
            drift.append("created_at derived from filename")
            return iso
    drift.append("created_at could not be derived")
    return None


def normalize_bead(raw: dict, path: Path | None = None) -> dict:
    """Canonicalize a parsed bead frontmatter dict. Never mutates the input.
    Returns a new dict with stable keys plus `_drift` (list of fix notes) and
    `_path` (filename, if known)."""
    drift: list[str] = []
    raw = dict(raw or {})

    btype = raw.get("type")
    if btype not in BEAD_TYPES:
        drift.append(f"type '{btype}' not a known bead type")

    hook, extra_hooks = normalize_hook(raw, drift)

    out = {
        "id": (str(raw["id"]).strip() if raw.get("id") else None),
        "type": btype,
        "title": raw.get("title"),
        "actor": normalize_actor(raw.get("actor"), drift),
        "session_id": (str(raw["session_id"]).strip() if raw.get("session_id") else None),
        "refs": normalize_refs(raw.get("refs"), drift),
        "hook": hook,
        "status": normalize_status(raw.get("status"), drift),
        "created_at": derive_created_at(raw, path, drift),
        "labels": raw.get("labels") if isinstance(raw.get("labels"), dict) else {},
    }
    # Type-specific carry-throughs.
    for k in ("to", "responding_to", "supersedes"):
        if raw.get(k) is not None:
            out[k] = raw.get(k)
    if extra_hooks:
        out["extra_hooks"] = extra_hooks

    # Derive id from filename if missing, so downstream joins have a stable key.
    if out["id"] is None and path is not None:
        out["id"] = path.stem
        drift.append("id missing → derived from filename stem")

    out["_drift"] = drift
    if path is not None:
        out["_path"] = path.name
    return out


def parse_and_normalize(path: Path) -> dict:
    """Read a bead file and return its normalized form. On a parse failure, return a
    visible DRIFT record (never raise, never silently skip)."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        return {"_unparseable": True, "_path": path.name, "_drift": [f"unreadable: {e}"]}

    m = BEAD_FRONTMATTER_RE.match(text)
    if not m:
        return {"_unparseable": True, "_path": path.name, "_drift": ["no YAML frontmatter block"]}
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        return {"_unparseable": True, "_path": path.name, "_drift": [f"YAML error: {e}"]}
    if not isinstance(fm, dict):
        return {"_unparseable": True, "_path": path.name, "_drift": ["frontmatter is not a mapping"]}

    bead = normalize_bead(fm, path)
    bead["_body"] = m.group(2).lstrip()
    return bead


def load_normalized(root: Path) -> list[dict]:
    """Load and normalize every bead under `root`. Includes DRIFT records for files that
    couldn't be parsed, so callers can surface them."""
    if not root.exists():
        return []
    beads = []
    for p in sorted(root.glob("*.md")):
        if p.name == "README.md":
            continue
        beads.append(parse_and_normalize(p))
    return beads


def _strip_private(bead: dict) -> dict:
    return {k: v for k, v in bead.items() if k != "_body"}


def main() -> int:
    ap = argparse.ArgumentParser(description="Normalize .handoff/ beads on read.")
    ap.add_argument("--root", type=Path, default=Path(".handoff"))
    ap.add_argument("--json", action="store_true", help="emit normalized beads as JSON")
    ap.add_argument("--drift-only", action="store_true", help="only show beads that needed fixes")
    args = ap.parse_args()

    beads = load_normalized(args.root)
    if args.drift_only:
        beads = [b for b in beads if b.get("_drift") or b.get("_unparseable")]

    if args.json:
        print(json.dumps([_strip_private(b) for b in beads], indent=2, default=str))
        return 0

    if not beads:
        print(f"No beads (or none with drift) in {args.root}.")
        return 0

    drift_count = sum(1 for b in beads if b.get("_drift"))
    unparseable = sum(1 for b in beads if b.get("_unparseable"))
    print(f"# Normalize report — {args.root.resolve()}")
    print(f"\n{len(beads)} beads · {drift_count} needed fixes · {unparseable} unparseable\n")
    for b in beads:
        if b.get("_unparseable"):
            print(f"⚠ DRIFT  {b.get('_path')} — {'; '.join(b.get('_drift', []))}")
            continue
        if b.get("_drift"):
            print(f"~ FIXED  {b.get('_path')} [{b.get('type')}/{b.get('status')}]")
            for d in b["_drift"]:
                print(f"           · {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
