#!/usr/bin/env node
/** Local read projection; returned scheduler metadata can include private thread identifiers. */
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { loadLoopsRegistry } from './lib/northstar-fm.mjs';
import { inspectCodexAutomation } from './lib/codex-automation.mjs';

const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const flag of ['--home', '--id']) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && (!process.argv[index + 1] || process.argv[index + 1].startsWith('--'))) {
    process.stderr.write(`${flag} requires a value\n`);
    process.exit(1);
  }
}
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
