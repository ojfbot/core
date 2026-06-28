#!/usr/bin/env node
// core/scripts/launcher/tests/registrations.test.mjs
//
// Validate every registration in core/scripts/launcher/registrations/ against
// schema/registration.schema.json. No vitest yet; node-only so this slice
// can run before the launcher gets wired into core's existing test config.
//
// ADR-0058 §3 cross-check: every registration's `id` must be a known rig
// identifier — either a key in BEAD_PREFIX_MAP, an ADR-0052 reservation,
// or a known full rig name from the ecosystem (kebab-case rig directory).
// Every `bead_prefix` must be a value in BEAD_PREFIX_MAP or an ADR-0052
// reservation. This catches typos like `id: "cv-builderr"` or `bead_prefix:
// "stx"` that the JSON Schema alone would let through.
//
// `_examples/` is skipped: those are template/placeholder files, not real
// registrations. The launcher itself ignores that directory at startup.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const launcherRoot = resolve(here, '..');
const repoRoot = resolve(launcherRoot, '..', '..');
const schemaPath = join(launcherRoot, 'schema', 'registration.schema.json');
const registrationsDir = join(launcherRoot, 'registrations');
const beadTypesPath = join(repoRoot, 'packages', 'workflows', 'src', 'types', 'bead.ts');

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

// Inline parser over bead.ts source — avoids coupling the launcher tests to a
// `pnpm build` of @core/workflows. The file is plain TS with a literal
// `Record<string, string>` and no imports, so a small regex pass is safe and
// keeps `pnpm --filter @core/launcher-tests test` runnable from a clean clone.
function loadBeadPrefixMap(file) {
  const src = readFileSync(file, 'utf8');
  const blockMatch = src.match(
    /export\s+const\s+BEAD_PREFIX_MAP\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\}\s*as\s+const\s*;/,
  );
  if (!blockMatch) {
    throw new Error(`Could not locate BEAD_PREFIX_MAP literal in ${file}`);
  }
  const map = {};
  const entryRe = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = entryRe.exec(blockMatch[1])) !== null) {
    map[m[1]] = m[2];
  }
  if (Object.keys(map).length === 0) {
    throw new Error(`BEAD_PREFIX_MAP parsed empty from ${file}`);
  }
  return map;
}

// ADR-0052 reservations on top of BEAD_PREFIX_MAP. Tightly scoped to the
// ADR's "Decision" table; updates require an ADR amendment.
const ADR_0052_RESERVED_PREFIXES = ['fnd', 'bvr', 'lib'];

// Known full rig names from the ecosystem (CLAUDE.md table). A registration
// `id` may be either a BEAD_PREFIX_MAP key, an ADR-0052 reservation, or a
// canonical rig directory name. The `bead_prefix` field is the bridge when
// the rig name and its bead namespace differ (e.g. id `gastown-pilot` →
// bead_prefix `gt`). Adding a new rig means adding it here.
const ECOSYSTEM_RIG_IDS = [
  'shell',
  'cv-builder',
  'blogengine',
  'tripplanner',
  'lean-canvas',
  'purefoy',
  'gastown-pilot',
  'seh-study',
  'core-reader',
  'core',
  'daily-logger',
  'mrplug',
  'frame-ui-components',
  'landing',
  'beavergame',
  'asset-foundry',
  'f1-pit-wall',
  'f1-substrate',
  // Template placeholder used by registrations/_examples/template.json.
  'your-rig',
];

const beadPrefixMap = loadBeadPrefixMap(beadTypesPath);
const validIds = new Set([
  ...Object.keys(beadPrefixMap),
  ...ADR_0052_RESERVED_PREFIXES,
  ...ECOSYSTEM_RIG_IDS,
]);
const validBeadPrefixes = new Set([
  ...Object.values(beadPrefixMap),
  ...ADR_0052_RESERVED_PREFIXES,
]);

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
  if (!ok) {
    fail += 1;
    failures.push(`${f}:\n  ${ajv.errorsText(validate.errors, { separator: '\n  ' })}`);
    continue;
  }

  // Cross-check `id` against BEAD_PREFIX_MAP keys + ADR-0052 reservations
  // + ecosystem rig names.
  if (!validIds.has(data.id)) {
    fail += 1;
    failures.push(
      `${f}: id "${data.id}" is not a key in BEAD_PREFIX_MAP ` +
        `(packages/workflows/src/types/bead.ts), not an ADR-0052 reservation, ` +
        `and not a known ecosystem rig name. ` +
        `If this is a new rig, add it to ECOSYSTEM_RIG_IDS in this test ` +
        `(and to BEAD_PREFIX_MAP / ADR-0052 if it is a new bead namespace).`,
    );
    continue;
  }

  // Cross-check `bead_prefix` (when present) against BEAD_PREFIX_MAP values
  // + ADR-0052 reservations.
  if (data.bead_prefix !== undefined && !validBeadPrefixes.has(data.bead_prefix)) {
    fail += 1;
    failures.push(
      `${f}: bead_prefix "${data.bead_prefix}" is not a value in BEAD_PREFIX_MAP ` +
        `(packages/workflows/src/types/bead.ts) and is not an ADR-0052 reservation. ` +
        `Known: [${[...validBeadPrefixes].sort().join(', ')}].`,
    );
    continue;
  }

  pass += 1;
}

console.log(`registrations: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const msg of failures) console.error(`  - ${msg}`);
  process.exit(1);
}
process.exit(0);
