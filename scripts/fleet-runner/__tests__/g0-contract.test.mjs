import { afterEach, describe, expect, it } from "vitest";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CLI_REL = "scripts/fleet-runner/verify-contract.mjs";
const CLI = path.join(ROOT, CLI_REL);
const CLIENT_REPO = process.env.FLEET_RUNNER_CLIENT_REPO;
const scratchRoots = [];

afterEach(() => {
  while (scratchRoots.length) rmSync(scratchRoots.pop(), { recursive: true, force: true });
});

function run(node, script, args, { cwd = ROOT, env = process.env } = {}) {
  return spawnSync(node, [script, ...args], { cwd, env, encoding: "utf8" });
}

function requireClientRepo() {
  if (!CLIENT_REPO || !existsSync(path.join(CLIENT_REPO, ".git"))) {
    throw new Error(
      "Set FLEET_RUNNER_CLIENT_REPO to the BookcaseDiscovery repository containing the approved baseline commit.",
    );
  }
  return CLIENT_REPO;
}

function makeCoreFixture() {
  const parent = mkdtempSync(path.join(os.tmpdir(), "fleet-runner-g0-"));
  scratchRoots.push(parent);
  const fixture = path.join(parent, "core");
  const clone = spawnSync("git", ["clone", "--local", "--shared", ROOT, fixture], {
    encoding: "utf8",
  });
  if (clone.status !== 0)
    throw new Error(`could not create committed Core fixture: ${clone.stderr}`);
  const fixtureCli = path.join(fixture, CLI_REL);
  copyFileSync(CLI, fixtureCli);
  symlinkSync(path.join(ROOT, "node_modules"), path.join(fixture, "node_modules"), "dir");
  return fixture;
}

function runFixture(fixture, args = [], env = process.env) {
  return run(
    process.execPath,
    path.join(fixture, CLI_REL),
    ["--client-repo", requireClientRepo(), ...args],
    { cwd: fixture, env },
  );
}

function commitFixtureFile(fixture, relativePath, message) {
  const config = (key, value) =>
    spawnSync("git", ["-C", fixture, "config", key, value], { encoding: "utf8" });
  for (const [key, value] of [
    ["user.name", "G0 contract test"],
    ["user.email", "g0-test@example.invalid"],
  ]) {
    const result = config(key, value);
    if (result.status !== 0) throw new Error(result.stderr);
  }
  for (const args of [
    ["add", relativePath],
    ["commit", "--quiet", "-m", message],
  ]) {
    const result = spawnSync("git", ["-C", fixture, ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  }
}

function editInventory(fixture, update) {
  const file = path.join(fixture, "decisions/fleet-runner/release-one-proof-inventory.json");
  const inventory = JSON.parse(readFileSync(file, "utf8"));
  update(inventory);
  writeFileSync(file, `${JSON.stringify(inventory, null, 2)}\n`);
}

describe("fleet-runner G0 contract verifier", () => {
  it("checks the committed baseline and reports G0 scope without a later-gate verdict", () => {
    const result = run(process.execPath, CLI, ["--client-repo", requireClientRepo()], {
      cwd: ROOT,
    });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({
      format: "fleet-runner-g0-contract-evidence/2",
      scope: "G0 source and contract consistency only; this is not a G1+ execution verdict",
      actualTools: { node: "24.22.2", pnpm: "9.15.4", typescript: "5.9.3", vitest: "2.1.9" },
      coreBaseline: { commit: "973dcfdfc43129353b0ec37fc1a27fcbe97a2f85", sqliteSchema: 2 },
      clientBaseline: { commit: "ff321c6963aa77d10990d71bbf7a7607e887f910" },
      candidate: { sqliteSchema: 3 },
      requiredCaseMappingsChecked: 20,
      gateDefinitionsChecked: 9,
      laterGateExecutionChecked: false,
    });
    expect(report.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(report.sourceTree).toMatch(/^[a-f0-9]{40}$/);
  });

  it("rejects a dirty normative file even when generated evidence files are unrelated", () => {
    const fixture = makeCoreFixture();
    const gatesPath = path.join(fixture, "decisions/fleet-runner/release-one-gates.json");
    writeFileSync(gatesPath, `${readFileSync(gatesPath, "utf8")}\n`);
    const result = runFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("release-one-gates.json differs from its committed HEAD blob");
  });

  it("rejects an uncommitted candidate schema edit rather than describing HEAD as the candidate", () => {
    const fixture = makeCoreFixture();
    const sourcePath = path.join(fixture, "packages/fleet-runner/src/jobs.ts");
    writeFileSync(
      sourcePath,
      readFileSync(sourcePath, "utf8").replace(
        "JOBS_SCHEMA_VERSION = 5",
        "JOBS_SCHEMA_VERSION = 6",
      ),
    );
    const result = runFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "packages/fleet-runner/src/jobs.ts differs from its committed HEAD blob",
    );
  });

  it("rejects a committed source-pin substitution", () => {
    const fixture = makeCoreFixture();
    editInventory(fixture, (inventory) => {
      inventory.baselineCore = "0000000000000000000000000000000000000000";
    });
    commitFixtureFile(
      fixture,
      "decisions/fleet-runner/release-one-proof-inventory.json",
      "mutate approved baseline",
    );
    const result = runFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Core baseline must remain the approved source pin");
  });

  it("rejects a committed case-to-gate remapping", () => {
    const fixture = makeCoreFixture();
    editInventory(fixture, (inventory) => {
      inventory.cases.find((item) => item.id === "G1-AUTH").gate = "G2";
    });
    commitFixtureFile(
      fixture,
      "decisions/fleet-runner/release-one-proof-inventory.json",
      "mutate case mapping",
    );
    const result = runFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "case IDs and gate assignments must match the approved inventory",
    );
  });

  it("rejects committed lockfile tool drift", () => {
    const fixture = makeCoreFixture();
    const lockPath = path.join(fixture, "pnpm-lock.yaml");
    writeFileSync(
      lockPath,
      readFileSync(lockPath, "utf8").replace("lockfileVersion: '9.0'", "lockfileVersion: '8.0'"),
    );
    commitFixtureFile(fixture, "pnpm-lock.yaml", "mutate qualification lockfile");
    const result = runFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Core must keep the reviewed pnpm lockfile format");
  });

  it("rejects qualification tool drift measured from the invoked pnpm", () => {
    const fixture = makeCoreFixture();
    const bin = path.join(fixture, ".test-bin");
    const fakePnpm = path.join(bin, "pnpm");
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
    mkdirSync(bin);
    writeFileSync(
      fakePnpm,
      '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 9.99.0; exit 0; fi\nif [ "$1" = "exec" ] && [ "$2" = "tsc" ]; then echo "Version 5.9.3"; exit 0; fi\nif [ "$1" = "exec" ] && [ "$2" = "vitest" ]; then echo "vitest/2.1.9"; exit 0; fi\nexit 1\n',
      { mode: 0o755 },
    );
    const result = runFixture(fixture, [], env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("actual qualification tools must match the reviewed pins");
  });
});
