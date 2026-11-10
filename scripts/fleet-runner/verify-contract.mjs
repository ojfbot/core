#!/usr/bin/env node
// Verify G0 source and contract consistency. This does not execute or pass later gates.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CORE_BASELINE = "973dcfdfc43129353b0ec37fc1a27fcbe97a2f85";
const CLIENT_BASELINE = "ff321c6963aa77d10990d71bbf7a7607e887f910";
const APPROVED_TOOLS = Object.freeze({
  node: "24.22.2",
  pnpm: "9.15.4",
  typescript: "5.9.3",
  vitest: "2.1.9",
});
const REQUIRED_CASES = Object.freeze({
  "G0-SCOPE": "G0",
  "G1-MODEL": "G1",
  "G1-AUTH": "G1",
  "G1-RESTART-REPLAY": "G1",
  "G1-NONCE-CONTENTION": "G1",
  "G1-LEASE-FENCE": "G1",
  "G1-LOST-RESPONSE": "G1",
  "G1-OUTPUT-ROLLBACK": "G1",
  "G1-MUTANTS": "G1",
  "G1-EVIDENCE": "G1",
  "G2-CLEAN-INSTALL": "G2",
  "G2-AMD64": "G2",
  "G2-PACKAGE": "G2",
  "G3-RESTART": "G3",
  "G4-MACS": "G4",
  "G5-INSPECT": "G5",
  "G6-FAULTS": "G6",
  "G6-HELPDESK": "G6",
  "G7-RESTORE": "G7",
  "G8-CUTOVER": "G8",
});
const REQUIRED_MUTANTS = [
  "owner-authorization",
  "completion-fence",
  "output-digest",
  "durable-replay",
];
const INVENTORY_PATH = "decisions/fleet-runner/release-one-proof-inventory.json";
const GATES_PATH = "decisions/fleet-runner/release-one-gates.json";
const CONTRACT_PATH = "decisions/fleet-runner/release-one-g0-g2.md";
const CORE_SCHEMA_PATH = "packages/fleet-runner/src/jobs.ts";
const LOCK_PATH = "pnpm-lock.yaml";
const SCRIPT_PATH = "scripts/fleet-runner/verify-contract.mjs";
const CHECKED_PATHS = [
  INVENTORY_PATH,
  GATES_PATH,
  CONTRACT_PATH,
  "package.json",
  LOCK_PATH,
  "packages/fleet-runner/package.json",
  CORE_SCHEMA_PATH,
  SCRIPT_PATH,
];

const usage =
  "Usage: node scripts/fleet-runner/verify-contract.mjs --client-repo <BookcaseDiscovery git repository>";

function parseClientRepo(args) {
  if (args.length !== 2 || args[0] !== "--client-repo" || !args[1]) {
    if (args.length === 1 && args[0] === "--help") {
      console.log(usage);
      process.exit(0);
    }
    throw new Error(usage);
  }
  return resolve(args[1]);
}

function git(repo, args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function show(repo, revision, path) {
  return execFileSync("git", ["show", `${revision}:${path}`], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function read(repo, path) {
  return readFileSync(resolve(repo, path), "utf8");
}

function readJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function packageMetadata(repo, revision) {
  return readJson(show(repo, revision, "package.json"), `${revision}:package.json`);
}

function schemaVersion(source, label) {
  const match = source.match(/^export const JOBS_SCHEMA_VERSION = ([0-9]+);$/m);
  assert.ok(match, `${label} must declare JOBS_SCHEMA_VERSION`);
  return Number(match[1]);
}

function toolVersion(root, args, pattern, label) {
  const output = execFileSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const match = output.match(pattern);
  assert.ok(match, `could not read ${label} version from: ${output}`);
  return match[1];
}

function verifyContract({ root, clientRepo }) {
  const gitAtRoot = (args) => git(root, args);
  const candidateCommit = gitAtRoot(["rev-parse", "HEAD"]);
  const candidateTree = gitAtRoot(["rev-parse", "HEAD^{tree}"]);
  for (const path of CHECKED_PATHS) {
    const working = read(root, path);
    const committed = show(root, "HEAD", path);
    assert.equal(working, committed, `${path} differs from its committed HEAD blob`);
  }

  const inventoryText = read(root, INVENTORY_PATH);
  const gatesText = read(root, GATES_PATH);
  const contract = read(root, CONTRACT_PATH);
  const inventory = readJson(inventoryText, INVENTORY_PATH);
  const gates = readJson(gatesText, GATES_PATH);

  assert.equal(inventory.format, "fleet-runner-release-one-inventory/1");
  assert.equal(
    inventory.baselineCore,
    CORE_BASELINE,
    "Core baseline must remain the approved source pin",
  );
  assert.equal(
    inventory.baselineClient,
    CLIENT_BASELINE,
    "BookcaseDiscovery baseline must remain the approved source pin",
  );
  assert.deepEqual(
    inventory.qualificationTools,
    APPROVED_TOOLS,
    "qualification tool pins must remain approved",
  );
  assert.deepEqual(
    inventory.requiredG1Mutants,
    REQUIRED_MUTANTS,
    "required G1 mutant names must remain complete",
  );
  assert.ok(
    contract.includes(`| Core compute pilot | ${CORE_BASELINE}, PR #584 head |`),
    "contract must identify the approved Core baseline",
  );
  assert.ok(
    contract.includes(`| BookcaseDiscovery client | ${CLIENT_BASELINE}, PR #59 head |`),
    "contract must identify the approved client baseline",
  );
  assert.ok(
    contract.includes(
      "A HelpDesk message is neither an admission grant nor evidence of execution.",
    ),
  );
  assert.ok(
    contract.includes(
      "Activity and shared-resource policy must be resolved and tested at G4 before expanding eligibility.",
    ),
  );
  assert.ok(
    contract.includes(
      "20:00 inclusive to 07:00 exclusive America/Chicago, verified external power, and only explicitly bounded daytime exceptions.",
    ),
    "contract must preserve the approved laptop eligibility boundary",
  );
  assert.ok(
    contract.includes(
      "No coding-agent executor, arbitrary shell workload, GitHub publication or automatic merge authority follows from this contract.",
    ),
    "contract must preserve the release-one execution authority boundary",
  );
  assert.ok(
    contract.includes("These cases remain UNTESTED until their own resolvable evidence exists."),
  );

  const expectedCaseMapping = Object.entries(REQUIRED_CASES).sort(([a], [b]) => a.localeCompare(b));
  const actualCaseMapping = inventory.cases
    .map(({ id, gate }) => [id, gate])
    .sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(
    actualCaseMapping,
    expectedCaseMapping,
    "case IDs and gate assignments must match the approved inventory",
  );

  assert.equal(gates.length, 9);
  assert.deepEqual(
    gates.map(({ id }) => id),
    Array.from({ length: 9 }, (_, index) => `G${index}`),
  );
  for (const gate of gates) {
    for (const field of ["title", "entry", "build", "pass", "attack", "evidence", "vv"]) {
      assert.equal(typeof gate[field], "string", `${gate.id}:${field} must be text`);
      assert.ok(gate[field].trim().length > 0, `${gate.id}:${field} must not be empty`);
    }
    assert.ok(!Object.hasOwn(gate, "status"), `${gate.id} is a gate definition, not a gate result`);
  }

  assert.equal(
    gitAtRoot(["cat-file", "-t", CORE_BASELINE]),
    "commit",
    "approved Core baseline object must resolve",
  );
  const baselineCorePackage = packageMetadata(root, CORE_BASELINE);
  assert.equal(baselineCorePackage.packageManager, `pnpm@${APPROVED_TOOLS.pnpm}`);
  assert.equal(
    git(clientRepo, ["cat-file", "-t", CLIENT_BASELINE]),
    "commit",
    "approved BookcaseDiscovery baseline object must resolve in --client-repo",
  );
  const client = packageMetadata(clientRepo, CLIENT_BASELINE);
  assert.deepEqual(
    {
      name: client.name,
      version: client.version,
      license: client.license,
      packageManager: client.packageManager,
    },
    {
      name: "bookcase-discovery",
      version: "0.0.0",
      license: "AGPL-3.0-only",
      packageManager: "pnpm@12.15.0",
    },
    "BookcaseDiscovery metadata at the pinned commit must match the reviewed source",
  );

  const candidateCorePackage = readJson(read(root, "package.json"), "candidate package.json");
  assert.equal(candidateCorePackage.packageManager, `pnpm@${APPROVED_TOOLS.pnpm}`);
  const lockfile = read(root, LOCK_PATH);
  assert.match(
    lockfile,
    /^lockfileVersion: '9\.0'$/m,
    "Core must keep the reviewed pnpm lockfile format",
  );
  assert.match(
    lockfile,
    /^      typescript:\n        specifier: \^5\.5\.0\n        version: 5\.9\.3$/m,
    "Core lockfile must pin the approved TypeScript importer",
  );
  assert.match(
    lockfile,
    /^      vitest:\n        specifier: \^2\.0\.0\n        version: 2\.1\.9\(/m,
    "Core lockfile must pin the approved Vitest importer",
  );
  const fleet = readJson(
    read(root, "packages/fleet-runner/package.json"),
    "packages/fleet-runner/package.json",
  );
  assert.equal(fleet.name, "@core/fleet-runner");
  assert.equal(fleet.version, "0.1.0");
  assert.equal(fleet.license, "AGPL-3.0-only");

  const baselineSchema = schemaVersion(
    show(root, CORE_BASELINE, CORE_SCHEMA_PATH),
    "approved Core baseline",
  );
  const candidateSchema = schemaVersion(read(root, CORE_SCHEMA_PATH), "candidate Core");
  assert.equal(baselineSchema, 2, "the approved pilot baseline uses SQLite schema 2");
  assert.equal(
    candidateSchema,
    4,
    "the reviewed candidate must include durable nonce and G5 status/control migrations",
  );

  const actualTools = {
    node: process.versions.node,
    pnpm: execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" }).trim(),
    typescript: toolVersion(
      root,
      ["exec", "tsc", "--version"],
      /^Version\s+([0-9.]+)$/m,
      "TypeScript",
    ),
    vitest: toolVersion(root, ["exec", "vitest", "--version"], /\bvitest\/([0-9.]+)/, "Vitest"),
  };
  assert.deepEqual(
    actualTools,
    APPROVED_TOOLS,
    "actual qualification tools must match the reviewed pins",
  );

  const digest = (text) => createHash("sha256").update(text).digest("hex");
  return {
    format: "fleet-runner-g0-contract-evidence/2",
    scope: "G0 source and contract consistency only; this is not a G1+ execution verdict",
    sourceCommit: candidateCommit,
    sourceTree: candidateTree,
    checkedFilesMatchHead: CHECKED_PATHS,
    actualTools,
    coreBaseline: {
      commit: CORE_BASELINE,
      packageManager: baselineCorePackage.packageManager,
      sqliteSchema: baselineSchema,
    },
    clientBaseline: {
      commit: CLIENT_BASELINE,
      repository: clientRepo,
      metadata: {
        name: client.name,
        version: client.version,
        license: client.license,
        packageManager: client.packageManager,
      },
    },
    candidate: {
      fleetPackage: fleet.name,
      fleetVersion: fleet.version,
      sqliteSchema: candidateSchema,
    },
    requiredCaseMappingsChecked: expectedCaseMapping.length,
    gateDefinitionsChecked: gates.length,
    laterGateExecutionChecked: false,
    normativeFileSha256: [
      { path: INVENTORY_PATH, sha256: digest(inventoryText) },
      { path: GATES_PATH, sha256: digest(gatesText) },
      { path: CONTRACT_PATH, sha256: digest(contract) },
    ],
  };
}

try {
  const clientRepo = parseClientRepo(process.argv.slice(2));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const result = verifyContract({ root, clientRepo });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
