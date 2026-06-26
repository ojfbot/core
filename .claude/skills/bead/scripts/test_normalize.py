#!/usr/bin/env python3
"""
Tests for normalize.py — the bead schema-drift shim.

Run:  /usr/bin/python3 -m pytest .claude/skills/bead/scripts/test_normalize.py
  or: /usr/bin/python3 .claude/skills/bead/scripts/test_normalize.py

Uses stdlib unittest (pytest discovers it too) so it runs on any interpreter that has
PyYAML — matching how the rest of the bead scripts ship.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize  # noqa: E402


class StatusNormalization(unittest.TestCase):
    def test_canonical_passthrough(self):
        for s in ("live", "closed", "superseded"):
            drift: list[str] = []
            self.assertEqual(normalize.normalize_status(s, drift), s)
            self.assertEqual(drift, [])

    def test_open_maps_to_live(self):
        drift: list[str] = []
        self.assertEqual(normalize.normalize_status("open", drift), "live")
        self.assertTrue(drift)

    def test_dolt_world_aliases(self):
        cases = {"created": "live", "active": "live", "done": "closed",
                 "archived": "closed", "cancelled": "closed"}
        for raw, expected in cases.items():
            self.assertEqual(normalize.normalize_status(raw, []), expected)

    def test_missing_status_defaults_live_with_drift(self):
        drift: list[str] = []
        self.assertEqual(normalize.normalize_status(None, drift), "live")
        self.assertTrue(drift)

    def test_unknown_status_kept_and_flagged(self):
        drift: list[str] = []
        self.assertEqual(normalize.normalize_status("weird", drift), "weird")
        self.assertTrue(drift)


class ActorNormalization(unittest.TestCase):
    def test_parenthetical_stripped(self):
        drift: list[str] = []
        out = normalize.normalize_actor("code-claude (the /vault v1-v5 session)", drift)
        self.assertEqual(out, "code-claude")
        self.assertTrue(drift)

    def test_plain_actor_untouched(self):
        drift: list[str] = []
        self.assertEqual(normalize.normalize_actor("code-claude", drift), "code-claude")
        self.assertEqual(drift, [])

    def test_none(self):
        self.assertIsNone(normalize.normalize_actor(None, []))


class HookNormalization(unittest.TestCase):
    def test_single_hook_passthrough(self):
        hook, extra = normalize.normalize_hook({"hook": "core-117"}, [])
        self.assertEqual(hook, "core-117")
        self.assertEqual(extra, [])

    def test_null_hook(self):
        self.assertEqual(normalize.normalize_hook({"hook": None}, []), (None, []))

    def test_hooks_list_of_prose_becomes_none(self):
        drift: list[str] = []
        hook, extra = normalize.normalize_hook(
            {"hooks": ["MERGED: PR #165 rebase-merged to origin/main as c03fc2e"]}, drift)
        self.assertIsNone(hook)
        self.assertTrue(extra)        # prose preserved, not lost
        self.assertTrue(drift)

    def test_hooks_list_with_id_promoted(self):
        drift: list[str] = []
        hook, extra = normalize.normalize_hook({"hooks": ["opav-s1-c3", "and some prose"]}, drift)
        self.assertEqual(hook, "opav-s1-c3")
        self.assertIn("and some prose", extra)


class CreatedAtDerivation(unittest.TestCase):
    def test_explicit_created_at(self):
        iso = normalize.derive_created_at({"created_at": "2026-06-13T19:59:00Z"}, None, [])
        self.assertEqual(iso, "2026-06-13T19:59:00Z")

    def test_date_field_drift(self):
        drift: list[str] = []
        iso = normalize.derive_created_at({"date": "2026-06-18"}, None, drift)
        self.assertEqual(iso, "2026-06-18T00:00:00Z")
        self.assertTrue(drift)

    def test_from_id_with_time(self):
        iso = normalize.derive_created_at({"id": "20260613-1959-brief-x"}, None, [])
        self.assertEqual(iso, "2026-06-13T19:59:00Z")

    def test_from_filename_dashed(self):
        iso = normalize.derive_created_at({}, Path("2026-06-13-opav-loop-program.md"), [])
        self.assertEqual(iso, "2026-06-13T00:00:00Z")

    def test_from_filename_compact_with_time(self):
        iso = normalize.derive_created_at({}, Path("20260618-1959-report-x.md"), [])
        self.assertEqual(iso, "2026-06-18T19:59:00Z")

    def test_undatable(self):
        drift: list[str] = []
        self.assertIsNone(normalize.derive_created_at({}, None, drift))
        self.assertTrue(drift)


class RefsNormalization(unittest.TestCase):
    def test_scalar_wrapped(self):
        drift: list[str] = []
        self.assertEqual(normalize.normalize_refs("adr:0095", drift), ["adr:0095"])
        self.assertTrue(drift)

    def test_list_passthrough(self):
        self.assertEqual(normalize.normalize_refs(["a", "b"], []), ["a", "b"])

    def test_none_is_empty(self):
        self.assertEqual(normalize.normalize_refs(None, []), [])


class FullBeadAndCorpus(unittest.TestCase):
    def test_unparseable_file_is_drift_not_crash(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "no-frontmatter.md"
            p.write_text("# Just a heading, no frontmatter\n")
            out = normalize.parse_and_normalize(p)
            self.assertTrue(out.get("_unparseable"))
            self.assertTrue(out.get("_drift"))

    def test_heavily_drifted_bead_fully_canonicalized(self):
        raw = {
            "type": "report",
            "actor": "code-claude (the session)",
            "status": "open",
            "date": "2026-06-18",
            "hooks": ["MERGED: PR #165 ..."],
            "refs": "adr:0095",
        }
        out = normalize.normalize_bead(raw, Path("20260618-report-x.md"))
        self.assertEqual(out["status"], "live")
        self.assertEqual(out["actor"], "code-claude")
        self.assertEqual(out["created_at"], "2026-06-18T00:00:00Z")
        self.assertIsNone(out["hook"])
        self.assertEqual(out["refs"], ["adr:0095"])
        self.assertEqual(out["id"], "20260618-report-x")  # derived from filename stem
        self.assertTrue(out["_drift"])

    def test_real_handoff_corpus_all_canonical_or_flagged(self):
        root = Path(__file__).resolve().parents[4] / ".handoff"
        if not root.exists():
            self.skipTest(f"no .handoff at {root}")
        beads = normalize.load_normalized(root)
        self.assertTrue(beads, "expected real beads in the corpus")
        for b in beads:
            if b.get("_unparseable"):
                self.assertTrue(b.get("_drift"))  # surfaced, never silent
                continue
            # Every parsed bead has a canonical status...
            self.assertIn(b["status"], {"live", "closed", "superseded"})
            # ...and a derivable timestamp (the join key for provenance).
            self.assertIsNotNone(b["created_at"], f"{b.get('_path')} has no created_at")


if __name__ == "__main__":
    unittest.main(verbosity=2)
