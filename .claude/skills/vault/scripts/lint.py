#!/usr/bin/env python3
"""lint.py — deterministic health-check for the selfco LLM Wiki. Read-only; prints a report.

Checks: orphan wiki pages (no inbound [[link]] from another wiki page), broken [[links]] (target
page doesn't exist), raw/ items with no wiki/sources/ page that references them. The semantic part
of /vault lint (contradictions, stale claims, missing cross-refs) is done by the LLM, not here.

With `--stale` (ADR-0080): also reports graph-aware stale pages — pages in entities/concepts/
synthesis that are orphans (zero non-index inbound), haven't been git-edited in --days
(default 90), and aren't `wiki/log.md`-mentioned outside their creation entry. Excludes pages
whose frontmatter has `category: reference-data` (class-level: Landsat/ERA5-style reference
entities collectively) or `staleness: ignore` (page-level operator override). Surface-only —
never moves, never deletes.

Vault root: positional argument, or $SELFCO_VAULT, or ~/selfco. A path ending in /wiki is
accepted as a convenience (vault root inferred). Exit 0 always (it's a report).
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time
from pathlib import Path

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
LOG_HEADER_RE = re.compile(r"^## \[(\d{4}-\d{2}-\d{2})\]\s+(\w+)\b")

STALE_TYPES = ("entities", "concepts", "synthesis")


def strip_noise(text: str) -> str:
    """Drop HTML comments, fenced code blocks, and inline `code` spans — links/placeholders
    inside them aren't real (e.g. a doc explaining the `[[entities/<repo>]]` convention)."""
    return INLINE_CODE_RE.sub("", FENCE_RE.sub("", HTML_COMMENT_RE.sub("", text)))


def parse_frontmatter(text: str) -> dict[str, object]:
    """Minimal YAML frontmatter parser — handles flat scalars and inline `[a, b]` lists.
    Enough for our schema (tags, kind, status, category, staleness); a full YAML parser
    is unnecessary deps weight for the keys we actually read."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    fm: dict[str, object] = {}
    for line in m.group(1).splitlines():
        line = line.rstrip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            fm[key] = [x.strip().strip("\"'") for x in val[1:-1].split(",") if x.strip()]
        elif val:
            fm[key] = val.strip("\"'")
    return fm


def resolve_vault_root(arg: str | None) -> Path:
    """Vault root from CLI arg, $SELFCO_VAULT, or ~/selfco. Accepts <root>/wiki for caller
    convenience (the shell wrapper passes that)."""
    if arg:
        p = Path(arg).expanduser().resolve()
        if p.name == "wiki" and (p.parent / "raw").is_dir():
            return p.parent
        return p
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


def git_age_days(page: Path, vault: Path) -> int | None:
    """Days since the most recent git commit touching this file. None if not in a git repo
    or the file has no commit history yet (treat as not-stale either way)."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct", "--", str(page.relative_to(vault))],
            cwd=vault,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return None
        last_ts = int(result.stdout.strip())
        return int((time.time() - last_ts) // 86400)
    except (FileNotFoundError, ValueError):
        return None


def log_section_dates(slug: str, log_text: str) -> list[str]:
    """Section dates (YYYY-MM-DD) of every `## [date] op …` block whose body mentions slug."""
    found: list[str] = []
    current_section: str | None = None
    current_mentions: bool = False
    for line in log_text.splitlines():
        m = LOG_HEADER_RE.match(line)
        if m:
            if current_section is not None and current_mentions:
                found.append(current_section)
            current_section = f"{m.group(1)} ({m.group(2)})"
            current_mentions = False
        elif current_section is not None and slug in line:
            current_mentions = True
    if current_section is not None and current_mentions:
        found.append(current_section)
    return found


def page_type(page: Path) -> str | None:
    """Return the page's folder type ('entities'/'concepts'/'synthesis'/'sources') or None."""
    for part in page.parts:
        if part in STALE_TYPES + ("sources",):
            return part
    return None


def is_stale(
    page: Path, non_index_inbound: int, days: int, log_text: str, vault: Path
) -> tuple[bool, str | None, int | None, str | None]:
    """The ADR-0080 predicate. Returns (is_stale, hint, age_days, last_log_section)."""
    if page_type(page) not in STALE_TYPES:
        return False, None, None, None

    text = page.read_text(encoding="utf-8", errors="ignore")
    fm = parse_frontmatter(text)

    # Escape hatches: class-level (category: reference-data) and page-level (staleness: ignore)
    if fm.get("staleness") == "ignore":
        return False, None, None, None
    tags = fm.get("tags") or []
    if fm.get("category") == "reference-data" or (isinstance(tags, list) and "reference-data" in tags):
        return False, None, None, None

    # (predicate condition 2) Zero non-index inbound — caller passes 0 for orphans
    if non_index_inbound > 0:
        return False, None, None, None

    # (3) No git edits in N days
    age = git_age_days(page, vault)
    if age is None or age < days:
        return False, None, age, None

    # (4) Not log-mentioned in any section beyond the creation entry
    slug = page.stem
    mentions = log_section_dates(slug, log_text)
    if len(mentions) > 1:
        return False, None, age, None

    last_log = mentions[0] if mentions else None

    # Hint: reference-data candidate (kind: product with [[sources/...]]) → archive default
    kind = fm.get("kind")
    if kind == "product" and re.search(r"\[\[sources/[^\]]+\]\]", text):
        hint = "reference-data candidate"
    else:
        hint = "consider archive"

    return True, hint, age, last_log


def main() -> int:
    ap = argparse.ArgumentParser(
        description="lint.py — selfco vault health check (ADR-0069); --stale per ADR-0080",
    )
    ap.add_argument(
        "path",
        nargs="?",
        help="Vault root or wiki/ dir. Default: $SELFCO_VAULT or ~/selfco",
    )
    ap.add_argument(
        "--stale",
        action="store_true",
        help="Also report stale pages (ADR-0080: orphan ∧ no edits in --days ∧ not log-mentioned since creation)",
    )
    ap.add_argument(
        "--days",
        type=int,
        default=90,
        help="Staleness threshold in days (default 90). Per ADR-0080: tighten to 60 if 0 flagged; loosen to 180 if >25.",
    )
    args = ap.parse_args()

    v = resolve_vault_root(args.path)
    wiki = v / "wiki"
    raw = v / "raw"
    if not wiki.is_dir():
        print(f"lint: {v} has no wiki/ — run /vault init first.", file=sys.stderr)
        return 0

    pages: dict[str, Path] = {}      # stem (and folder/stem) → path
    for p in wiki.rglob("*.md"):
        rel = p.relative_to(wiki)
        pages[p.stem] = p
        pages[str(rel.with_suffix("")).replace(os.sep, "/")] = p  # e.g. "sources/foo"

    inbound: dict[str, int] = {p.stem: 0 for p in wiki.rglob("*.md")}
    # Per ADR-0080 §(2): the staleness predicate uses inbound excluding index.md (every
    # page is reachable from index by schema requirement; that's not real demand).
    inbound_non_index: dict[str, int] = {p.stem: 0 for p in wiki.rglob("*.md")}
    broken: list[tuple[str, str]] = []  # (source page rel, missing target)

    for p in wiki.rglob("*.md"):
        text = strip_noise(p.read_text(encoding="utf-8", errors="ignore"))
        is_index = p.name == "index.md"
        for m in WIKILINK_RE.finditer(text):
            target = m.group(1).strip()
            key = target.split("/")[-1]
            if target in pages or key in pages:
                inbound[key] = inbound.get(key, 0) + 1
                if not is_index:
                    inbound_non_index[key] = inbound_non_index.get(key, 0) + 1
            elif p.name != "log.md":  # log.md is an append-only ledger; historical entries may name renamed/removed pages
                broken.append((str(p.relative_to(v)), target))

    orphans = [p for p in wiki.rglob("*.md")
               if p.name not in ("index.md", "log.md") and inbound.get(p.stem, 0) == 0]

    # raw/ items not referenced by any wiki/sources/ page
    raw_items: list[Path] = []
    if raw.is_dir():
        for p in raw.rglob("*"):
            if p.is_file() and "assets" not in p.parts:
                raw_items.append(p)
    referenced_raw: set[str] = set()
    for sp in (wiki / "sources").rglob("*.md") if (wiki / "sources").is_dir() else []:
        t = sp.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"raw/[\w./\-]+", t):
            referenced_raw.add(m.group(0))
    raw_unprocessed = [p for p in raw_items
                       if f"raw/{p.relative_to(raw)}" not in referenced_raw]

    print(f"lint: {v}/wiki  ({len(list(wiki.rglob('*.md')))} pages)\n")
    print(f"== orphan pages (no inbound [[link]]): {len(orphans)} ==")
    for p in orphans:
        print(f"  - {p.relative_to(v)}")
    print(f"\n== broken [[links]]: {len(broken)} ==")
    for src, tgt in broken:
        print(f"  - {src} → [[{tgt}]]")
    print(f"\n== raw/ items with no wiki/sources/ page: {len(raw_unprocessed)} ==")
    for p in raw_unprocessed:
        print(f"  - raw/{p.relative_to(raw)}")

    # --stale: ADR-0080. Layered on top of the orphan check — every stale page is an
    # orphan; not every orphan is stale (new pages have a grace period via the
    # --days threshold + log.md mention).
    if args.stale:
        log_path = wiki / "log.md"
        log_text = log_path.read_text(encoding="utf-8", errors="ignore") if log_path.is_file() else ""

        rows: list[tuple[Path, str, int, str | None]] = []
        for p in wiki.rglob("*.md"):
            stale, hint, age, last_log = is_stale(
                p, inbound_non_index.get(p.stem, 0), args.days, log_text, v
            )
            if stale:
                rows.append((p, hint or "consider archive", age or 0, last_log))

        print(f"\n== stale pages (per ADR-0080, --days={args.days}): {len(rows)} ==")
        if rows:
            print()
            print("| Page | Age | Inbound | Last log | Hint |")
            print("|---|---|---|---|---|")
            for page, hint, age, last_log in sorted(rows, key=lambda r: -r[2]):
                print(f"| {page.relative_to(v)} | {age}d | 0 | {last_log or '—'} | {hint} |")
        print(
            "\n(Stale = type ∈ {entities,concepts,synthesis} ∧ zero non-index inbound ∧ "
            "no git edits in --days ∧ ≤1 log.md section mentions it. Surface-only — never "
            "destructive. Escape hatches: `category: reference-data` (class) or "
            "`staleness: ignore` (page). See ADR-0079 / ADR-0080.)"
        )

    print("\n(Semantic checks — contradictions, stale claims, missing cross-refs — are the LLM's job; "
          "see /vault lint.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
