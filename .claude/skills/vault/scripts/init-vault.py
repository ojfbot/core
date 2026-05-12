#!/usr/bin/env python3
"""init-vault.py — idempotently scaffold the `selfco` LLM Wiki (Karpathy pattern).

Creates raw/ + wiki/{sources,entities,concepts,synthesis} + wiki/index.md + wiki/log.md,
writes the in-vault CLAUDE.md (the schema, from templates/vault-claude-md.md), writes .obsidian/
config (path-keyed graph.json, community-plugins.json, templates), README, .gitignore, copies the
page templates, git-inits, fetches the Obsidian plugins (install-obsidian-plugins.sh), and seeds a
wiki/entities/<repo>.md stub (kind: repo) for every ~/ojfbot/*/.git repo (skips linked worktrees).

Safe to run repeatedly: only creates what's missing; never overwrites an existing page or .obsidian/*
file; never deletes. The one exception is the auto-managed block inside wiki/index.md (the repo-entities
list), which is regenerated each run.

Env: SELFCO_VAULT (default ~/selfco), OJFBOT_ROOT (derived; fallback ~/ojfbot),
     VAULT_SKIP_PLUGINS=1, VAULT_SKIP_GIT=1
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
TEMPLATES_SRC = SKILL / "templates"
PAGE_TEMPLATES = ["source.md", "entity.md", "concept.md", "synthesis.md"]
SCHEMA_TEMPLATE = TEMPLATES_SRC / "vault-claude-md.md"

AUTO_START = "<!-- vault:auto-repos:start -->"
AUTO_END = "<!-- vault:auto-repos:end -->"

created: list[str] = []
skipped: list[str] = []
warnings: list[str] = []


def vault_root() -> Path:
    return Path(os.environ.get("SELFCO_VAULT", str(Path.home() / "selfco"))).expanduser()


def ojfbot_root() -> Path:
    env = os.environ.get("OJFBOT_ROOT")
    if env:
        return Path(env).expanduser()
    try:
        cand = HERE.parents[4]  # scripts→vault→skills→.claude→<core or worktree>→ojfbot
        if (cand / "core").is_dir():
            return cand
    except IndexError:
        pass
    return Path.home() / "ojfbot"


def write_if_missing(path: Path, content: str) -> None:
    if path.exists():
        skipped.append(str(path)); return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    created.append(str(path))


def write_json_if_missing(path: Path, obj) -> None:
    write_if_missing(path, json.dumps(obj, indent=2) + "\n")


# ------------------------------------------------------------------ repos / ports
PORT_RE = re.compile(r"\b([3-9]\d{3})\b")


def parse_ports(repo_dir: Path) -> list[int]:
    cm = repo_dir / "CLAUDE.md"
    if not cm.is_file():
        return []
    ports: list[int] = []
    try:
        for line in cm.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "port" not in line.lower():
                continue
            for m in PORT_RE.findall(line):
                n = int(m)
                if 3000 <= n <= 9999 and n not in ports:
                    ports.append(n)
            if len(ports) >= 4:
                break
    except OSError:
        return []
    return ports[:4]


def discover_repos(root: Path) -> list[tuple[str, Path]]:
    out: list[tuple[str, Path]] = []
    if not root.is_dir():
        warnings.append(f"ojfbot root not found: {root}"); return out
    for child in sorted(root.iterdir()):
        # `.git` dir = real repo; `.git` file = linked worktree — skip worktrees
        if child.is_dir() and (child / ".git").is_dir():
            out.append((child.name, child))
    return out


# ------------------------------------------------------------------ page bodies
def repo_entity_stub(slug: str, ports: list[int], today: str) -> str:
    return f"""---
type: entity
kind: repo
repo: {slug}
ports: {json.dumps(ports)}
status: unstarted
last_synced:
created: {today}
tags: [repo/{slug}, status/unstarted]
---

# {slug}

Up: [[index]]

## What it is
<!-- one paragraph — pulled from the repo's CLAUDE.md by /vault sync -->

## Current state
<!-- filled by /vault sync from git/telemetry/beads -->

## Relationships
<!-- - [[...]] — builds on / consumes / part of -->

## Sources
<!-- - [[sources/sync-YYYY-MM-DD]] -->

## Open threads
<!-- - unfinished things, pending decisions, known bugs -->
"""


def index_seed(repos: list[str]) -> str:
    auto = AUTO_START + "\n" + "\n".join(f"- [[{r}]]" for r in repos) + "\n" + AUTO_END
    return f"""---
type: index
---

# selfco — index

The master catalog of this LLM Wiki. Every page in `wiki/` is reachable from here. See `CLAUDE.md` (in this
folder) for the schema. Maintained by `/vault` (ojfbot/core) — or follow `CLAUDE.md` directly.

## Entities — ojfbot repos
{auto}

## Entities — people / orgs / products / tools
<!-- linked as they're ingested -->

## Concepts
<!-- linked as they're ingested -->

## Synthesis
<!-- linked as they're written -->

## Sources
<!-- linked as they're ingested; sync-YYYY-MM-DD pages live here too -->

## ojfbot ADRs
<!-- see [[ojfbot-adrs]] (refreshed by /vault sync) -->
"""


def refresh_index_auto_block(path: Path, repos: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    if AUTO_START not in text or AUTO_END not in text:
        return
    new_block = AUTO_START + "\n" + "\n".join(f"- [[{r}]]" for r in repos) + "\n" + AUTO_END
    updated = re.sub(re.escape(AUTO_START) + r".*?" + re.escape(AUTO_END), lambda _: new_block, text, flags=re.DOTALL)
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        created.append(str(path) + " (refreshed repo list)")


# ------------------------------------------------------------------ .obsidian config
GRAPH_JSON = {
    "collapse-filter": True, "search": "", "showTags": True, "showAttachments": False,
    "hideUnresolved": True, "showOrphans": True, "collapse-color-groups": False,
    "colorGroups": [
        {"query": "path:wiki/entities", "color": {"a": 1, "rgb": 5431378}},
        {"query": "path:wiki/concepts", "color": {"a": 1, "rgb": 14701138}},
        {"query": "path:wiki/sources", "color": {"a": 1, "rgb": 5419488}},
        {"query": "path:wiki/synthesis", "color": {"a": 1, "rgb": 14064173}},
        {"query": "path:raw", "color": {"a": 1, "rgb": 7506394}},
        {"query": "tag:#status/active", "color": {"a": 1, "rgb": 11657298}},
    ],
    "collapse-display": False, "showArrow": False, "textFadeMultiplier": 0,
    "nodeSizeMultiplier": 1.8, "lineSizeMultiplier": 1,
    "collapse-forces": False, "centerStrength": 0.3, "repelStrength": 9,
    "linkStrength": 1, "linkDistance": 160, "scale": 1,
}
CORE_PLUGINS = {
    "file-explorer": True, "global-search": True, "switcher": True, "graph": True,
    "backlink": True, "outgoing-link": True, "tag-pane": True, "page-preview": True,
    "templates": True, "outline": True, "word-count": True, "file-recovery": True,
    "markdown-importer": True,
}
# .obsidian/community-plugins.json holds the *enabled* plugin list. We deliberately leave it
# EMPTY: install-obsidian-plugins.sh downloads the plugin *code* into .obsidian/plugins/, but the
# user enables what they want from Settings → Community plugins — that path version-checks each
# plugin against the installed Obsidian (auto-enabling a plugin whose minAppVersion exceeds the app,
# e.g. Excalidraw needing 1.5.7 on a 1.5.3 install, crashes the renderer on vault open).
COMMUNITY_PLUGINS_ENABLED: list[str] = []
GITIGNORE = """\
.obsidian/workspace
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/
.obsidian/cache
.trash/
raw/assets/*.tmp
*.tmp
.DS_Store
"""


def readme(today: str) -> str:
    return f"""# selfco — an LLM Wiki

A personal knowledge base following Andrej Karpathy's **LLM Wiki** pattern
(<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>): _"Obsidian is the IDE; the LLM is the
programmer; the wiki is the codebase."_ You curate raw material; the LLM owns and maintains `wiki/`.

- **`CLAUDE.md`** (this folder) — the schema / operating manual. Read it.
- **`raw/`** — append-only, immutable source materials. Read by the LLM, never edited.
- **`wiki/`** — LLM-owned: `index.md` (the hub), `log.md` (append-only ledger), `sources/`, `entities/`,
  `concepts/`, `synthesis/`. Every ojfbot repo is an entity (`kind: repo`).

Maintained by the **`/vault`** skill in `ojfbot/core` — `/vault ingest <path|url>`, `/vault research <topic>`,
`/vault query <q>`, `/vault lint`, `/vault sync` (folds in the ojfbot activity feed), `/vault note`, `/vault orient`.
If you don't have the skill, just follow `CLAUDE.md`.

## The graph UI
`.obsidian/graph.json` is tuned for the "orbiting clusters" look (colour groups by folder — `wiki/entities`,
`wiki/concepts`, `wiki/sources`, `wiki/synthesis`, `raw`; `index.md` as the big hub). Community plugins are
*downloaded* into `.obsidian/plugins/` (gitignored, by `scripts/install-obsidian-plugins.sh`) but **not
auto-enabled** — enable the ones you want in **Settings → Community plugins** (that path version-checks each plugin
against your Obsidian; auto-enabling one whose `minAppVersion` is newer than your app crashes the vault on open).
The ones fetched: **Excalibrain** (TheBrain-style orbit around the current note — needs **Excalidraw**, which needs
a recent Obsidian, ≥1.5.7), **Obsidian Mind Map**, **Graph Analysis**, **Persistent Graph**. On a fresh clone,
re-run `core/.claude/skills/vault/scripts/install-obsidian-plugins.sh`.

For a cinematic whole-vault "galaxy", point **[Graphify](https://www.getgraphify.com/blog/graphify-vs-obsidian)**
(or TheBrain) at this folder — plain markdown; no integration code.

Not "daily-logger" (a published chronological blog) and not a "second brain" — it's "the vault" / "the wiki".

---
_Vault initialized {today}._
"""


# ------------------------------------------------------------------ main
def main() -> int:
    v = vault_root()
    oj = ojfbot_root()
    today = date.today().isoformat()

    if not SCHEMA_TEMPLATE.is_file():
        print(f"error: schema template not found at {SCHEMA_TEMPLATE}", file=sys.stderr); return 1
    for t in PAGE_TEMPLATES:
        if not (TEMPLATES_SRC / t).is_file():
            print(f"error: page template not found: {TEMPLATES_SRC / t}", file=sys.stderr); return 1

    for d in ["raw/assets", "wiki/sources", "wiki/entities", "wiki/concepts", "wiki/synthesis",
              "templates", "prompts", ".obsidian/plugins"]:
        (v / d).mkdir(parents=True, exist_ok=True)

    # the schema
    write_if_missing(v / "CLAUDE.md", SCHEMA_TEMPLATE.read_text(encoding="utf-8"))

    # .obsidian config
    write_json_if_missing(v / ".obsidian" / "app.json", {
        "communityPluginsEnabled": True,
        "attachmentFolderPath": "raw/assets",
        "newFileLocation": "folder",
        "newFileFolderPath": "raw",
        "alwaysUpdateLinks": True,
        "showUnsupportedFiles": True,
    })
    write_json_if_missing(v / ".obsidian" / "appearance.json", {"theme": "obsidian", "accentColor": ""})
    write_json_if_missing(v / ".obsidian" / "core-plugins.json", CORE_PLUGINS)
    write_json_if_missing(v / ".obsidian" / "templates.json", {"folder": "templates"})
    write_json_if_missing(v / ".obsidian" / "graph.json", GRAPH_JSON)
    write_json_if_missing(v / ".obsidian" / "community-plugins.json", COMMUNITY_PLUGINS_ENABLED)

    # page templates
    for t in PAGE_TEMPLATES:
        write_if_missing(v / "templates" / t, (TEMPLATES_SRC / t).read_text(encoding="utf-8"))

    # reusable prompts (e.g. the session-handoff export prompt — copy-paste into a foreign chat agent)
    handoff_src = TEMPLATES_SRC / "session-handoff-prompt.md"
    if handoff_src.is_file():
        write_if_missing(v / "prompts" / "session-handoff.md", handoff_src.read_text(encoding="utf-8"))

    # repos → entity stubs
    repos = discover_repos(oj)
    repo_slugs = [name for name, _ in repos]

    # wiki/index.md + wiki/log.md
    idx = v / "wiki" / "index.md"
    if idx.exists():
        refresh_index_auto_block(idx, repo_slugs)
        skipped.append(str(idx))
    else:
        write_if_missing(idx, index_seed(repo_slugs))
    write_if_missing(v / "wiki" / "log.md",
                     "# selfco — log\n\nAppend-only operation ledger. `## [YYYY-MM-DD] <op> | <title>` + bullets. "
                     "Never edited or reordered. ops: ingest | research | query | lint | sync | session | init.\n\n"
                     f"## [{today}] init | vault scaffolded\n- created raw/ + wiki/{{sources,entities,concepts,synthesis}} + index.md\n"
                     f"- seeded {len(repos)} repo entity stubs in wiki/entities/\n- wrote CLAUDE.md (the schema), .obsidian/ config\n")

    for slug, repo_dir in repos:
        p = v / "wiki" / "entities" / f"{slug}.md"
        if p.exists():
            skipped.append(str(p)); continue
        write_if_missing(p, repo_entity_stub(slug, parse_ports(repo_dir), today))

    write_if_missing(v / "README.md", readme(today))
    write_if_missing(v / ".gitignore", GITIGNORE)

    # git — commit; if a remote exists (e.g. the ojfbot/selfco GitHub mirror), pull --rebase first, push after
    if os.environ.get("VAULT_SKIP_GIT") != "1":
        try:
            fresh = not (v / ".git").exists()
            if fresh:
                subprocess.run(["git", "init", "-q"], cwd=v, check=True)
                subprocess.run(["git", "config", "commit.gpgsign", "false"], cwd=v, check=False)
            has_remote = False
            if not fresh:
                has_remote = bool(subprocess.run(["git", "remote"], cwd=v, capture_output=True, text=True).stdout.strip())
            if has_remote:
                subprocess.run(["git", "pull", "--rebase", "--autostash", "-q"], cwd=v, check=False)
            subprocess.run(["git", "add", "-A"], cwd=v, check=True)
            status = subprocess.run(["git", "status", "--porcelain"], cwd=v,
                                    capture_output=True, text=True, check=True).stdout.strip()
            if status:
                subprocess.run(["git", "commit", "-q", "-m", "vault: init/refresh via /vault init"], cwd=v, check=True)
            if has_remote:
                subprocess.run(["git", "push", "-q"], cwd=v, check=False)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            warnings.append(f"git step skipped: {e}")

    # plugins
    if os.environ.get("VAULT_SKIP_PLUGINS") != "1":
        sh = HERE / "install-obsidian-plugins.sh"
        if sh.is_file():
            try:
                subprocess.run(["bash", str(sh)], cwd=v, check=False, env={**os.environ, "SELFCO_VAULT": str(v)})
            except FileNotFoundError as e:
                warnings.append(f"plugin fetch skipped: {e}")
        else:
            warnings.append(f"plugin installer not found: {sh}")

    print(f"vault: {v}  (LLM Wiki)")
    print(f"ojfbot root: {oj}  ({len(repos)} repos)")
    if created:
        print("\ncreated:")
        for c in created:
            print(f"  + {c}")
    if skipped:
        print(f"\nskipped (already present): {len(skipped)} items")
    if warnings:
        print("\nwarnings:")
        for w in warnings:
            print(f"  ! {w}")
    print("\nNext: open ~/selfco in Obsidian; read CLAUDE.md; then /vault sync to populate the repo entity pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
