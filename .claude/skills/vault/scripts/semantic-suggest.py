#!/usr/bin/env python3
"""semantic-suggest.py — embedding-based candidate links for the selfco vault (PROTOTYPE).

The second suggestion channel (adr:semantic-link-suggester), complementary to
`lint.py --suggest-links` (Adamic-Adar on co-citation). The structural engine can only rank
pairs that already share inbound links; this pass surfaces semantically-near pages that share
ZERO neighbours in the wikilink graph — exactly the "same idea under two names" pairs
`cultivate` is told to hunt and co-citation can never reach. Pairs with any shared neighbour
are excluded here (the structural channel owns them).

Suggestion-only, by construction: output is a ranked table for the LLM to judge and file into
the read-only `wiki/_suggested-links.md` queue. Nothing is ever auto-linked; the cultivate
"Considered, declined" discipline and the empty-run-is-a-success rule are unchanged — a high
cosine score is a prompt to look, not a mandate to link.

Embedding provider:
- With $VOYAGE_API_KEY: Voyage AI embeddings (--model, default voyage-3.5-lite) over
  title + body head of each page. Plain urllib, no deps.
- Without: a deterministic TF-IDF cosine fallback (LEXICAL, not semantic — clearly labelled
  in the output; fine for shaking out the channel, not for judging embedding quality).

Read-only against the vault. Exit 0 always. Embedding cache (provider runs only) defaults to
~/.cache/selfco/semantic-embeddings.json — outside the vault, keyed by content hash.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import urllib.request
from itertools import combinations
from pathlib import Path

# Reuse the lint graph + helpers (same directory).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import lint  # noqa: E402

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
BODY_HEAD_CHARS = 4000
BATCH = 64

WORD_RE = re.compile(r"[a-z][a-z0-9'\-]{2,}")
STOPWORDS = frozenset(
    "the and for that this with from are was were has have had not but its also can will "
    "into over under more than when what which who how why all any each their there here "
    "one two via per they them then our your you out use used uses using see".split()
)


def page_text(p: Path) -> str:
    """Title + frontmatter-stripped, noise-stripped body head — the embedding input."""
    text = p.read_text(encoding="utf-8", errors="ignore")
    m = lint.FRONTMATTER_RE.match(text)
    if m:
        text = text[m.end():]
    text = lint.strip_noise(text)
    return f"{p.stem.replace('-', ' ')}\n{text[:BODY_HEAD_CHARS]}"


def collect_pages(wiki: Path) -> dict[str, Path]:
    """canonical id ('concepts/llm-wiki') → path, hubs/scratch excluded (as in the link graph)."""
    out: dict[str, Path] = {}
    for p in wiki.rglob("*.md"):
        cid = lint._canonical_id(p, wiki)
        if lint._excluded_node(cid):
            continue
        out[cid] = p
    return out


# --- provider: Voyage AI ------------------------------------------------------------------


def voyage_embed(texts: list[str], model: str, api_key: str) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        req = urllib.request.Request(
            VOYAGE_URL,
            data=json.dumps({"input": texts[i : i + BATCH], "model": model}).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
        out.extend(item["embedding"] for item in data["data"])
    return out


def embed_with_cache(
    ids: list[str], texts: list[str], model: str, api_key: str, cache_path: Path
) -> dict[str, list[float]]:
    """Embed via Voyage with a content-hash cache so a daily run only pays for changed pages."""
    cache: dict[str, list[float]] = {}
    if cache_path.is_file():
        try:
            cache = json.loads(cache_path.read_text())
        except json.JSONDecodeError:
            cache = {}
    keys = [f"{model}:{hashlib.sha256(t.encode()).hexdigest()}" for t in texts]
    missing = [i for i, k in enumerate(keys) if k not in cache]
    if missing:
        fresh = voyage_embed([texts[i] for i in missing], model, api_key)
        for i, vec in zip(missing, fresh):
            cache[keys[i]] = vec
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache))
    return {pid: cache[k] for pid, k in zip(ids, keys)}


# --- provider: TF-IDF fallback (lexical, deterministic, zero-dep) -------------------------


def tfidf_vectors(ids: list[str], texts: list[str]) -> dict[str, dict[str, float]]:
    docs = []
    df: dict[str, int] = {}
    for t in texts:
        counts: dict[str, int] = {}
        for w in WORD_RE.findall(t.lower()):
            if w not in STOPWORDS:
                counts[w] = counts.get(w, 0) + 1
        docs.append(counts)
        for w in counts:
            df[w] = df.get(w, 0) + 1
    n = len(texts)
    vecs: dict[str, dict[str, float]] = {}
    for pid, counts in zip(ids, docs):
        vecs[pid] = {w: (1 + math.log(c)) * math.log(n / df[w]) for w, c in counts.items() if df[w] < n}
    return vecs


def sparse_cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if len(b) < len(a):
        a, b = b, a
    dot = sum(v * b[w] for w, v in a.items() if w in b)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def dense_cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


# --- main ----------------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser(description="Embedding-based candidate links (prototype; adr:semantic-link-suggester)")
    ap.add_argument("path", nargs="?", help="Vault root or wiki/ dir. Default: $SELFCO_VAULT or ~/selfco")
    ap.add_argument("--top", type=int, default=20, help="Max candidate pairs to report (default 20).")
    ap.add_argument("--min-score", type=float, default=None, help="Minimum cosine similarity. Default is per-provider (0.55 voyage, 0.08 tf-idf — the two scales differ); raise to cut noise.")
    ap.add_argument("--model", default="voyage-3.5-lite", help="Voyage embedding model (default voyage-3.5-lite).")
    ap.add_argument("--focus", action="append", default=[], help="Restrict one side of every pair to these slugs (repeatable) — e.g. the cultivate delta set.")
    ap.add_argument("--cache", default=str(Path.home() / ".cache/selfco/semantic-embeddings.json"), help="Embedding cache file (outside the vault).")
    args = ap.parse_args()

    v = lint.resolve_vault_root(args.path)
    wiki = v / "wiki"
    if not wiki.is_dir():
        print(f"semantic-suggest: {v} has no wiki/ — run /vault init first.", file=sys.stderr)
        return 0

    pages = collect_pages(wiki)
    ids = sorted(pages)
    texts = [page_text(pages[i]) for i in ids]
    neighbours = lint.build_link_graph(wiki)

    api_key = os.environ.get("VOYAGE_API_KEY", "").strip()
    if api_key:
        provider = f"voyage:{args.model}"
        vecs = embed_with_cache(ids, texts, args.model, api_key, Path(args.cache).expanduser())
        score = lambda a, b: dense_cosine(vecs[a], vecs[b])  # noqa: E731
        min_score = args.min_score if args.min_score is not None else 0.55
    else:
        provider = "tf-idf fallback (LEXICAL, not semantic — set VOYAGE_API_KEY for real embeddings)"
        svecs = tfidf_vectors(ids, texts)
        score = lambda a, b: sparse_cosine(svecs[a], svecs[b])  # noqa: E731
        min_score = args.min_score if args.min_score is not None else 0.08

    focus = {f.strip() for f in args.focus if f.strip()}

    rows: list[tuple[str, str, float]] = []
    for a, b in combinations(ids, 2):
        if focus and not ({a, a.split("/")[-1]} & focus or {b, b.split("/")[-1]} & focus):
            continue
        na, nb = neighbours.get(a, set()), neighbours.get(b, set())
        if b in na:  # already directly linked
            continue
        if na & nb:  # shares a citation — the structural channel's territory
            continue
        s = score(a, b)
        if s >= min_score:
            rows.append((a, b, s))
    rows.sort(key=lambda r: -r[2])
    rows = rows[: args.top]

    print(f"semantic-suggest: {v}/wiki  ({len(ids)} pages; provider: {provider})\n")
    print(f"== semantic candidate links (zero shared citations; cosine >= {min_score}, top {args.top}): {len(rows)} ==")
    if rows:
        print()
        print("| Cosine | Page A | Page B |")
        print("|---|---|---|")
        for a, b, s in rows:
            print(f"| {s:.3f} | [[{a}]] | [[{b}]] |")
    else:
        print("\n(none above threshold — an empty run is a success state; never pad)")
    print(
        "\n(Candidates are non-adjacent pairs sharing ZERO neighbours in the wikilink graph — "
        "the pairs Adamic-Adar is structurally blind to. SUGGESTIONS only: judge each by reading "
        "both pages, file keepers into wiki/_suggested-links.md with a sentence of why, and record "
        'rejections in the "Considered, declined" list. Never auto-insert into a canonical page.)'
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
