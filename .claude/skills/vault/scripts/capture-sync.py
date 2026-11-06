#!/usr/bin/env python3
"""Create-only Markdown landing with pinned Obsidian identity and hosted receipt."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time


class Refused(RuntimeError):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def cli(config, *args):
    result = subprocess.run(
        [config["cli"], "vault=" + config["vault_id"], *args],
        capture_output=True, timeout=10, check=False,
    )
    if result.returncode or result.stderr or result.stdout.startswith((b"Error:", b"Command line interface")):
        raise Refused("Obsidian command failed; no successful receipt")
    return result.stdout


def fields(data):
    result = {}
    for line in data.decode("utf-8").splitlines():
        if "\t" in line:
            key, value = line.split("\t", 1)
        elif ": " in line:
            key, value = line.split(": ", 1)
        else:
            continue
        if key in result:
            raise Refused("Ambiguous identity response")
        result[key] = value
    return result


def identity(config):
    root = Path(config["local_path"])
    if not root.is_absolute() or root.is_symlink() or root.resolve() != root:
        raise Refused("Vault root must be an explicit real directory")
    if not root.is_dir() or (root / ".git").exists():
        raise Refused("Target is missing or is a historical Git copy")
    if not (root / "AGENTS.md").is_file() or not (root / "CLAUDE.md").is_file():
        raise Refused("Vault schemas missing")
    actual = fields(cli(config, "vault"))
    if actual.get("path") != str(root):
        raise Refused("Running vault path does not match the pinned target")
    status = fields(cli(config, "sync:status"))
    if status.get("vault") != config["remote"] or status.get("status") != "synced":
        raise Refused("Wrong remote or Sync is not healthy and synced")
    return root


def safe_destination(root, relative):
    parts = Path(relative).parts
    if not parts or Path(relative).is_absolute() or any(p in (".", "..") or p.startswith(".") for p in parts):
        raise Refused("Unsafe relative path")
    if parts[0] not in ("raw", "wiki", "diagrams") or Path(relative).suffix != ".md":
        raise Refused("Only new Markdown captures are qualified; attachments are incomplete")
    if relative in ("wiki/index.md", "wiki/log.md"):
        raise Refused("Shared index and ledger require a coordinated writer")
    parent = root
    for part in parts[:-1]:
        parent = parent / part
        if parent.is_symlink() or not parent.is_dir():
            raise Refused("Destination parent must already be a real directory")
    target = root / relative
    if target.is_symlink():
        raise Refused("Destination is a symbolic link")
    return target


def land(target, payload):
    if target.exists():
        if not target.is_file() or target.read_bytes() != payload:
            raise Refused("Existing content differs; preserve both versions and coordinate")
        return "reused-identical"
    fd, name = tempfile.mkstemp(prefix=".selfco-capture-", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        try:
            os.link(name, target)
        except FileExistsError:
            if not target.is_file() or target.is_symlink() or target.read_bytes() != payload:
                raise Refused("Concurrent writer won with different content; no overwrite")
            return "reused-identical"
        directory = os.open(target.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return "created"
    finally:
        os.unlink(name)


def hosted_bytes(config, relative):
    # Obsidian's CLI adds two display lines. Strip only this validated header.
    output = cli(config, "sync:read", "path=" + relative, "version=0")
    lines = output.split(b"\n", 2)
    prefix = relative.encode("utf-8") + b" (version 0, "
    if len(lines) != 3 or not lines[0].startswith(prefix) or not lines[0].endswith(b")") or lines[1] != b"---":
        raise Refused("Unrecognized hosted-version display format")
    return lines[2]


def capture(config, relative, payload, timeout=30):
    if not payload.endswith(b"\n"):
        raise Refused("Qualified Markdown payloads must end in a newline")
    payload.decode("utf-8")
    root = identity(config)
    target = safe_destination(root, relative)
    outcome = land(target, payload)
    receipt = {"path": relative, "payload_sha256": digest(payload), "landing": outcome,
               "local": "exact", "hosted": "pending", "peer": "not-verified", "git_operations": 0}
    deadline = time.monotonic() + timeout
    while True:
        try:
            identity(config)
            history = cli(config, "sync:history", "path=" + relative)
            if not re.match(rb"0: \d{4}-\d\d-\d\d ", history):
                raise Refused("No latest hosted version yet")
            data = hosted_bytes(config, relative)
            if data != payload:
                receipt.update(hosted="conflict", attention="Hosted content differs; writers must stop for review")
                return receipt
            if target.read_bytes() != payload:
                receipt.update(local="conflict", attention="Local content changed while awaiting receipt")
                return receipt
            receipt.update(hosted="exact", hosted_history=history.decode("utf-8").splitlines()[0], remote=config["remote"])
            return receipt
        except Refused as error:
            # Conflicting bytes are never retried or rewritten.
            if "differs" in str(error) or "changed" in str(error):
                raise
            if time.monotonic() >= deadline:
                receipt["attention"] = str(error)
                return receipt
            time.sleep(min(1, max(0, deadline - time.monotonic())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="Verify identity and health without writing")
    parser.add_argument("--source", type=Path)
    parser.add_argument("--path")
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    if args.check:
        root = identity(config)
        print(json.dumps({"local_path": str(root), "vault_id": config["vault_id"], "remote": config["remote"], "health": "synced", "write": False}))
        return
    if args.source is None or args.path is None or args.receipt is None:
        parser.error("capture requires --source, --path and a unique --receipt attempt path")
    receipt = capture(config, args.path, args.source.read_bytes(), args.timeout)
    # Receipt lives outside the vault. It cannot overwrite an earlier claim.
    with args.receipt.open("x") as f:
        json.dump(receipt, f, indent=2)
        f.write("\n")
    print(json.dumps({k: v for k, v in receipt.items() if k != "payload_sha256"}))
    raise SystemExit(0 if receipt["hosted"] == "exact" and receipt["local"] == "exact" else 2)


if __name__ == "__main__":
    main()
