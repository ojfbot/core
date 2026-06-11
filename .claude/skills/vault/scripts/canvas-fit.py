#!/usr/bin/env python3
"""canvas-fit.py — deterministic node-sizing pass for Obsidian JSON Canvas files.

Why this exists (operator feedback, 2026-06-10, ADR-0088 rev A): a file-node renders its
embedded page in exactly the box it is given — there is no auto-fit in Obsidian. The first
delivered canvas shipped 100-120px-tall file-node strips and every node had to be resized by
hand before anything was readable. This script makes the size-nodes-to-content convention
structural: run it after authoring or editing any .canvas.

What it does (grow-only — it NEVER shrinks a node or moves one sideways, so deliberate
hand-arrangement survives):
- text nodes  -> height grown to fit the wrapped line count at the node's width.
- file nodes  -> grown to at least FILE_MIN_W x FILE_MIN_H (title + frontmatter properties
                 visible). A node already larger (e.g. a full-page read-on-canvas embed)
                 is left alone.
- overlaps    -> after growing, any pair of overlapping non-group nodes is resolved by
                 pushing the lower node further down (y only).
- groups      -> expanded to re-contain the (grown) nodes they originally contained.
- validation  -> JSON shape, and every file-node path resolves inside the vault.

Modes: default fixes in place and reports; --check reports and exits 1 if anything WOULD
change (for review flows) without writing. Exit 0 otherwise.

Usage: canvas-fit.py <file.canvas> [--vault <root>] [--check]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# File-node floor: enough for title + frontmatter properties (the operator's chosen size).
FILE_MIN_W = 420
FILE_MIN_H = 310
# Text-node metrics: Obsidian canvas body text is ~16px / ~24px line-height with ~12px
# padding per side; ~8px average glyph width is conservative for wrapping estimates.
LINE_H = 24
PAD = 24
CHAR_W = 8
TEXT_MIN_H = 60
GROUP_PAD = 20
GAP = 20  # vertical clearance inserted when separating overlapping nodes


def wrapped_lines(text: str, width: float) -> int:
    """Estimate rendered line count of markdown text at a given node width."""
    chars_per_line = max(10, int((width - PAD) / CHAR_W))
    lines = 0
    for raw in text.split("\n"):
        raw = raw.rstrip()
        if not raw:
            lines += 1
            continue
        # crude markdown allowance: headers render larger -> count them ~1.5 lines
        weight = 1.5 if raw.lstrip().startswith("#") else 1.0
        import math

        lines += math.ceil(max(1, math.ceil(len(raw) / chars_per_line)) * weight)
    return max(1, lines)


def text_height(node: dict) -> int:
    return max(TEXT_MIN_H, PAD + wrapped_lines(node.get("text", ""), node["width"]) * LINE_H)


def overlaps(a: dict, b: dict) -> bool:
    return (
        a["x"] < b["x"] + b["width"]
        and b["x"] < a["x"] + a["width"]
        and a["y"] < b["y"] + b["height"]
        and b["y"] < a["y"] + a["height"]
    )


def contains(group: dict, node: dict) -> bool:
    return (
        group["x"] <= node["x"]
        and group["y"] <= node["y"]
        and group["x"] + group["width"] >= node["x"] + node["width"]
        and group["y"] + group["height"] >= node["y"] + node["height"]
    )


def fit(canvas: dict, vault: Path) -> list[str]:
    """Apply the sizing pass in place; return a list of human-readable change lines."""
    changes: list[str] = []
    nodes = canvas.get("nodes", [])
    groups = [n for n in nodes if n.get("type") == "group"]
    solid = [n for n in nodes if n.get("type") != "group"]
    # remember original membership before anything grows
    members = {id(g): [n for n in solid if contains(g, n)] for g in groups}

    def label(n: dict) -> str:
        return n.get("file") or n.get("label") or (n.get("text", "")[:30].replace("\n", " ") + "…")

    # 1. grow undersized nodes
    for n in solid:
        t = n.get("type")
        if t == "file":
            w, h = max(n["width"], FILE_MIN_W), max(n["height"], FILE_MIN_H)
            if (w, h) != (n["width"], n["height"]):
                changes.append(f"file node '{label(n)}': {n['width']}x{n['height']} -> {w}x{h}")
                n["width"], n["height"] = w, h
            p = n.get("file")
            if p and not (vault / p).exists():
                changes.append(f"WARNING: file node target missing: {p}")
        elif t == "text":
            h = text_height(n)
            if h > n["height"]:
                changes.append(f"text node '{label(n)}': height {n['height']} -> {h}")
                n["height"] = h

    # 2. resolve overlaps among non-group nodes by pushing the lower node down
    for _ in range(50):
        moved = False
        ordered = sorted(solid, key=lambda n: (n["y"], n["x"]))
        for i, a in enumerate(ordered):
            for b in ordered[i + 1 :]:
                if overlaps(a, b):
                    lower = b if b["y"] >= a["y"] else a
                    upper = a if lower is b else b
                    delta = upper["y"] + upper["height"] + GAP - lower["y"]
                    lower["y"] += delta
                    changes.append(f"moved '{label(lower)}' down {delta}px to clear '{label(upper)}'")
                    moved = True
        if not moved:
            break

    # 3. expand groups to re-contain their original members
    for g in groups:
        kids = members[id(g)]
        if not kids:
            continue
        x1 = min(g["x"], min(k["x"] for k in kids) - GROUP_PAD)
        y1 = min(g["y"], min(k["y"] for k in kids) - GROUP_PAD)
        x2 = max(g["x"] + g["width"], max(k["x"] + k["width"] for k in kids) + GROUP_PAD)
        y2 = max(g["y"] + g["height"], max(k["y"] + k["height"] for k in kids) + GROUP_PAD)
        new = {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1}
        if any(new[k] != g[k] for k in new):
            changes.append(f"group '{g.get('label', '?')}' expanded to contain grown members")
            g.update(new)

    return changes


def main() -> int:
    ap = argparse.ArgumentParser(description="Grow-only node-sizing pass for .canvas files (ADR-0088 rev A)")
    ap.add_argument("canvas", help="Path to the .canvas file")
    ap.add_argument("--vault", default=None, help="Vault root for resolving file nodes (default: canvas parent's parent)")
    ap.add_argument("--check", action="store_true", help="Report and exit 1 if changes would be made; write nothing")
    args = ap.parse_args()

    path = Path(args.canvas).expanduser()
    vault = Path(args.vault).expanduser() if args.vault else path.resolve().parent.parent
    try:
        canvas = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"canvas-fit: cannot read {path}: {e}", file=sys.stderr)
        return 1

    changes = fit(canvas, vault)
    real_changes = [c for c in changes if not c.startswith("WARNING")]
    for c in changes:
        print(("  " if not c.startswith("WARNING") else "") + c)

    if not real_changes:
        print(f"canvas-fit: {path.name} — all nodes already sized to content.")
        return 0
    if args.check:
        print(f"canvas-fit: {path.name} — {len(real_changes)} change(s) needed (--check: not written).")
        return 1
    path.write_text(json.dumps(canvas, indent="\t") + "\n", encoding="utf-8")
    print(f"canvas-fit: {path.name} — {len(real_changes)} change(s) written.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
