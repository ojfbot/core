#!/usr/bin/env python3
"""migrate-v1.py — one-shot: move a v1 selfco vault (Areas/ + Sessions/ + Decisions/) into the
v2 LLM-Wiki layout (raw/ + wiki/{sources,entities,concepts,synthesis} + index.md + log.md).

Run this BEFORE init-vault.py on an existing v1 vault. After it runs, init-vault.py fills in the
v2-specific bits it removed (.obsidian/* config, templates/*, README, .gitignore, wiki/index.md).
Idempotent: if there's no v1 structure to migrate (already done), it does nothing.

Env: SELFCO_VAULT (default ~/selfco). VAULT_SKIP_GIT=1 to skip the commit.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

TODAY = date.today().isoformat()


def vault_root() -> Path:
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def rewrite_frontmatter(text: str, repl: dict[str, str], drop_keys: list[str]) -> str:
    """Coarse line-based frontmatter rewrite within the leading --- block."""
    m = FM_RE.match(text)
    if not m:
        return text
    body = text[m.end():]
    fm_lines = m.group(1).splitlines()
    out: list[str] = []
    for line in fm_lines:
        key = line.split(":", 1)[0].strip()
        if key in drop_keys:
            continue
        if key in repl:
            out.append(repl[key])
            continue
        out.append(line)
    return "---\n" + "\n".join(out) + "\n---\n" + body


def main() -> int:
    v = vault_root()
    actions: list[str] = []

    areas_tech = v / "Areas" / "Technical"
    sessions = v / "Sessions"
    decisions = v / "Decisions"
    inbox = v / "Inbox"

    has_v1 = any(p.exists() for p in (v / "Areas", sessions, decisions, inbox, v / "Home.md"))
    if not has_v1:
        print(f"migrate-v1: nothing to migrate in {v} — already v2 (or empty). No-op.")
        return 0

    (v / "raw" / "assets").mkdir(parents=True, exist_ok=True)
    for d in ("sources", "entities", "concepts", "synthesis"):
        (v / "wiki" / d).mkdir(parents=True, exist_ok=True)

    # 1. Areas/Technical/<repo>.md (not the Technical.md index) → wiki/entities/<repo>.md
    if areas_tech.is_dir():
        for f in sorted(areas_tech.glob("*.md")):
            if f.name == "Technical.md":
                continue
            dest = v / "wiki" / "entities" / f.name
            if dest.exists():
                continue
            text = f.read_text(encoding="utf-8")
            # type: project → type: entity + kind: repo
            if re.search(r"^type:\s*project\s*$", text, re.M):
                text = re.sub(r"^type:\s*project\s*$", "type: entity\nkind: repo", text, count=1, flags=re.M)
            # tags: drop area/technical
            text = re.sub(r"(tags:\s*\[)\s*area/technical\s*,\s*", r"\1", text)
            # Up: [[Technical]] → Up: [[index]]
            text = text.replace("Up: [[Technical]]", "Up: [[index]]")
            # section rename: Overview → What it is
            text = re.sub(r"^## Overview\s*$", "## What it is", text, count=1, flags=re.M)
            dest.write_text(text, encoding="utf-8")
            actions.append(f"Areas/Technical/{f.name} → wiki/entities/{f.name}")

    # 2. Sessions/YYYY-MM-DD.md → wiki/sources/sync-YYYY-MM-DD.md
    sync_summary_bullets: list[str] = []
    if sessions.is_dir():
        for f in sorted(sessions.glob("[0-9]*.md")):
            dest = v / "wiki" / "sources" / f"sync-{f.stem}.md"
            if not dest.exists():
                text = f.read_text(encoding="utf-8")
                text = rewrite_frontmatter(
                    text,
                    repl={"type": "type: source", "date": f"ingested: {f.stem}"},
                    drop_keys=["sessions"],
                )
                text = text.replace("Up: [[Sessions]]", "Up: [[index]]")
                dest.write_text(text, encoding="utf-8")
                actions.append(f"Sessions/{f.name} → wiki/sources/sync-{f.stem}.md")
            # pull the Summary section for the log
            try:
                stext = f.read_text(encoding="utf-8")
                m = re.search(r"^## Summary\s*\n(.+?)(?:\n## |\Z)", stext, re.S | re.M)
                if m:
                    sync_summary_bullets.append(m.group(1).strip().replace("\n", " "))
            except OSError:
                pass

    # 3. Decisions/Decisions.md → wiki/synthesis/ojfbot-adrs.md
    if (decisions / "Decisions.md").is_file():
        dest = v / "wiki" / "synthesis" / "ojfbot-adrs.md"
        if not dest.exists():
            text = (decisions / "Decisions.md").read_text(encoding="utf-8")
            text = rewrite_frontmatter(text, repl={"type": "type: synthesis"}, drop_keys=[])
            text = text.replace("Up: [[Home]]", "Up: [[index]]")
            dest.write_text(text, encoding="utf-8")
            actions.append("Decisions/Decisions.md → wiki/synthesis/ojfbot-adrs.md")

    # 4. wiki/log.md — migration entry + fold the old session note's summary
    log = v / "wiki" / "log.md"
    if not log.exists():
        head = ("# selfco — log\n\nAppend-only operation ledger. `## [YYYY-MM-DD] <op> | <title>` + bullets. "
                "Never edited or reordered.\n\n")
        log.write_text(head, encoding="utf-8")
        actions.append("created wiki/log.md")
    with log.open("a", encoding="utf-8") as fh:
        fh.write(f"\n## [{TODAY}] migrate-v1 | v1 layout → LLM-Wiki layout\n")
        fh.write("- moved Areas/Technical/* → wiki/entities/* (type: entity, kind: repo)\n")
        fh.write("- moved Sessions/* → wiki/sources/sync-*.md ; Decisions/Decisions.md → wiki/synthesis/ojfbot-adrs.md\n")
        fh.write("- removed Areas/, Sessions/, Decisions/, Inbox/, Home.md, v1 templates and v1 .obsidian config (init-vault.py rewrites v2 config)\n")
        for b in sync_summary_bullets:
            fh.write(f"\n## [{TODAY}] sync | (migrated from v1 session note)\n- {b[:600]}\n")

    # 5. remove v1 cruft (kept: .obsidian/plugins/, .obsidian/appearance.json)
    for path in [v / "Areas", v / "Sessions", v / "Decisions", v / "Inbox", v / "Home.md"]:
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            actions.append(f"removed {path.relative_to(v)}")
    tdir = v / "templates"
    if tdir.is_dir():
        for old in ("home.md", "project.md", "research.md", "session.md", "decision.md"):
            p = tdir / old
            if p.exists():
                p.unlink(); actions.append(f"removed templates/{old}")
    obs = v / ".obsidian"
    for old in ("app.json", "core-plugins.json", "daily-notes.json", "templates.json", "graph.json", "community-plugins.json"):
        p = obs / old
        if p.exists():
            p.unlink(); actions.append(f"removed .obsidian/{old} (init rewrites v2)")
    for old in ("README.md", ".gitignore"):
        p = v / old
        if p.exists():
            p.unlink(); actions.append(f"removed {old} (init rewrites v2)")

    # 6. commit
    if os.environ.get("VAULT_SKIP_GIT") != "1" and (v / ".git").exists():
        try:
            subprocess.run(["git", "add", "-A"], cwd=v, check=True)
            status = subprocess.run(["git", "status", "--porcelain"], cwd=v, capture_output=True, text=True, check=True).stdout.strip()
            if status:
                subprocess.run(["git", "commit", "-q", "-m", "vault: migrate v1 layout → LLM-Wiki (raw/ + wiki/)"], cwd=v, check=True)
                actions.append("committed migration")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            actions.append(f"git commit skipped: {e}")

    print(f"migrate-v1: {v}")
    for a in actions:
        print(f"  - {a}")
    print("\nNext: run init-vault.py to write the v2 .obsidian config, templates, README, and wiki/index.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
