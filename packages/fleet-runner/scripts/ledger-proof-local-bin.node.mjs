import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = dirname(fileURLToPath(import.meta.url));

test("symlinked installed entry points reject invalid arguments", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-proof-bins-"));
  try {
    for (const [name, reason] of [
      ["bind", "proof-bind-arguments"],
      ["guard", "proof-guard-arguments"],
      ["operator", "proof-operator-arguments"],
    ]) {
      const link = join(root, `fleet-runner-proof-${name}`);
      symlinkSync(join(scripts, `ledger-proof-local-${name}.mjs`), link);
      const result = spawnSync(process.execPath, [link, "--invalid"], { encoding: "utf8" });
      assert.equal(result.status, 1, name);
      assert.equal(result.stdout, "", name);
      assert.match(result.stderr, new RegExp(`^${reason}\\n$`), name);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
