#!/usr/bin/env python3
"""ingest.py — helper for `/vault ingest <url-or-path>`: land a source in raw/ and stub its source page.

Downloads a URL (or copies a local file) into ~/selfco/raw/, and creates a minimal
~/selfco/wiki/sources/<slug>.md stub for the LLM to fill. Prints the slug + paths as JSON on stdout.

Does NOT do summarization — that's the LLM's job. Does NOT touch index.md / log.md / entity pages.

Usage: ingest.py <url-or-path> [--slug <slug>] [--title <title>]
Env: SELFCO_VAULT (default ~/selfco)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


def vault_root() -> Path:
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


def slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower()).strip("-")
    return s[:80] or "source"


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: ingest.py <url-or-path> [--slug S] [--title T]", file=sys.stderr); return 2
    src = argv[0]
    slug = title = None
    i = 1
    while i < len(argv):
        if argv[i] == "--slug" and i + 1 < len(argv):
            slug = slugify(argv[i + 1]); i += 2
        elif argv[i] == "--title" and i + 1 < len(argv):
            title = argv[i + 1]; i += 2
        else:
            i += 1

    v = vault_root()
    raw = v / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    (raw / "assets").mkdir(exist_ok=True)
    (v / "wiki" / "sources").mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()

    is_url = bool(urlparse(src).scheme in ("http", "https"))
    front = {}
    if is_url:
        path = urlparse(src).path
        base = Path(path).name or urlparse(src).netloc
        if not slug:
            slug = slugify(Path(base).stem or urlparse(src).netloc)
        is_pdf = path.lower().endswith(".pdf")
        if is_pdf:
            asset = raw / "assets" / f"{slug}.pdf"
            try:
                subprocess.run(["curl", "-fsSL", src, "-o", str(asset)], check=True)
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print(json.dumps({"error": f"download failed: {e}"})); return 1
            raw_file = raw / f"{slug}.md"
            if not raw_file.exists():
                raw_file.write_text(f"# {title or slug}\n\nSource: {src}\nDownloaded PDF: `raw/assets/{slug}.pdf`\n", encoding="utf-8")
            front = {"url": src, "retrieved": today}
        else:
            raw_file = raw / f"{slug}.md"
            if not raw_file.exists():
                try:
                    out = subprocess.run(["curl", "-fsSL", src], capture_output=True, text=True, check=True).stdout
                except (subprocess.CalledProcessError, FileNotFoundError) as e:
                    print(json.dumps({"error": f"download failed: {e}"})); return 1
                raw_file.write_text(f"<!-- ingested from {src} on {today} -->\n\n{out}", encoding="utf-8")
            front = {"url": src, "retrieved": today}
    else:
        p = Path(src).expanduser()
        if not p.is_file():
            print(json.dumps({"error": f"not a file: {p}"})); return 1
        if not slug:
            slug = slugify(p.stem)
        if p.suffix.lower() in (".md", ".txt", ""):
            raw_file = raw / f"{slug}{p.suffix or '.md'}"
            if not raw_file.exists():
                shutil.copy2(p, raw_file)
            front = {"raw": f"raw/{raw_file.name}"}
        else:
            asset = raw / "assets" / p.name
            if not asset.exists():
                shutil.copy2(p, asset)
            raw_file = raw / f"{slug}.md"
            if not raw_file.exists():
                raw_file.write_text(f"# {title or slug}\n\nCopied file: `raw/assets/{p.name}`\n", encoding="utf-8")
            front = {"raw": f"raw/assets/{p.name}"}

    # stub the source page (only if missing)
    src_page = v / "wiki" / "sources" / f"{slug}.md"
    if not src_page.exists():
        fm = ["---", "type: source"]
        for k, val in front.items():
            fm.append(f"{k}: {val}")
        fm += [f"ingested: {today}", "tags: []", "---", ""]
        body = (f"# {title or slug}\n\nUp: [[index]]\n\n"
                "## TL;DR\n<!-- fill: 2–4 sentences -->\n\n"
                "## Key takeaways\n<!-- - -->\n\n"
                "## Notable quotes / data\n\n"
                "## Touched pages\n<!-- - [[entities/...]] / [[concepts/...]] -->\n")
        src_page.write_text("\n".join(fm) + body, encoding="utf-8")

    print(json.dumps({
        "slug": slug,
        "raw": str(raw_file.relative_to(v)),
        "source_page": str(src_page.relative_to(v)),
        "source_page_exists": src_page.exists(),
        "note": "raw/ file landed; source page stubbed. Now: read raw/, discuss takeaways, fill the source page, "
                "update entity/concept pages + wiki/index.md, append a `## [date] ingest | <title>` to wiki/log.md.",
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
