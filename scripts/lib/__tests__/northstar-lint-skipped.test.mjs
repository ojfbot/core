import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../northstar-lint.mjs");
const base = mkdtempSync(path.join(os.tmpdir(), "ns-skipped-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

// A core with one northstar that exists and two whose repos are not on disk.
const core = path.join(base, "core");
mkdirSync(path.join(core, "decisions/northstar"), { recursive: true });
writeFileSync(
  path.join(core, "decisions/northstar/README.md"),
  `---
registry:
  - slug: l3-x
    tier: L3
    path: decisions/northstar/l3-x.md
    ladders_up_to: null
  - slug: l1-a
    tier: L1
    path: ../a/.claude/northstar.md
    ladders_up_to: l3-x
  - slug: l1-b
    tier: L1
    path: ../b/.claude/northstar.md
    ladders_up_to: l3-x
---
`,
);
writeFileSync(
  path.join(core, "decisions/northstar/l3-x.md"),
  `---
slug: l3-x
tier: L3
properties:
  - id: P1
    name: one
    target: t
    verification: v
    current: 50
---
`,
);

const run = (...args) =>
  spawnSync(process.execPath, [CLI, "--core", core, ...args], { encoding: "utf8" });

describe("northstar-lint skipped entries", () => {
  it("prints how many entries were checked and skipped", () => {
    const r = run();
    expect(r.stdout).toContain("Checked 1 of 3 entries; skipped 2");
  });

  it("fails when more entries are skipped than --max-skipped allows", () => {
    expect(run("--check", "--max-skipped", "2").status).toBe(0);
    const r = run("--check", "--max-skipped", "1");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("2 entries skipped, more than the allowed 1");
  });

  it("rejects a missing or non-numeric --max-skipped instead of turning the limit off", () => {
    for (const args of [["--max-skipped"], ["--max-skipped", "many"], ["--max-skipped", "--check"]]) {
      const r = run(...args);
      expect(r.status, args.join(" ")).toBe(2);
      expect(r.stderr).toContain("--max-skipped needs a whole number");
    }
  });
});
