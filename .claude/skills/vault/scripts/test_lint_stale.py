"""Synthetic vault regressions for the read-only staleness report."""

import importlib.util
import hashlib
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


LINT = Path(__file__).with_name("lint.py")
spec = importlib.util.spec_from_file_location("vault_lint", LINT)
assert spec and spec.loader
lint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lint)


class LintStaleTest(unittest.TestCase):
    def assert_log_fixture(self, op, *, creation=False, same_day=False, nested_log=False, shallow=False):
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            entities = vault / "wiki" / "entities"
            entities.mkdir(parents=True)
            (vault / "raw").mkdir()
            (entities / "example.md").write_text("Page\n")
            (vault / "wiki" / "index.md").write_text("[[entities/example]]\n")
            old = datetime.now(timezone.utc) - timedelta(days=200)
            creation_log = f"## [{old.date()}] ingest\nCreated [[entities/example]].\n"
            (vault / "wiki" / "log.md").write_text(creation_log if creation else "Log\n")
            if nested_log:
                (entities / "log.md").write_text("Knowledge page [[entities/example]].\n")
            subprocess.run(["git", "init", "-q", str(vault)], check=True)
            subprocess.run(["git", "add", "wiki"], cwd=vault, check=True)
            env = {**os.environ, "GIT_AUTHOR_DATE": old.isoformat(), "GIT_COMMITTER_DATE": old.isoformat()}
            commit = ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture"]
            subprocess.run(commit, cwd=vault, env=env, check=True)
            if not creation and not nested_log:
                day = old.date() if same_day else datetime.now(timezone.utc).date()
                (vault / "wiki" / "log.md").write_text(f"## [{day}] {op}\nRevisited [[entities/example]].\n")
                subprocess.run(["git", "add", "wiki/log.md"], cwd=vault, check=True)
                subprocess.run(commit, cwd=vault, env=env if same_day else None, check=True)
            if shallow:
                clone = vault / "shallow-vault"
                subprocess.run(["git", "clone", "-q", "--depth=1", vault.as_uri(), str(clone)], check=True)
                vault = clone
            before = {str(p.relative_to(vault)): hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in (vault / "wiki").rglob("*.md")}
            status = subprocess.run(["git", "status", "--short"], cwd=vault, capture_output=True, text=True, check=True).stdout
            result = subprocess.run([sys.executable, str(LINT), str(vault), "--stale", "--days=90", "--gate"],
                                    capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("orphan pages (no inbound [[link]]): 0", result.stdout)
            self.assertIn("GATE OK", result.stdout)
            after = {str(p.relative_to(vault)): hashlib.sha256(p.read_bytes()).hexdigest()
                     for p in (vault / "wiki").rglob("*.md")}
            self.assertEqual(after, before)
            self.assertEqual(subprocess.run(["git", "status", "--short"], cwd=vault, capture_output=True,
                                           text=True, check=True).stdout, status)
            return result.stdout.split("== stale pages", 1)[1].split("(Stale =", 1)[0]

    def test_creation_shaped_later_references_stay_active(self):
        for op in ("ingest", "research", "note", "create"):
            with self.subTest(op=op):
                report = self.assert_log_fixture(op)
                self.assertNotIn("| wiki/entities/example.md |", report)

    def test_knowledge_page_named_log_preserves_inbound_demand(self):
        report = self.assert_log_fixture("review", nested_log=True)
        self.assertNotIn("| wiki/entities/example.md |", report)

    def test_same_day_later_entry_is_not_creation_evidence(self):
        report = self.assert_log_fixture("note", same_day=True)
        self.assertNotIn("| wiki/entities/example.md |", report)

    def test_verified_creation_only_entry_allows_stale_without_orphan(self):
        report = self.assert_log_fixture("ingest", creation=True)
        self.assertIn("| wiki/entities/example.md |", report)

    def test_shallow_history_does_not_prove_creation(self):
        report = self.assert_log_fixture("note", same_day=True, shallow=True)
        self.assertNotIn("| wiki/entities/example.md |", report)

    def test_log_and_graph_boundaries_in_cli(self):
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            wiki = vault / "wiki"
            entities = wiki / "entities"
            entities.mkdir(parents=True)
            (vault / "raw").mkdir()
            pages = {
                "creation-only": "Page",
                "later-header": "Page",
                "later-body": "Page",
                "index-only": "Page",
                "real-inbound": "Page",
                "substring": "Page",
                "reference": "---\ncategory: reference-data\n---\nPage",
                "ignored": "---\nstaleness: ignore\n---\nPage",
            }
            for slug, content in pages.items():
                (entities / f"{slug}.md").write_text(content)
            (wiki / "index.md").write_text("[[entities/index-only]]\n")
            (wiki / "demand.md").write_text("[[entities/real-inbound]]\n")
            old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
            (wiki / "log.md").write_text(
                f"## [{old[:10]}] ingest\n"
                "Created [[entities/creation-only]], later-header, later-body, substring.\n"
                "## [2026-09-20] review later-header\nStill useful.\n"
                "## [2026-09-21] review\nLater check of later-body.\n"
                "## [2026-09-22] review\nsubstring-extra is not the page.\n"
            )
            subprocess.run(["git", "init", "-q", str(vault)], check=True)
            subprocess.run(["git", "add", "."], cwd=vault, check=True)
            env = {**os.environ, "GIT_AUTHOR_DATE": old, "GIT_COMMITTER_DATE": old}
            subprocess.run(
                ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture"],
                cwd=vault, env=env, check=True,
            )
            (entities / "untracked.md").write_text("New page")
            before = subprocess.run(["git", "status", "--short"], cwd=vault, capture_output=True, text=True, check=True).stdout

            result = subprocess.run(
                [sys.executable, str(LINT), str(vault), "--stale", "--days=90", "--gate"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            stale_report = result.stdout.split("== stale pages", 1)[1].split("(Stale =", 1)[0]
            for slug in ("creation-only", "index-only", "substring"):
                self.assertIn(f"| wiki/entities/{slug}.md |", stale_report)
            for slug in ("later-header", "later-body", "real-inbound", "reference", "ignored", "untracked"):
                self.assertNotIn(f"| wiki/entities/{slug}.md |", stale_report)
            self.assertIn("GATE OK", result.stdout)
            after = subprocess.run(["git", "status", "--short"], cwd=vault, capture_output=True, text=True, check=True).stdout
            self.assertEqual(after, before)

    def test_git_age_boundary_without_log_mentions(self):
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            page = vault / "wiki" / "entities" / "example.md"
            page.parent.mkdir(parents=True)
            page.write_text("Page")
            # Threshold behavior is independent of log creation proof, covered by CLI fixtures.
            log = ""
            with patch.object(lint, "git_age_days", return_value=89):
                self.assertFalse(lint.is_stale(page, 0, 90, log, vault)[0])
            with patch.object(lint, "git_age_days", return_value=90):
                self.assertTrue(lint.is_stale(page, 0, 90, log, vault)[0])
            with patch.object(lint, "git_age_days", return_value=None):
                self.assertFalse(lint.is_stale(page, 0, 90, log, vault)[0])


if __name__ == "__main__":
    unittest.main()
