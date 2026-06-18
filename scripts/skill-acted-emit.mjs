#!/usr/bin/env node
// skill-acted-emit.mjs — emit a `skill:acted` event onto the tracking spine.
//
// The runnable, explicit write path for the AGENT-EMITTED half of
// adr:skill-action-instrumentation (§1): a skill action routes AROUND the Skill tool
// (ADR-0092 inline-follow), so it has no Claude Code tool event — the agent emits this
// itself when it finishes a skill's work. Sibling to gate-event.mjs: same eventEmit
// (honesty-enforced, op_id-idempotent) onto the same EventLedger. The spine is
// type-general — this adds a TYPE caller, not a parallel system.
//
// This is the SELF-REPORT source of the two-source contract. It is expected to be
// SPARSELY used (un-emitted actions are the exact gap S1 measures) — so it is NOT what
// makes data accumulate; the independent Stop-hook recorder (reconcile-skill-acted.mjs)
// is. assertHonest REJECTS a missing/unresolvable evidence_ref by design — the error is
// surfaced to the caller, never swallowed.
//
// Usage:
//   node scripts/skill-acted-emit.mjs --suggestion-id=ID --skill=SLUG --evidence=path:/abs/file \
//        [--mode=shadow|active] [--program=opav-loop] [--ledger-root=DIR] [--actor=NAME] \
//        [--expected-artifact=TEXT]
//
// Examples:
//   node scripts/skill-acted-emit.mjs --suggestion-id=9D8D... --skill=adr --evidence=path:decisions/adr/0097-x.md
//   node scripts/skill-acted-emit.mjs --suggestion-id=ABC --skill=grill-with-docs --evidence=path:CONTEXT.md
//
// evidence is MANDATORY (skill:acted is evidence-mandatory by construction): scheme:ref
// where scheme ∈ path|pr|tpm|test. A `path` ref must exist on disk or the emit is rejected.

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const expand = (p) => (p && p.startsWith('~') ? p.replace('~', homedir()) : p);

const flags = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] ?? true;
}

const suggestionId = flags['suggestion-id'];
const skill = flags.skill;
if (!suggestionId || !skill || !flags.evidence) {
  console.error('usage: skill-acted-emit.mjs --suggestion-id=ID --skill=SLUG --evidence=scheme:ref [--mode=shadow] [--program=opav-loop] [--ledger-root=DIR] [--actor=NAME] [--expected-artifact=TEXT]');
  process.exit(2);
}

const idx = String(flags.evidence).indexOf(':');
if (idx === -1) {
  console.error(`--evidence must be scheme:ref (path|pr|tpm|test), got "${flags.evidence}"`);
  process.exit(2);
}
const evidence = { scheme: String(flags.evidence).slice(0, idx), ref: String(flags.evidence).slice(idx + 1) };

let buildSkillActed, eventEmit, EventLedger, expectedArtifactFor;
try {
  const dist = pathToFileURL(resolve(HERE, '../packages/workflows/dist/tracking')).href;
  ({ buildSkillActed } = await import(`${dist}/skill-acted.js`));
  ({ eventEmit } = await import(`${dist}/emit.js`));
  ({ EventLedger } = await import(`${dist}/ledger.js`));
  ({ expectedArtifactFor } = await import(`${dist}/expected-artifact.js`));
} catch {
  console.error('[skill-acted-emit] workflows build not found — run `pnpm --filter @core/workflows build` first.');
  process.exit(1);
}

const program = flags.program ? String(flags.program) : 'opav-loop';
const ledgerRoot = expand(flags['ledger-root'] ?? '~/selfco/tracking');
const mode = flags.mode ? String(flags.mode) : 'shadow';
// expected_artifact is part of the honesty target; default to the per-skill map's text.
const spec = expectedArtifactFor(skill);
const expectedArtifact = flags['expected-artifact']
  ? String(flags['expected-artifact'])
  : (spec?.description ?? `artifact for ${skill}`);

const event = buildSkillActed({
  suggestionId,
  skill,
  mode,
  expectedArtifact,
  evidence,
  ...(flags.actor ? { actor: String(flags.actor) } : {}),
});

try {
  const ledger = new EventLedger(program, ledgerRoot);
  await eventEmit(ledger, event);
  console.error(`[skill-acted-emit] emitted skill:acted '${skill}' → ${event.correlation_id} (${mode}, ledger=${ledgerRoot}/${program}.jsonl)`);
} catch (err) {
  // assertHonest throws HonestyContractError for a missing/unresolvable evidence_ref.
  console.error(`[skill-acted-emit] REJECTED — ${err.message}`);
  process.exit(1);
}
