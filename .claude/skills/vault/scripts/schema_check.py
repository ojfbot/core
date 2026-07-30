#!/usr/bin/env python3
"""schema_check.py — validate vault frontmatter against schema.yaml.

Consumed by `lint.py --schema`. SHADOW ONLY: reports, never blocks, never mutates
(ADR-0086 Brassboard). Promotion to a gate happens on evidence, not on authorship.

WHY A HAND-ROLLED PARSER
lint.py carries no third-party dependencies by design, so it runs anywhere `python3`
does; PyYAML is not present on this machine. This mirrors the fleet's existing convention
(scripts/lib/northstar-fm.mjs: "parses the constrained frontmatter with no YAML
dependency ... which is what makes the dependency-free parse safe").

The safety argument only holds if the constraint is enforced, so `load_schema` PARSES AND
THEN VERIFIES: it asserts the document has the shape it must have (page_types is a dict of
dicts, every required list is a list of strings, every enum has values, ...). A parser
that silently returns a half-read document would inject exactly the confident-but-wrong
failure this whole effort exists to eliminate. Mis-parse fails loudly instead.

Supported YAML subset — everything schema.yaml actually uses:
    key: scalar          key: [a, b]        key: {a: 1, b: 2}
    key:  + indented map or `- ` list       key: > (folded block, collapsed to one string)
    # comments, blank lines, 'single' and "double" quotes
Anything else is out of contract; add support here AND to the shape check, or restructure
the schema.
"""
from __future__ import annotations

import re
from pathlib import Path

FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)


# --------------------------------------------------------------------------- parsing
def _scalar(s: str):
    """Coerce a YAML scalar. Strings stay strings; only obvious literals convert."""
    s = s.strip()
    if s in ("", "~", "null"):
        return None
    if s == "true":
        return True
    if s == "false":
        return False
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return s[1:-1]
    return s


def _split_top(body: str) -> list[str]:
    """Split on commas at bracket depth 0, so a nested [list] inside a {map} survives.

    A naive `body.split(",")` shreds `{shape: enum, values: [a, b]}` into `values: [a`
    and `b]` — and, worse, does so silently: the result is still a dict, so a shape check
    that only asserts "is a dict" passes while the data is garbage. That happened.
    """
    parts, depth, buf = [], 0, []
    for ch in body:
        if ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf))
    return [p for p in parts if p.strip()]


def _inline(s: str):
    """Parse `[a, b]`, `{a: 1, b: [x, y]}`, or a plain scalar. One level of nesting."""
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        body = s[1:-1].strip()
        return [_inline(x) if x.strip()[:1] in "[{" else _scalar(x) for x in _split_top(body)] if body else []
    if s.startswith("{") and s.endswith("}"):
        out = {}
        for part in _split_top(s[1:-1].strip()):
            if ":" not in part:
                continue
            k, _, v = part.partition(":")
            v = v.strip()
            out[k.strip()] = _inline(v) if v[:1] in "[{" else _scalar(v)
        return out
    return _scalar(s)


def _strip_comment(line: str) -> str:
    """Drop a trailing `#` comment, respecting quotes."""
    out, quote = [], None
    for ch in line:
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#":
            break
        out.append(ch)
    return "".join(out)


def _parse_block(lines: list[tuple[int, str]], i: int, indent: int):
    """Parse the block at `indent`. Returns (value, next_index)."""
    # A `- ` at this indent means the block is a list.
    if i < len(lines) and lines[i][0] == indent and lines[i][1].startswith("- "):
        items = []
        while i < len(lines) and lines[i][0] == indent and lines[i][1].startswith("- "):
            items.append(_scalar(lines[i][1][2:]))
            i += 1
        return items, i

    out: dict = {}
    while i < len(lines):
        ind, line = lines[i]
        if ind < indent:
            break
        if ind > indent:  # stray over-indent: not our contract
            raise ValueError(f"unexpected indentation at: {line!r}")
        m = re.match(r'^("?[@\w][\w@.\-]*"?)\s*:\s*(.*)$', line)
        if not m:
            raise ValueError(f"unparseable line: {line!r}")
        key, rest = m.group(1).strip('"'), m.group(2).strip()
        i += 1
        if rest in (">", "|", ">-", "|-"):  # folded/literal block -> one collapsed string
            buf = []
            while i < len(lines) and lines[i][0] > indent:
                buf.append(lines[i][1])
                i += 1
            out[key] = " ".join(buf).strip()
        elif rest == "":
            if i < len(lines) and lines[i][0] > indent:
                out[key], i = _parse_block(lines, i, lines[i][0])
            else:
                out[key] = None
        else:
            out[key] = _inline(rest)
    return out, i


def _verify_shape(doc: dict) -> None:
    """Assert the parse produced the document we require. Loud failure beats silent garbage."""
    problems = []
    for top in ("page_types", "keys", "enums", "rules", "@context"):
        if not isinstance(doc.get(top), dict) or not doc[top]:
            problems.append(f"`{top}` missing or not a non-empty map")
    if not problems:
        for name, pt in doc["page_types"].items():
            if not isinstance(pt, dict):
                problems.append(f"page_types.{name} is not a map")
                continue
            for listkey in ("required", "optional"):
                v = pt.get(listkey)
                if v is not None and not isinstance(v, list):
                    problems.append(f"page_types.{name}.{listkey} is not a list (got {type(v).__name__})")
        for name, en in doc["enums"].items():
            if not isinstance(en, dict) or not isinstance(en.get("values"), list):
                problems.append(f"enums.{name}.values is not a list")
        for name, k in doc["keys"].items():
            if not isinstance(k, dict) or "shape" not in k:
                problems.append(f"keys.{name} has no `shape`")
                continue
            # A nested inline list that got comma-shredded lands here as a string. Assert
            # the type so the failure is loud at load, not a wrong answer 400 rows later.
            if "values" in k and not isinstance(k["values"], list):
                problems.append(
                    f"keys.{name}.values is {type(k['values']).__name__}, expected list "
                    f"(got {k['values']!r}) — likely a mis-parsed inline collection"
                )
    if problems:
        raise ValueError(
            "schema.yaml did not parse into the required shape — refusing to validate "
            "against a half-read schema:\n  - " + "\n  - ".join(problems)
        )


def load_schema(path: Path) -> dict:
    """Parse and verify schema.yaml. Raises ValueError on mis-parse."""
    raw = path.read_text(encoding="utf-8")
    lines: list[tuple[int, str]] = []
    for line in raw.split("\n"):
        stripped = _strip_comment(line).rstrip()
        if not stripped.strip():
            continue
        indent = len(stripped) - len(stripped.lstrip())
        body = stripped.strip()
        # An inline [list] or {map} may wrap across lines. Join onto the previous
        # logical line until the brackets balance, so long value lists can be
        # readably wrapped instead of forced onto one line.
        if lines and (lines[-1][1].count("[") > lines[-1][1].count("]")
                      or lines[-1][1].count("{") > lines[-1][1].count("}")):
            prev_indent, prev_body = lines[-1]
            lines[-1] = (prev_indent, f"{prev_body} {body}")
            continue
        lines.append((indent, body))
    doc, _ = _parse_block(lines, 0, 0)
    if not isinstance(doc, dict):
        raise ValueError("schema.yaml did not parse to a mapping at the top level")
    _verify_shape(doc)
    return doc


# --------------------------------------------------------------------------- checking
def _page_type(fm: dict) -> str | None:
    t = fm.get("type")
    return t if isinstance(t, str) else None


def _fm_keys(text: str) -> list[str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return []
    return [
        mm.group(1)
        for mm in (re.match(r"^([A-Za-z_][\w-]*)\s*:", ln) for ln in m.group(1).split("\n"))
        if mm
    ]


def _fm_dict(text: str) -> dict:
    """Flat frontmatter read. A key whose value is a block list yields "[list]".

    The block-list case is not cosmetic: `raw:` has four shapes in the wild (scalar path,
    block list, quoted prose, empty), and a reader that only understands the scalar form
    reports a page with four archived PDFs as having no origin at all. lint.py's own
    raw-without-source check has this bug; do not reproduce it here.
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    out: dict = {}
    lines = m.group(1).split("\n")
    for idx, ln in enumerate(lines):
        mm = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", ln)
        if not mm:
            continue
        key, val = mm.group(1), mm.group(2).strip()
        if val == "":
            # Look ahead: an indented `- ` block means the value is a list, not absent.
            nxt = next((l for l in lines[idx + 1:] if l.strip()), "")
            if nxt.startswith((" ", "\t")) and nxt.strip().startswith("- "):
                val = "[list]"
        out[key] = val
    return out


def check(wiki: Path, schema: dict) -> dict[str, list[str]]:
    """Run every declared rule. Returns {rule_name: [finding, ...]}.

    Findings name the offending value AND the admissible set — a repairing agent that is
    told only "invalid" cannot self-correct; one told the allowed values can.
    """
    known_keys = set(schema["keys"])
    enums = schema["enums"]
    page_types = schema["page_types"]

    # Which enum governs `status` for this page type? Declared per-type because `status`
    # means different things on an entity than on a concept.
    status_enum_for = {
        pt: name
        for name, en in enums.items()
        if en.get("key") == "status"
        for pt in (en.get("applies_to") or [])
    }

    findings: dict[str, list[str]] = {
        "known_key": [], "enum_value": [], "required_present": [], "source_has_origin": [],
    }

    for p in sorted(wiki.rglob("*.md")):
        if p.name.startswith("_"):  # generated scratch surfaces are non-canonical
            continue
        rel = p.relative_to(wiki.parent)
        text = p.read_text(encoding="utf-8", errors="ignore")
        fm = _fm_dict(text)
        if not fm:
            continue
        ptype = _page_type(fm)
        spec = page_types.get(ptype) if ptype else None

        for k in _fm_keys(text):
            if k not in known_keys:
                findings["known_key"].append(f"{rel}: unknown key '{k}'")

        # `type` itself
        tvals = schema["keys"].get("type", {}).get("values") or []
        if ptype and tvals and ptype not in tvals:
            findings["enum_value"].append(
                f"{rel}: type '{ptype}' — allowed: {' | '.join(map(str, tvals))}"
            )

        if fm.get("kind") and "kind" in enums:
            allowed = enums["kind"]["values"]
            if fm["kind"] not in allowed:
                findings["enum_value"].append(
                    f"{rel}: kind '{fm['kind']}' — allowed: {' | '.join(map(str, allowed))}"
                )

        if "status" in fm and ptype in status_enum_for:
            allowed = enums[status_enum_for[ptype]]["values"]
            val = fm["status"]
            if val == "":
                findings["enum_value"].append(
                    f"{rel}: status is empty — allowed: {' | '.join(map(str, allowed))}"
                )
            elif val not in allowed:
                findings["enum_value"].append(
                    f"{rel}: status '{val}' — allowed: {' | '.join(map(str, allowed))}"
                )

        if spec:
            for req in spec.get("required") or []:
                if not fm.get(req):
                    findings["required_present"].append(f"{rel}: missing required '{req}'")
            if ptype == "source" and not any(
                fm.get(k) for k in ("raw", "url", "path", "virtual")
            ):
                findings["source_has_origin"].append(
                    f"{rel}: no origin declared — set one of: raw: | url: | path: | virtual: true"
                )

    return findings
