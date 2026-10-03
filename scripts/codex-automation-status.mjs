#!/usr/bin/env node
/** Public-safe read projection for one declared Codex automation. */
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { loadLoopsRegistry } from './lib/northstar-fm.mjs';
import { inspectCodexAutomation } from './lib/codex-automation.mjs';

const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homeIndex = process.argv.indexOf('--home');
const home = homeIndex < 0 ? os.homedir() : process.argv[homeIndex + 1];
const idIndex = process.argv.indexOf('--id');
const id = idIndex < 0 ? 'selfco-vault-hygiene' : process.argv[idIndex + 1];
const { error, loops } = loadLoopsRegistry(core);
if (error) {
  process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  const loop = loops.find((candidate) => candidate.automation_id === id && candidate.trigger === 'codex-automation');
  if (!loop) {
    process.stderr.write(`codex automation '${id}' not declared\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(JSON.stringify(inspectCodexAutomation(loop, core, home)) + '\n');
  }
}
