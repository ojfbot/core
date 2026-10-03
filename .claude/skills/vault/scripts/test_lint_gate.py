"""Behavioral checks for the transport inbox boundary in lint.py --gate."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


LINT = Path(__file__).with_name("lint.py")


class LintGateTest(unittest.TestCase):
    def test_inbox_is_reported_but_does_not_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            (vault / "wiki" / "sources").mkdir(parents=True)
            (vault / "raw" / "inbox").mkdir(parents=True)
            (vault / "raw" / "inbox" / "capture.md").write_text("Capture\n")

            result = subprocess.run(
                [sys.executable, str(LINT), str(vault), "--gate"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("raw/inbox/capture.md", result.stdout)
            self.assertIn("advisory filing queue", result.stdout)
            self.assertIn("GATE OK", result.stdout)

            (vault / "raw" / "unfiled.md").write_text("Unfiled\n")
            result = subprocess.run(
                [sys.executable, str(LINT), str(vault), "--gate"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("1 raw/ item(s) outside raw/inbox/", result.stderr)

            (vault / "wiki" / "sources" / "unfiled.md").write_text(
                "---\ntype: source\nraw: raw/unfiled.md\n---\n"
            )
            result = subprocess.run(
                [sys.executable, str(LINT), str(vault), "--gate"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
