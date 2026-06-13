#!/usr/bin/env python3
"""canvas-fit.py — deterministic node-sizing pass for Obsidian JSON Canvas files.

Why this exists (operator feedback, 2026-06-10, ADR-0088 rev A): a file-node renders its
embedded page in exactly the box it is given — there is no auto-fit in Obsidian. The first
delivered canvas shipped 100-120px-tall file-node strips and every node had to be resized by
hand before anything was readable. This script makes the size-nodes-to-content convention
structural: run it after authoring or editing any .canvas.

What it does (grow-only / push-apart — it NEVER shrinks a node, so deliberate
hand-arrangement survives):
- text nodes  -> height grown to fit the wrapped line count at the node's width.
- file nodes  -> grown to at least FILE_MIN_W x FILE_MIN_H (title + frontmatter properties
                 visible). A node already larger (e.g. a full-page read-on-canvas embed)
                 is left alone.
- overlaps    -> after growing, any pair of overlapping non-group nodes is resolved by
                 pushing the lower node further down (y only).
- edge labels -> an edge's label renders as unboxed text at the gap midpoint; when two
                 horizontally-adjacent nodes are closer than the label is wide, the label
                 spills under both. For that case (left<->right edges) the right-hand node
                 is pushed further right until the gap clears the label. Vertical and
                 corner/loop-back labels are NOT auto-moved (placement is deliberate) —
                 if one still sits under a third node it is FLAGGED as an advisory WARNING.
- groups      -> expanded to re-contain the (grown/moved) nodes they originally contained.
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
# Edge-label metrics: the label renders smaller than node body text (~13px) and unboxed.
EDGE_CHAR_W = 7      # conservative average glyph width for an edge label
LABEL_PAD = 16       # breathing room on each side of the label text
LABEL_H = 28         # approximate rendered height of a one-line edge label
LABEL_MIN_CLEAR = 8  # extra px added when opening a gap so the label never touches a node


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


def label_width(text: str) -> float:
    """Estimate the rendered width of an unboxed edge label."""
    return len(text) * EDGE_CHAR_W + 2 * LABEL_PAD


def edge_axis(from_side: str, to_side: str) -> str:
    """'h' for left<->right edges, 'v' for top<->bottom, 'mixed' for corner routes."""
    horizontal, vertical = {"left", "right"}, {"top", "bottom"}
    if from_side in horizontal and to_side in horizontal:
        return "h"
    if from_side in vertical and to_side in vertical:
        return "v"
    return "mixed"


def side_point(n: dict, side: str) -> tuple[float, float]:
    """The (x, y) point where an edge attaches to a node side."""
    if side == "left":
        return (n["x"], n["y"] + n["height"] / 2)
    if side == "right":
        return (n["x"] + n["width"], n["y"] + n["height"] / 2)
    if side == "top":
        return (n["x"] + n["width"] / 2, n["y"])
    if side == "bottom":
        return (n["x"] + n["width"] / 2, n["y"] + n["height"])
    return (n["x"] + n["width"] / 2, n["y"] + n["height"] / 2)


def fit(canvas: dict, vault: Path) -> list[str]:
    """Apply the sizing pass in place; return a list of human-readable change lines."""
    changes: list[str] = []
    nodes = canvas.get("nodes", [])
    edges = canvas.get("edges", [])
    by_id = {n["id"]: n for n in nodes if "id" in n}
    groups = [n for n in nodes if n.get("type") == "group"]
    solid = [n for n in nodes if n.get("type") != "group"]
    # remember original membership before anything grows
    members = {id(g): [n for n in solid if contains(g, n)] for g in groups}

    def label(n: dict) -> str:
        return n.get("file") or n.get("label") or (n.get("text", "")[:30].replace("\n", " ") + "…")

    def space_edge_labels() -> bool:
        """Push the right-hand node of a labeled left<->right edge until the gap clears
        the label. Returns True if anything moved. Vertical/mixed edges are left to the
        flag pass — auto-moving them would disturb deliberate corner/loop-back placement."""
        moved = False
        for e in edges:
            lab = (e.get("label") or "").strip()
            if not lab or edge_axis(e.get("fromSide", ""), e.get("toSide", "")) != "h":
                continue
            a, b = by_id.get(e.get("fromNode")), by_id.get(e.get("toNode"))
            if not a or not b or a.get("type") == "group" or b.get("type") == "group":
                continue
            left, right = (a, b) if a["x"] <= b["x"] else (b, a)
            gap = right["x"] - (left["x"] + left["width"])
            need = label_width(lab)
            if gap < need:
                delta = need - gap + LABEL_MIN_CLEAR
                right["x"] += delta
                changes.append(
                    f"edge label '{lab[:30]}': gap {int(gap)}->{int(need)}px "
                    f"(moved '{label(right)}' right {int(delta)}px)"
                )
                moved = True
        return moved

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

    # 2. open edge-label gaps (push right) and resolve node overlaps (push down) to a
    #    joint fixpoint — opening a gap can create an overlap and vice versa. The two
    #    act on different axes (x vs y), so they converge rather than oscillate.
    for _ in range(100):
        moved = space_edge_labels()
        ordered = sorted(solid, key=lambda n: (n["y"], n["x"]))
        for i, a in enumerate(ordered):
            for b in ordered[i + 1 :]:
                if overlaps(a, b):
                    lower = b if b["y"] >= a["y"] else a
                    upper = a if lower is b else b
                    delta = upper["y"] + upper["height"] + GAP - lower["y"]
                    lower["y"] += delta
                    changes.append(f"moved '{label(lower)}' down {int(delta)}px to clear '{label(upper)}'")
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

    # 4. flag (advisory) any labeled edge whose label still sits under a non-endpoint node.
    #    Catches vertical/corner labels we don't auto-move and the rare third-node overlap.
    #    Warnings never block on their own (they aren't auto-fixable) — they surface for a
    #    human to widen the gap or shorten the label.
    for e in edges:
        lab = (e.get("label") or "").strip()
        if not lab:
            continue
        a, b = by_id.get(e.get("fromNode")), by_id.get(e.get("toNode"))
        if not a or not b:
            continue
        (ax, ay), (bx, by) = side_point(a, e.get("fromSide", "")), side_point(b, e.get("toSide", ""))
        lw, lh = label_width(lab), LABEL_H
        lrect = {"x": (ax + bx) / 2 - lw / 2, "y": (ay + by) / 2 - lh / 2, "width": lw, "height": lh}
        for n in solid:
            if n is a or n is b or n.get("type") == "group":
                continue
            if overlaps(lrect, n):
                changes.append(
                    f"WARNING: edge label '{lab[:40]}' may be obscured by node '{label(n)}' "
                    f"— widen the gap or shorten the label"
                )
                break

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
