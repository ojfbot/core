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

With `--suggest-links` (serendipitous linking; selfco-tooling-adoption-2026): reports STRUCTURAL
candidate links — pairs of pages not yet directly linked but sharing many neighbours in the
wikilink graph, ranked by Adamic-Adar (co-citation / common-neighbours, the read-only core of the
old `obsidian-graph-analysis` plugin reimplemented agent-side, no embeddings). `index.md`, `log.md`,
and underscore-prefixed scratch files (e.g. `_suggested-links.md`) are excluded from the graph so
the index hub doesn't make everything a common neighbour. Output is candidates only — the LLM
applies semantic judgment and writes the read-only `wiki/_suggested-links.md` sidecar; nothing is
ever auto-inserted into a canonical page.

Two refinements keep the daily queue fresh instead of re-emitting an exhausted top-30
(2026-06-10 depth audit: 80% of the top-30 was already-litigated; ~970 unlitigated candidates
sat below the cutoff):
- Resolved-pairs memory: `wiki/_resolved-pairs.tsv` (one litigated pair per line,
  `a<TAB>b<TAB>verdict<TAB>date[<TAB>reason]`, folder-qualified slugs) is loaded by default
  and those pairs are excluded before the top-N cut. Only REJECTED pairs need recording —
  applied pairs become adjacent, which already excludes them. The cultivate agent appends a
  line per rejection; the queue file's prose "Resolved" sections stay the human-readable record.
  `--resolved none` disables; `--resolved <path>` overrides.
- `--band-sample`: emit the top half by score plus an even stride-sample across the remaining
  candidate distribution. High Adamic-Adar score correlates with near-sibling/hub-mediated
  pairs (the bulk of historical rejections); the genuinely serendipitous pairs live lower.

With `--gate` (adr:lint-shadow-to-gate): exit 1 when either of the two deterministic,
single-correct-answer checks fails — broken [[links]] or raw-without-source. Orphans and
stale pages stay advisory (judgment calls, not errors). The gate BLOCKS, it never fixes:
no file is ever mutated. Escape valve for an intentional dangling link mid-refactor:
SELFCO_LINT_GATE_OVERRIDE=1 reports what would have blocked and exits 0.

Vault root: positional argument, or $SELFCO_VAULT, or ~/selfco. A path ending in /wiki is
accepted as a convenience (vault root inferred). Exit 0 always unless --gate finds a
blocking class (it's a report otherwise).
"""
from __future__ import annotations

import argparse
import math
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from itertools import combinations
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


def _canonical_id(page: Path, wiki: Path) -> str:
    """Folder-qualified slug, e.g. 'concepts/llm-wiki' — stable graph node id."""
    return str(page.relative_to(wiki).with_suffix("")).replace(os.sep, "/")


def _excluded_node(cid: str) -> bool:
    """Hubs and scratch files are not real graph nodes: index.md/log.md (index links every page
    by schema, so it'd be a common neighbour of everything) and underscore-prefixed files
    (generated scratch like _suggested-links.md itself)."""
    base = cid.split("/")[-1]
    return base in ("index", "log") or base.startswith("_")


def build_link_graph(wiki: Path) -> dict[str, set[str]]:
    """Undirected wikilink neighbour map over real wiki pages (hubs/scratch excluded)."""
    cid_of: dict[str, str] = {}  # any link target form (folder/stem or bare stem) → canonical id
    for p in wiki.rglob("*.md"):
        cid = _canonical_id(p, wiki)
        cid_of[cid] = cid
        cid_of.setdefault(p.stem, cid)  # bare-stem fallback; folder-qualified wins on collision
    neighbours: dict[str, set[str]] = {}
    for p in wiki.rglob("*.md"):
        src = _canonical_id(p, wiki)
        if _excluded_node(src):
            continue
        neighbours.setdefault(src, set())
        text = strip_noise(p.read_text(encoding="utf-8", errors="ignore"))
        for m in WIKILINK_RE.finditer(text):
            target = m.group(1).strip()
            tgt = cid_of.get(target) or cid_of.get(target.split("/")[-1])
            if not tgt or tgt == src or _excluded_node(tgt):
                continue
            neighbours.setdefault(tgt, set())
            neighbours[src].add(tgt)
            neighbours[tgt].add(src)
    return neighbours


def load_resolved_pairs(path: Path) -> set[tuple[str, str]]:
    """Parse wiki/_resolved-pairs.tsv: one litigated pair per line,
    `a<TAB>b<TAB>verdict<TAB>date[<TAB>reason]` (extra columns tolerated; `#` comments and
    blank lines skipped). Slugs are folder-qualified canonical ids; pairs are normalized to
    sorted tuples. Generators exclude these so the queue never re-emits a pair the cultivate
    pass already rejected. Applied pairs don't need recording (adjacency excludes them) but
    are tolerated if present."""
    pairs: set[tuple[str, str]] = set()
    if not path.is_file():
        return pairs
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        cols = line.split("\t")
        if len(cols) >= 2 and cols[0].strip() and cols[1].strip():
            a, b = sorted((cols[0].strip(), cols[1].strip()))
            pairs.add((a, b))
    return pairs


def band_sample_rows(rows: list, top: int) -> list:
    """Top half by score + an even stride-sample of the rest of the candidate distribution.
    Deterministic (no RNG): serendipity lives below the head of the score ranking, so pure
    top-N starves the queue of exactly the pairs cultivate is hunting."""
    if len(rows) <= top:
        return rows
    head_n = top - top // 2
    head, rest = rows[:head_n], rows[head_n:]
    k = top // 2
    step = len(rest) / k
    return head + [rest[int(i * step)] for i in range(k)]


def suggest_links(
    neighbours: dict[str, set[str]],
    top: int,
    min_common: int,
    hub_degree: int = 0,
    resolved: set[tuple[str, str]] | None = None,
    band_sample: bool = False,
) -> tuple[list[tuple[str, str, float, int]], int]:
    """Adamic-Adar over the wikilink graph: for each shared neighbour c, every non-adjacent pair
    of c's neighbours scores 1/log(deg(c)) — rare shared neighbours weigh more than hubs. Returns
    ((a, b, score, shared_count) rows, n_excluded_by_resolved-memory) for the top non-adjacent
    pairs with >= min_common shared neighbours.

    hub_degree > 0 hard-excludes any page with degree > hub_degree from acting as a shared
    neighbour — beyond Adamic-Adar's soft damping. On selfco this strips catalog-sibling noise
    (e.g. two repos that merely co-appear in ecosystem-map/cluster-status), leaving genuine
    conceptual co-citation. 0 disables the cutoff (pure Adamic-Adar).

    resolved pairs (see load_resolved_pairs) are dropped before the top-N cut; band_sample
    swaps pure top-N for head + stride-sample (see band_sample_rows)."""
    aa: dict[tuple[str, str], float] = defaultdict(float)
    common: dict[tuple[str, str], int] = defaultdict(int)
    for c, nbrs in neighbours.items():
        deg = len(nbrs)
        if deg < 2:  # log(1)=0; a degree-1 neighbour says nothing about a pair
            continue
        if hub_degree and deg > hub_degree:  # catalog/hub page — co-membership isn't a real A–B signal
            continue
        weight = 1.0 / math.log(deg)
        for a, b in combinations(sorted(nbrs), 2):
            if b in neighbours.get(a, ()):  # already directly linked → not a suggestion
                continue
            key = (a, b)
            aa[key] += weight
            common[key] += 1
    resolved = resolved or set()
    rows = []
    n_excluded = 0
    for (a, b), score in aa.items():
        if common[(a, b)] < min_common:
            continue
        if (a, b) in resolved:  # aa keys are already sorted tuples (combinations over sorted)
            n_excluded += 1
            continue
        rows.append((a, b, score, common[(a, b)]))
    rows.sort(key=lambda r: (-r[2], -r[3]))
    rows = band_sample_rows(rows, top) if band_sample else rows[:top]
    return rows, n_excluded


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
        "--gate",
        action="store_true",
        help="Exit 1 on blocking findings: broken [[links]] or raw/ items without a wiki/sources/ page. "
        "Orphans/stale stay advisory. Never fixes anything. Override: SELFCO_LINT_GATE_OVERRIDE=1.",
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
    ap.add_argument(
        "--suggest-links",
        action="store_true",
        help="Report structural candidate links (Adamic-Adar over the wikilink graph) for the LLM to judge and file into wiki/_suggested-links.md. Never auto-inserts.",
    )
    ap.add_argument(
        "--top",
        type=int,
        default=30,
        help="With --suggest-links: max candidate pairs to report (default 30).",
    )
    ap.add_argument(
        "--min-common",
        type=int,
        default=2,
        help="With --suggest-links: minimum shared neighbours for a candidate pair (default 2; raise to cut noise).",
    )
    ap.add_argument(
        "--hub-degree",
        type=int,
        default=0,
        help="With --suggest-links: exclude pages with degree > N as shared neighbours (strips catalog-sibling noise; 0 = pure Adamic-Adar). Try ~15 on selfco.",
    )
    ap.add_argument(
        "--resolved",
        default="auto",
        help="With --suggest-links: TSV of already-litigated pairs to exclude (a<TAB>b<TAB>verdict<TAB>date). "
        "Default 'auto' = wiki/_resolved-pairs.tsv if present; 'none' disables.",
    )
    ap.add_argument(
        "--band-sample",
        action="store_true",
        help="With --suggest-links: emit top half by score + an even stride-sample of the remaining "
        "candidates, instead of pure top-N (high score correlates with hub-mediated near-siblings; "
        "serendipity lives lower).",
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
               if p.name not in ("index.md", "log.md")
               and not p.name.startswith("_")  # generated scratch (e.g. _suggested-links.md) is non-canonical
               and inbound.get(p.stem, 0) == 0]

    # raw/ items not referenced by any wiki/sources/ page
    raw_items: list[Path] = []
    if raw.is_dir():
        for p in raw.rglob("*"):
            # Skip assets and hidden dot-entries (.DS_Store, the gitignored
            # raw/.defuddle-shadow/ trial dir — scratch, not source material).
            rel_parts = p.relative_to(raw).parts
            if p.is_file() and "assets" not in rel_parts and not any(part.startswith(".") for part in rel_parts):
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

    # --suggest-links: serendipitous-linking candidates (structural, read-only). The graph
    # algorithms surface pairs that *look* related by topology; the LLM decides which are real
    # and writes the wiki/_suggested-links.md sidecar. Never auto-inserts into a canonical page.
    if args.suggest_links:
        neighbours = build_link_graph(wiki)
        if args.resolved == "auto":
            resolved_path = wiki / "_resolved-pairs.tsv"
        elif args.resolved.lower() == "none":
            resolved_path = None
        else:
            resolved_path = Path(args.resolved).expanduser()
        resolved = load_resolved_pairs(resolved_path) if resolved_path else set()
        srows, n_excluded = suggest_links(
            neighbours, args.top, args.min_common, args.hub_degree,
            resolved=resolved, band_sample=args.band_sample,
        )
        hub_note = f", hub-degree {args.hub_degree}" if args.hub_degree else ""
        band_note = ", band-sampled" if args.band_sample else ""
        print(f"\n== suggested links (structural; Adamic-Adar, top {args.top}, "
              f"min-common {args.min_common}{hub_note}{band_note}): {len(srows)} ==")
        if resolved:
            print(f"(resolved-pairs memory: {len(resolved)} litigated pairs loaded, "
                  f"{n_excluded} candidates excluded)")
        if srows:
            print()
            print("| Score | Shared | Page A | Page B |")
            print("|---|---|---|---|")
            for a, b, score, shared in srows:
                print(f"| {score:.2f} | {shared} | [[{a}]] | [[{b}]] |")
        print(
            "\n(Candidates are non-adjacent page pairs sharing >= --min-common neighbours in the "
            "wikilink graph, scored by Adamic-Adar — co-citation/common-neighbours, no embeddings. "
            "index.md/log.md/_*-files are excluded as hubs/scratch. These are SUGGESTIONS for the "
            "LLM to judge; file the ones that hold up into the read-only wiki/_suggested-links.md "
            "sidecar — never auto-insert links into canonical pages.)"
        )

    print("\n(Semantic checks — contradictions, stale claims, missing cross-refs — are the LLM's job; "
          "see /vault lint.)")

    # --gate: the deterministic checks block; everything else stays advisory
    # (adr:lint-shadow-to-gate, the ADR-0086 Brassboard → Operational promotion).
    # Block-only by design — the gate never mutates a page.
    if args.gate:
        # Canvas readability (ADR-0088 rev A): every hand-authored .canvas must already be
        # sized-to-content and free of edge-label/node collisions. canvas-fit.py --check
        # exits non-zero when a node would grow or an edge gap would open. Run canvases
        # under canvas/runs/ are machine-generated by the selfco-box renderer, which owns
        # their layout — they are out of this gate's scope.
        canvas_dirty: list[str] = []
        canvas_fit = Path(__file__).resolve().parent / "canvas-fit.py"
        if canvas_fit.is_file():
            for cf in sorted(v.rglob("*.canvas")):
                if "runs" in cf.relative_to(v).parts:
                    continue
                r = subprocess.run(
                    [sys.executable, str(canvas_fit), str(cf), "--vault", str(v), "--check"],
                    capture_output=True, text=True,
                )
                if r.returncode != 0:
                    canvas_dirty.append(str(cf.relative_to(v)))

        n_blocking = len(broken) + len(raw_unprocessed) + len(canvas_dirty)
        if n_blocking == 0:
            print("\nGATE OK: 0 broken [[links]], 0 raw-without-source, 0 unfit canvases. "
                  "(Orphans/stale are advisory.)")
        elif os.environ.get("SELFCO_LINT_GATE_OVERRIDE") == "1":
            print(
                f"\nGATE OVERRIDDEN (SELFCO_LINT_GATE_OVERRIDE=1): {len(broken)} broken [[link(s)]], "
                f"{len(raw_unprocessed)} raw-without-source, {len(canvas_dirty)} unfit canvas(es) "
                f"would have blocked.",
                file=sys.stderr,
            )
        else:
            if canvas_dirty:
                print(f"\n== unfit canvases (run canvas-fit.py): {len(canvas_dirty)} ==", file=sys.stderr)
                for c in canvas_dirty:
                    print(f"  - {c}", file=sys.stderr)
            print(
                f"\nGATE FAILED: {len(broken)} broken [[link(s)]], {len(raw_unprocessed)} raw/ item(s) "
                f"with no wiki/sources/ page, {len(canvas_dirty)} canvas(es) not sized-to-content "
                f"(run `canvas-fit.py <file> --vault $V`). The gate never auto-fixes; set "
                f"SELFCO_LINT_GATE_OVERRIDE=1 for an intentional mid-refactor exception.",
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
