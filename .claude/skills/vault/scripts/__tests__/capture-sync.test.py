import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("capture", Path(__file__).resolve().parents[1] / "capture-sync.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class CaptureProofs(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        for name in ["raw", "wiki", "diagrams"]:
            (self.root / name).mkdir()
        for name in ["AGENTS.md", "CLAUDE.md"]:
            (self.root / name).write_text("schema\n")
        self.config = {"local_path": str(self.root), "vault_id": "test", "remote": "expected", "cli": "unused"}
        self.payload = b"a controlled synthetic note\n"

    def tearDown(self):
        self.temp.cleanup()

    def fake_cli(self, config, *args):
        if args[0] == "vault":
            return ("name\ttest\npath\t" + str(self.root) + "\n").encode()
        if args[0] == "sync:status":
            return b"status: synced\nvault: expected\n"
        if args[0] == "sync:history":
            return b"0: 2026-11-05 22:00:00 (42 bytes) [test]\n"
        if args[0] == "sync:read":
            return b"raw/test.md (version 0, 2026-11-05 22:00:00)\n---\n" + self.payload
        raise AssertionError(args)

    def test_positive_hosted_receipt_and_identical_retry(self):
        with patch.object(c, "cli", self.fake_cli):
            first = c.capture(self.config, "raw/test.md", self.payload, 0)
            second = c.capture(self.config, "raw/test.md", self.payload, 0)
        self.assertEqual((first["landing"], second["landing"]), ("created", "reused-identical"))
        self.assertEqual(first["hosted"], "exact")
        self.assertEqual(first["peer"], "not-verified")
        self.assertEqual(list((self.root / "raw").glob("*.md")), [self.root / "raw/test.md"])

    def test_wrong_path_refuses_before_write(self):
        def wrong(config, *args):
            return b"path\t/wrong\n" if args[0] == "vault" else self.fake_cli(config, *args)
        with patch.object(c, "cli", wrong), self.assertRaises(c.Refused):
            c.capture(self.config, "raw/test.md", self.payload, 0)
        self.assertFalse((self.root / "raw/test.md").exists())

    def test_wrong_remote_and_sync_error_refuse_before_write(self):
        for status in [b"status: synced\nvault: wrong\n", b"status: error\nvault: expected\n"]:
            def bad(config, *args):
                return status if args[0] == "sync:status" else self.fake_cli(config, *args)
            with patch.object(c, "cli", bad), self.assertRaises(c.Refused):
                c.capture(self.config, "raw/test.md", self.payload, 0)
        self.assertFalse((self.root / "raw/test.md").exists())

    def test_git_copy_rejected(self):
        (self.root / ".git").mkdir()
        with self.assertRaises(c.Refused):
            c.identity(self.config)

    def test_traversal_hidden_attachment_and_shared_pages_rejected(self):
        for path in ["../outside.md", "/outside.md", "raw/.hidden.md", "raw/note.pdf", "wiki/index.md", "wiki/log.md"]:
            with self.subTest(path=path), self.assertRaises(c.Refused):
                c.safe_destination(self.root, path)

    def test_symlink_parent_and_destination_rejected(self):
        (self.root / "raw/link").symlink_to(self.root / "diagrams", target_is_directory=True)
        (self.root / "raw/note.md").symlink_to(self.root / "CLAUDE.md")
        for path in ["raw/link/note.md", "raw/note.md"]:
            with self.assertRaises(c.Refused):
                c.safe_destination(self.root, path)

    def test_existing_different_content_never_overwritten(self):
        target = self.root / "raw/test.md"
        target.write_bytes(b"competing edit\n")
        with patch.object(c, "cli", self.fake_cli), self.assertRaises(c.Refused):
            c.capture(self.config, "raw/test.md", self.payload, 0)
        self.assertEqual(target.read_bytes(), b"competing edit\n")

    def test_hosted_mismatch_is_not_success_and_does_not_rewrite(self):
        def conflict(config, *args):
            if args[0] == "sync:read":
                return b"raw/test.md (version 0, 2026-11-05 22:00:00)\n---\ncompeting hosted edit\n"
            return self.fake_cli(config, *args)
        with patch.object(c, "cli", conflict):
            receipt = c.capture(self.config, "raw/test.md", self.payload, 0)
        self.assertEqual(receipt["hosted"], "conflict")
        self.assertEqual((self.root / "raw/test.md").read_bytes(), self.payload)

    def test_cli_persists_conflict_receipt_and_exits_nonzero(self):
        config = self.root / "config.json"
        config.write_text(json.dumps(self.config))
        source = self.root / "source.md"
        source.write_bytes(self.payload)
        receipt = self.root / "receipt.json"
        original = self.fake_cli
        def conflict(config, *args):
            if args[0] == "sync:read":
                return b"raw/test.md (version 0, 2026-11-05 22:00:00)\n---\ncompeting hosted edit\n"
            return original(config, *args)
        argv = ["capture.py", "--config", str(config), "--source", str(source), "--path", "raw/test.md", "--receipt", str(receipt), "--timeout", "0"]
        with patch.object(c, "cli", conflict), patch.object(sys, "argv", argv), self.assertRaises(SystemExit) as error:
            c.main()
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(json.loads(receipt.read_text())["hosted"], "conflict")
        self.assertEqual(source.read_bytes(), self.payload)

    def test_missing_hosted_receipt_stays_pending(self):
        def offline(config, *args):
            if args[0] == "sync:history":
                raise c.Refused("No hosted version")
            return self.fake_cli(config, *args)
        with patch.object(c, "cli", offline):
            result = c.capture(self.config, "raw/test.md", self.payload, 0)
        self.assertEqual(result["local"], "exact")
        self.assertEqual(result["hosted"], "pending")

    def test_overlapping_parallel_writes_accept_only_one(self):
        target = self.root / "raw/test.md"
        payloads = [b"writer one\n", b"writer two\n"]
        def write(data):
            try:
                return c.land(target, data)
            except c.Refused:
                return "refused"
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(write, payloads))
        self.assertEqual(sorted(results), ["created", "refused"])
        self.assertIn(target.read_bytes(), payloads)
        self.assertFalse(list((self.root / "raw").glob(".selfco-capture-*")))

    def test_distinct_parallel_writes_preserve_both(self):
        paths = [self.root / "raw/one.md", self.root / "raw/two.md"]
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda p: c.land(p, self.payload), paths))
        self.assertEqual(results, ["created", "created"])
        self.assertEqual([p.read_bytes() for p in paths], [self.payload, self.payload])

    def test_real_kill_before_commit_then_retry_lands_once(self):
        target = self.root / "raw/test.md"
        ready = self.root / "ready"
        program = '''import importlib.util,os,time,sys
from pathlib import Path
s=importlib.util.spec_from_file_location("c",sys.argv[1]);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
def wait(*args):
 Path(sys.argv[3]).write_text("ready")
 time.sleep(30)
c.os.link=wait
c.land(Path(sys.argv[2]),b"a controlled synthetic note\\n")
'''
        child = subprocess.Popen([sys.executable, "-c", program, str(Path(c.__file__)), str(target), str(ready)])
        try:
            import time
            deadline = time.monotonic() + 5
            while not ready.exists() and time.monotonic() < deadline:
                time.sleep(.01)
            self.assertTrue(ready.exists())
            child.kill()
            child.wait(timeout=5)
            self.assertFalse(target.exists())
            self.assertEqual(c.land(target, self.payload), "created")
            self.assertEqual(c.land(target, self.payload), "reused-identical")
            self.assertEqual(target.read_bytes(), self.payload)
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()


if __name__ == "__main__":
    unittest.main(verbosity=2)
