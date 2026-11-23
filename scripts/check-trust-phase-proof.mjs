#!/usr/bin/env node
// check-trust-phase-proof.mjs — the phase-end check every trust build layer retro runs
// (RETRO-0 to RETRO-5; ojfbot/core#687). It passes only when every other slice of the phase is
// closed and left its proof; see scripts/lib/trust-phase-proof.mjs for exactly what counts.
//
// Usage: node scripts/check-trust-phase-proof.mjs --phase PH8 [--roadmap PATH]
//
// Reads GitHub through the `gh` CLI (signed in, read-only calls). Exit 0 = every slice has its
// proof; 1 = at least one problem (each is printed); 2 = usage error. Any failure to read GitHub
// or the roadmap is a failure, never a pass.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { LAYER_LABELS, SLICE_REPOS, evaluatePhase, issueKey, phaseSlices } from './lib/trust-phase-proof.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROADMAP = path.resolve(HERE, '..', 'decisions/northstar/roadmap-l2-ojfbot.md');

const ISSUE_QUERY = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){
  number state stateReason body
  closedByPullRequestsReferences(first:50, includeClosedPrs:true){nodes{number merged repository{nameWithOwner}}}
}}}`;

function usage(msg) {
  if (msg) console.error(`check-trust-phase-proof: ${msg}`);
  console.error(`usage: node scripts/check-trust-phase-proof.mjs --phase <${Object.keys(LAYER_LABELS).join('|')}> [--roadmap PATH]`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { roadmap: DEFAULT_ROADMAP };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--phase') out.phase = argv[++i];
    else if (a === '--roadmap') out.roadmap = path.resolve(argv[++i] ?? '');
    else if (a === '-h' || a === '--help') usage();
    else usage(`unknown argument ${a}`);
  }
  if (!out.phase) usage('--phase is required');
  if (!LAYER_LABELS[out.phase]) usage(`unknown phase ${out.phase}`);
  return out;
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function loadRoadmap(file) {
  const text = readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) throw new Error(`${file}: no YAML frontmatter`);
  return YAML.parse(m[1]);
}

function fetchLabelled(layer) {
  const out = [];
  for (const repo of SLICE_REPOS) {
    const rows = JSON.parse(gh(['issue', 'list', '-R', repo, '--label', layer, '--label', 'trust-slice', '--state', 'all', '--limit', '1000', '--json', 'number,state,labels']));
    if (rows.length >= 1000) throw new Error(`${repo}: 1000 or more ${layer} issues; the list may be cut short`);
    for (const r of rows) out.push({ repo, number: r.number, state: r.state, labels: (r.labels ?? []).map((l) => l.name) });
  }
  return out;
}

function fetchIssue(repo, number) {
  const [owner, name] = repo.split('/');
  const res = JSON.parse(gh(['api', 'graphql', '-f', `query=${ISSUE_QUERY}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`]));
  if (res.errors?.length) throw new Error(`${repo}#${number}: ${res.errors.map((e) => e.message).join('; ')}`);
  return res.data?.repository?.issue ?? null;
}

function main() {
  const { phase, roadmap: roadmapFile } = parseArgs(process.argv.slice(2));
  const layer = LAYER_LABELS[phase];
  let result;
  try {
    const roadmap = loadRoadmap(roadmapFile);
    const { slices } = phaseSlices(roadmap, phase);
    const issues = new Map();
    for (const s of slices) issues.set(issueKey(s.repo, s.number), fetchIssue(s.repo, s.number));
    result = evaluatePhase({ phase, roadmap, issues, labelled: fetchLabelled(layer) });
  } catch (err) {
    console.error(`check-trust-phase-proof: FAIL — could not read the records: ${err.message.split('\n')[0]}`);
    process.exit(1);
  }

  for (const { slice, problems } of result.results) {
    const tag = problems.length ? 'MISSING' : 'ok     ';
    console.log(`${tag} ${slice.rm} ${slice.name} ${slice.repo}#${slice.number} (${slice.kind === 'pr' ? 'merged closing PR' : 'owner step'})`);
  }
  if (result.ok) {
    console.log(`check-trust-phase-proof: PASS — ${phase} (${layer}): all ${result.results.length} slices closed with their proof.`);
    console.log('The retro still reads by hand: each owner step, and how each slice handled its review findings.');
    process.exit(0);
  }
  console.error(`check-trust-phase-proof: FAIL — ${phase} (${layer}): ${result.problems.length} problem(s):`);
  for (const p of result.problems) console.error(`  - ${p}`);
  console.error('When closing a slice: merge its PR with a closing keyword, close owner steps as completed, and replace');
  console.error('the "_(none yet)_" line under "Deviations and discoveries" with the slice\'s entries or a plain "None." line.');
  process.exit(1);
}

main();
