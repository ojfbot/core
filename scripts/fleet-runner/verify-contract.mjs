#!/usr/bin/env node
// Verify the recorded G0 contract against source objects, not an agent verdict.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const inventoryPath = 'decisions/fleet-runner/release-one-proof-inventory.json';
const gatesPath = 'decisions/fleet-runner/release-one-gates.json';
const contractPath = 'decisions/fleet-runner/release-one-g0-g2.md';
const inventoryText = read(inventoryPath);
const gatesText = read(gatesPath);
const contract = read(contractPath);
const inventory = JSON.parse(inventoryText);
const gates = JSON.parse(gatesText);
assert.equal(inventory.format, 'fleet-runner-release-one-inventory/1');
assert.match(inventory.baselineCore, /^[a-f0-9]{40}$/);
assert.match(inventory.baselineClient, /^[a-f0-9]{40}$/);
assert.equal(gates.length, 9);
assert.deepEqual(gates.map((gate) => gate.id), Array.from({ length: 9 }, (_, i) => 'G' + i));
assert.deepEqual([...new Set(inventory.cases.map((item) => item.gate))].sort(), gates.map((gate) => gate.id));
assert.equal(new Set(inventory.cases.map((item) => item.id)).size, inventory.cases.length);
assert.equal(inventory.cases.length, 20);
for (const item of inventory.cases) {
  assert.equal(typeof item.claim, 'string');
  assert.ok(item.claim.trim().length > 20);
}
for (const gate of gates) {
  for (const field of ['title', 'entry', 'build', 'pass', 'attack', 'evidence', 'vv']) {
    assert.equal(typeof gate[field], 'string', gate.id + ':' + field);
    assert.ok(gate[field].trim().length > 0, gate.id + ':' + field);
  }
}
assert.deepEqual(inventory.requiredG1Mutants, [
  'owner-authorization', 'completion-fence', 'output-digest', 'durable-replay',
]);
assert.ok(contract.includes(inventory.baselineCore));
assert.ok(contract.includes(inventory.baselineClient));
assert.ok(contract.includes('HelpDesk'));
assert.ok(contract.includes('UNTESTED'));
const baselinePackage = JSON.parse(execFileSync('git', [
  'show', inventory.baselineCore + ':package.json',
], { cwd: root, encoding: 'utf8' }));
assert.equal(baselinePackage.packageManager, 'pnpm@' + inventory.qualificationTools.pnpm);
const fleet = JSON.parse(read('packages/fleet-runner/package.json'));
assert.equal(fleet.name, '@core/fleet-runner');
assert.equal(fleet.license, 'AGPL-3.0-only');
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const result = {
  format: 'fleet-runner-g0-contract-evidence/1',
  sourceCommit: git(['rev-parse', 'HEAD']),
  sourceTree: git(['rev-parse', 'HEAD^{tree}']),
  trackedChanges: git(['diff', '--name-only']),
  node: process.versions.node,
  qualificationTools: inventory.qualificationTools,
  gateCount: gates.length,
  caseCount: inventory.cases.length,
  baselineCore: inventory.baselineCore,
  baselineClient: inventory.baselineClient,
  files: [
    { path: inventoryPath, sha256: hash(inventoryText) },
    { path: gatesPath, sha256: hash(gatesText) },
    { path: contractPath, sha256: hash(contract) },
  ],
};
console.log(JSON.stringify(result, null, 2));
