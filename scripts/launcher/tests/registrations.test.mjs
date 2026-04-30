#!/usr/bin/env node
// core/scripts/launcher/tests/registrations.test.mjs
//
// Validate every registration in core/scripts/launcher/registrations/ against
// schema/registration.schema.json. No vitest yet; node-only so this slice
// can run before the launcher gets wired into core's existing test config.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const launcherRoot = resolve(here, '..');
const schemaPath = join(launcherRoot, 'schema', 'registration.schema.json');
const registrationsDir = join(launcherRoot, 'registrations');

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

let pass = 0;
let fail = 0;
const failures = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (entry.endsWith('.json')) {
      yield full;
    }
  }
}

for (const f of walk(registrationsDir)) {
  let data;
  try {
    data = JSON.parse(readFileSync(f, 'utf8'));
  } catch (err) {
    fail += 1;
    failures.push(`${f}: invalid JSON: ${err.message}`);
    continue;
  }
  const ok = validate(data);
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`${f}:\n  ${ajv.errorsText(validate.errors, { separator: '\n  ' })}`);
  }
}

console.log(`registrations: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const msg of failures) console.error(`  - ${msg}`);
  process.exit(1);
}
process.exit(0);
