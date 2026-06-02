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
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

YOUTUBE_RE = re.compile(r"(?:youtube\.com/(?:watch\?|.*[?&]v=|shorts/|live/)|youtu\.be/)", re.I)


def vault_root() -> Path:
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


def slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower()).strip("-")
    return s[:80] or "source"


def _yt_meta(url: str) -> dict:
    """yt-dlp metadata for a single video (first JSON object if a playlist)."""
    out = subprocess.run(
        ["yt-dlp", "--skip-download", "--dump-json", url],
        capture_output=True, text=True, check=True,
    ).stdout
    first = next((ln for ln in out.splitlines() if ln.strip()), "")
    return json.loads(first)


def _yt_subs_text(url: str, td: str, auto: bool) -> str | None:
    """Download English captions (manual if auto=False, else auto-generated) as json3 into td,
    parse to clean deduplicated, speaker-turn-split text. None if no track was written."""
    flag = "--write-auto-subs" if auto else "--write-subs"
    subprocess.run(
        ["yt-dlp", "--skip-download", flag, "--sub-langs", "en.*,en",
         "--sub-format", "json3", "-o", str(Path(td) / "cap.%(ext)s"), url],
        capture_output=True, text=True,
    )
    files = sorted(Path(td).glob("*.json3"))
    if not files:
        return None
    data = json.loads(files[0].read_text(encoding="utf-8"))
    lines: list[str] = []
    for ev in data.get("events", []):
        segs = ev.get("segs")
        if not segs:
            continue
        txt = "".join(s.get("utf8", "") for s in segs).strip()
        if txt and (not lines or lines[-1] != txt):  # drop consecutive duplicates
            lines.append(txt)
    full = re.sub(r"\s+", " ", " ".join(lines)).strip()
    full = re.sub(r"\s*>>\s*", "\n\n>> ", full).strip()  # break on YouTube speaker-turn markers
    return full or None


def _fetch_youtube(url: str, raw: Path, slug: str | None, title: str | None, today: str):
    """YouTube-aware land step: write the transcript to raw/<slug>.md via yt-dlp.
    The generic URL path below uses curl, which fetches the watch *page*, not the captions —
    so YouTube URLs route here. Returns (raw_file, slug, title, front, err).
    Prerequisite: yt-dlp on PATH (`brew install yt-dlp`)."""
    if shutil.which("yt-dlp") is None:
        return None, slug, title, {}, {"error": "yt-dlp not found — install it: `brew install yt-dlp`"}
    try:
        meta = _yt_meta(url)
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as e:
        return None, slug, title, {}, {"error": f"yt-dlp metadata failed: {e}"}

    title = title or meta.get("title") or meta.get("id")
    slug = slug or slugify(title)
    raw_file = raw / f"{slug}.md"
    front = {"url": url, "retrieved": today}
    if raw_file.exists():  # idempotent — never re-download or overwrite
        return raw_file, slug, title, front, None

    with tempfile.TemporaryDirectory() as tdir:
        text = _yt_subs_text(url, tdir, auto=False)
        cap_type = "manual (en)"
        if not text:
            text = _yt_subs_text(url, tdir, auto=True)
            cap_type = "auto-generated (en)"
    if not text:
        return None, slug, title, {}, {
            "error": f"no English captions available for {url} (manual or auto). "
                     "A future ffmpeg+ASR fallback is not yet built."
        }

    upload = meta.get("upload_date") or ""
    published = f"{upload[:4]}-{upload[4:6]}-{upload[6:8]}" if len(upload) == 8 else upload
    dur = meta.get("duration")
    dur_str = f"{round(dur / 60)} min" if isinstance(dur, (int, float)) else "?"
    header = (
        f"# {title}\n\n"
        f"Source: {url}\n"
        f"Channel: {meta.get('uploader') or meta.get('channel') or '?'}\n"
        f"Published: {published or '?'}\n"
        f"Duration: {dur_str}\n"
        f"Captions: {cap_type}\n"
        f"Transcript captured: {today}\n\n"
        f"---\n\n"
    )
    raw_file.write_text(header + text + "\n", encoding="utf-8")
    return raw_file, slug, title, front, None


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
    if is_url and YOUTUBE_RE.search(src):
        raw_file, slug, title, front, err = _fetch_youtube(src, raw, slug, title, today)
        if err:
            print(json.dumps(err)); return 1
    elif is_url:
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
