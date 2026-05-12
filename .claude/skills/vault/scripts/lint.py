#!/usr/bin/env python3
"""lint.py — deterministic health-check for the selfco LLM Wiki. Read-only; prints a report.

Checks: orphan wiki pages (no inbound [[link]] from another wiki page), broken [[links]] (target
page doesn't exist), raw/ items with no wiki/sources/ page that references them. The semantic part
of /vault lint (contradictions, stale claims, missing cross-refs) is done by the LLM, not here.

Env: SELFCO_VAULT (default ~/selfco). Exit 0 always (it's a report).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def strip_noise(text: str) -> str:
    """Drop HTML comments, fenced code blocks, and inline `code` spans — links/placeholders
    inside them aren't real (e.g. a doc explaining the `[[entities/<repo>]]` convention)."""
    return INLINE_CODE_RE.sub("", FENCE_RE.sub("", HTML_COMMENT_RE.sub("", text)))


def vault_root() -> Path:
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


def main() -> int:
    v = vault_root()
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
    broken: list[tuple[str, str]] = []  # (source page rel, missing target)

    for p in wiki.rglob("*.md"):
        text = strip_noise(p.read_text(encoding="utf-8", errors="ignore"))
        for m in WIKILINK_RE.finditer(text):
            target = m.group(1).strip()
            key = target.split("/")[-1]
            if target in pages or key in pages:
                inbound[key] = inbound.get(key, 0) + 1
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
    print("\n(Semantic checks — contradictions, stale claims, missing cross-refs — are the LLM's job; "
          "see /vault lint.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
