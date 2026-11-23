import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLACEHOLDER,
  deviationsVerdict,
  evaluatePhase,
  issueKey,
  parseDeliverable,
  phaseSlices,
  sliceProblems,
} from '../trust-phase-proof.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, '../../check-trust-phase-proof.mjs');

// The tail of a slice issue body exactly as the trust build issues were filed.
const TEMPLATE = [
  '### Deviations and discoveries',
  '',
  'Builders append to this section, and to the repo\'s `implementation-notes.md` under `## Deviations`, whenever reality differs from the plan.',
  '',
  '- A discovery that **changes a ruled decision** goes to the owner **through the conductor**. Stop only the affected part.',
  '- A discovery that **only changes this slice** gets a re-plan of this slice, not of the whole map.',
  '- A discovery that moves **another slice\'s** entrance condition or check: comment on that slice and on the discoveries issue.',
  '',
].join('\n');
const head = '## Slice record\n\n| Field | Value |\n\n### Known risks\n\n- something risky\n\n';
const bodyPlaceholder = `${head}${TEMPLATE}- ${PLACEHOLDER}\n`;
const bodyNone = `${head}${TEMPLATE}- None.\n`;
const bodyEntry = `${head}${TEMPLATE}- 2026-12-01: the plan assumed X; found Y; went with Y.\n`;
const bodyEmptied = `${head}${TEMPLATE}`;

const roadmap = {
  slices: [
    { id: 'S1', phase: 'PH8', title: 'P0-PROBE — Write the probe', deliverable: 'A reviewed PR closing ojfbot/LocalHelp#126 (trust build slice P0-PROBE).' },
    { id: 'S2', phase: 'PH8', title: 'OW-0 — (owner-only) Owner: take admin away', deliverable: 'Owner step recorded on ojfbot/LocalHelp#127 (trust build slice OW-0).' },
    { id: 'S3', phase: 'PH8', title: 'CH-1 — A core slice', deliverable: 'A reviewed PR closing ojfbot/core#690 (trust build slice CH-1).' },
    { id: 'S4', phase: 'PH8', title: 'RETRO-0 — Layer retro', deliverable: 'A reviewed PR closing ojfbot/core#694 (trust build slice RETRO-0).' },
    { id: 'S5', phase: 'PH9', title: 'HD-1a — Next phase', deliverable: 'A reviewed PR closing ojfbot/LocalHelp#142 (trust build slice HD-1a).' },
  ],
};

const mergedPr = (repo, number = 900) => ({ __typename: 'PullRequest', number, merged: true, repository: { nameWithOwner: repo } });
// closers: the closer of each close event, oldest first (null = closed by hand).
const closedIssue = (body, closers = [null]) => ({
  state: 'CLOSED',
  stateReason: 'COMPLETED',
  body,
  timelineItems: { nodes: closers.map((closer) => ({ closer })) },
});

function goodRecords() {
  const issues = new Map([
    [issueKey('ojfbot/LocalHelp', 126), closedIssue(bodyEntry, [mergedPr('ojfbot/LocalHelp')])],
    [issueKey('ojfbot/LocalHelp', 127), closedIssue(bodyNone)],
    [issueKey('ojfbot/core', 690), closedIssue(bodyNone, [mergedPr('ojfbot/core')])],
  ]);
  const labelled = [
    { repo: 'ojfbot/LocalHelp', number: 126, state: 'CLOSED', labels: ['trust-slice', 'layer:0-phase0'] },
    { repo: 'ojfbot/LocalHelp', number: 127, state: 'CLOSED', labels: ['trust-slice', 'layer:0-phase0', 'owner-only'] },
    { repo: 'ojfbot/core', number: 690, state: 'CLOSED', labels: ['trust-slice', 'layer:0-phase0'] },
    { repo: 'ojfbot/core', number: 694, state: 'OPEN', labels: ['trust-slice', 'layer:0-phase0', 'trust-retro'] },
  ];
  return { issues, labelled };
}

describe('parseDeliverable', () => {
  it('reads both deliverable forms the roadmap uses', () => {
    expect(parseDeliverable('A reviewed PR closing ojfbot/LocalHelp#142 (trust build slice HD-1a).')).toEqual({ kind: 'pr', repo: 'ojfbot/LocalHelp', number: 142 });
    expect(parseDeliverable('Owner step recorded on ojfbot/LocalHelp#138 (trust build slice OW-1b).')).toEqual({ kind: 'owner', repo: 'ojfbot/LocalHelp', number: 138 });
  });
  it('returns null for anything else, so it can never be skipped silently', () => {
    expect(parseDeliverable('Something shipped.')).toBeNull();
    expect(parseDeliverable(undefined)).toBeNull();
  });
});

describe('phaseSlices', () => {
  it('takes the phase minus its retro', () => {
    const { slices, retros, unparsed } = phaseSlices(roadmap, 'PH8');
    expect(slices.map((s) => s.name)).toEqual(['P0-PROBE', 'OW-0', 'CH-1']);
    expect(retros.map((s) => s.id)).toEqual(['S4']);
    expect(unparsed).toEqual([]);
  });
});

describe('deviationsVerdict', () => {
  it('fails while the filed placeholder is still there', () => {
    const v = deviationsVerdict(bodyPlaceholder);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/placeholder/);
    expect(v.reason).toMatch(/None\./);
  });
  it('passes on a plain "None." line or on a real entry', () => {
    expect(deviationsVerdict(bodyNone).ok).toBe(true);
    expect(deviationsVerdict(`${head}${TEMPLATE}None\n`).ok).toBe(true);
    expect(deviationsVerdict(bodyEntry).ok).toBe(true);
  });
  it('fails when the placeholder was deleted and nothing written (template bullets are not entries)', () => {
    expect(deviationsVerdict(bodyEmptied).ok).toBe(false);
  });
  it('fails when the section is missing', () => {
    expect(deviationsVerdict(head).ok).toBe(false);
  });
  it('reads only its own section, not a later one', () => {
    expect(deviationsVerdict(`${head}${TEMPLATE}- ${PLACEHOLDER}\n\n### Later notes\n\n- None.\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}\n### Later notes\n\n- an unrelated bullet\n`).ok).toBe(false);
  });
  it('keeps nested headings inside the section', () => {
    expect(deviationsVerdict(`${head}${TEMPLATE}- None.\n\n#### Details\n\n- ${PLACEHOLDER}\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}#### Discovery\n\n- 2026-12-01: found Y; went Y.\n`).ok).toBe(true);
  });
  it('ignores headings and text inside code fences and comments', () => {
    const fencedExample = '```markdown\n### Deviations and discoveries\nNone.\n```\n\n';
    expect(deviationsVerdict(`${head}${fencedExample}${TEMPLATE}- ${PLACEHOLDER}\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}- 2026-12-01: ran this:\n\n\`\`\`bash\n# a shell comment\n\`\`\`\n\n- ${PLACEHOLDER}\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}\`\`\`\n- looks like an entry\nNone.\n\`\`\`\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}<!--\n- hidden entry\n-->\n`).ok).toBe(false);
  });
  it('a "None." inside an inline HTML comment does not count (was a false pass)', () => {
    expect(deviationsVerdict(`${head}${TEMPLATE}Template note <!--\nNone.\n-->\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}<!-- None. -->\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}- <!-- hidden --> \n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}<!-- a note --> None.\n`).ok).toBe(true);
  });
  it('a "None." or entry in an indented code block does not count (was a false pass)', () => {
    expect(deviationsVerdict(`${head}${TEMPLATE}    None.\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}\t- an entry\n`).ok).toBe(false);
  });
  it('a one-line ```span``` is inline code, not an unclosed fence (was a false fail)', () => {
    expect(deviationsVerdict(`\`\`\`example\`\`\`\n\n${head}${TEMPLATE}- None.\n`).ok).toBe(true);
    expect(deviationsVerdict(`${head}${TEMPLATE}\`\`\`inline\`\`\` - 2026-12-01: an entry\n- None.\n`).ok).toBe(true);
    // a real fence still hides what is inside it
    expect(deviationsVerdict(`${head}${TEMPLATE}\`\`\`js\nNone.\n\`\`\`\n`).ok).toBe(false);
    expect(deviationsVerdict(`${head}${TEMPLATE}~~~\nNone.\n~~~\n`).ok).toBe(false);
  });
  it('fails on two real sections', () => {
    expect(deviationsVerdict(`${head}${TEMPLATE}- None.\n\n${TEMPLATE}- None.\n`).reason).toMatch(/2 "Deviations/);
  });
  it('catches the placeholder in other spellings', () => {
    for (const p of ['_(None yet)_', '*(none yet)*', '(none yet)', '__( none yet )__']) {
      expect(deviationsVerdict(`${head}${TEMPLATE}- 2026-12-01: an entry\n- ${p}\n`).ok).toBe(false);
    }
  });
  it('accepts numbered entries', () => {
    expect(deviationsVerdict(`${head}${TEMPLATE}1. 2026-12-01: found Y; went Y.\n`).ok).toBe(true);
  });
  it('handles CRLF bodies', () => {
    expect(deviationsVerdict(bodyPlaceholder.replace(/\n/g, '\r\n')).ok).toBe(false);
    expect(deviationsVerdict(bodyNone.replace(/\n/g, '\r\n')).ok).toBe(true);
  });
});

describe('sliceProblems', () => {
  const prSlice = { kind: 'pr', repo: 'ojfbot/LocalHelp', number: 126 };
  const ownerSlice = { kind: 'owner', repo: 'ojfbot/LocalHelp', number: 127 };
  it('a PR slice needs its last close to come from a merged PR in its own repo', () => {
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [mergedPr('ojfbot/LocalHelp')]))).toEqual([]);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [mergedPr('ojfbot/localhelp')]))).toEqual([]);
    expect(sliceProblems(prSlice, closedIssue(bodyNone))[0]).toMatch(/no merged pull request in ojfbot\/LocalHelp ever closed it/);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [{ ...mergedPr('ojfbot/LocalHelp'), merged: false }]))).toHaveLength(1);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [mergedPr('ojfbot/core')]))).toHaveLength(1);
  });
  it('a hand close with no PR close in its history is not proof', () => {
    // A merged PR that is only linked (e.g. merged into a stacked branch) never appears as a
    // closer, so the history is hand closes only.
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [null]))).toHaveLength(1);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [null, null]))).toHaveLength(1);
  });
  it('a reopen and hand close after a real PR close keeps the PR proof (was a false fail)', () => {
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [mergedPr('ojfbot/LocalHelp'), null]))).toEqual([]);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [null, mergedPr('ojfbot/LocalHelp'), null]))).toEqual([]);
  });
  it('a close by a commit counts only when the commit belongs to a merged PR in the repo', () => {
    const commit = (prs) => ({ __typename: 'Commit', oid: 'abc', associatedPullRequests: { nodes: prs } });
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [commit([mergedPr('ojfbot/LocalHelp')])]))).toEqual([]);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [commit([])]))).toHaveLength(1);
    expect(sliceProblems(prSlice, closedIssue(bodyNone, [commit([{ ...mergedPr('ojfbot/LocalHelp'), merged: false }])]))).toHaveLength(1);
  });
  it('any close reason but completed fails', () => {
    for (const reason of ['NOT_PLANNED', 'DUPLICATE', 'REOPENED', null]) {
      const p = sliceProblems(prSlice, { ...closedIssue(bodyNone, [mergedPr('ojfbot/LocalHelp')]), stateReason: reason });
      expect(p.join()).toMatch(/not completed/);
    }
  });
  it('an owner step needs "closed as completed"; "not planned" fails', () => {
    expect(sliceProblems(ownerSlice, closedIssue(bodyNone))).toEqual([]);
    expect(sliceProblems(ownerSlice, { ...closedIssue(bodyNone), stateReason: 'NOT_PLANNED' })).toEqual(['closed as not planned, not completed']);
    expect(sliceProblems(ownerSlice, { ...closedIssue(bodyNone), state: 'OPEN', stateReason: null })).toEqual(['still open']);
  });
  it('an unreadable issue fails', () => {
    expect(sliceProblems(prSlice, null)).toHaveLength(1);
  });
});

describe('evaluatePhase', () => {
  it('passes when every slice is closed with its proof', () => {
    const r = evaluatePhase({ phase: 'PH8', roadmap, ...goodRecords() });
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it('fails when one closed slice lacks its proof', () => {
    const { issues, labelled } = goodRecords();
    issues.set(issueKey('ojfbot/core', 690), closedIssue(bodyPlaceholder));
    const r = evaluatePhase({ phase: 'PH8', roadmap, issues, labelled });
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/CH-1 .*no merged pull request in ojfbot\/core ever closed it/);
    expect(r.problems.join('\n')).toMatch(/CH-1 .*placeholder/);
  });
  it('fails on a phase with no slices (no false green)', () => {
    const r = evaluatePhase({ phase: 'PH8', roadmap: { slices: [] }, issues: new Map(), labelled: [] });
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/no slices/);
    expect(r.problems.join('\n')).toMatch(/zero matches/);
  });
  it('fails when the label lookup finds nothing even though the roadmap has slices', () => {
    const { issues } = goodRecords();
    const r = evaluatePhase({ phase: 'PH8', roadmap, issues, labelled: [] });
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/zero matches/);
  });
  it('fails when labels and roadmap disagree in either direction', () => {
    const { issues, labelled } = goodRecords();
    const extra = [...labelled.filter((i) => i.number !== 127), { repo: 'ojfbot/daily-logger', number: 5, state: 'CLOSED', labels: ['trust-slice', 'layer:0-phase0'] }];
    const r = evaluatePhase({ phase: 'PH8', roadmap, issues, labelled: extra });
    expect(r.problems.join('\n')).toMatch(/OW-0: ojfbot\/LocalHelp#127 is not labelled/);
    expect(r.problems.join('\n')).toMatch(/daily-logger#5 is labelled layer:0-phase0 but is not a PH8 slice/);
  });
  it('fails on a deliverable it cannot read, and on an unknown phase', () => {
    const odd = { slices: [...roadmap.slices, { id: 'S9', phase: 'PH8', title: 'X-1 — odd', deliverable: 'Something shipped.' }] };
    expect(evaluatePhase({ phase: 'PH8', roadmap: odd, ...goodRecords() }).problems.join('\n')).toMatch(/S9 X-1: deliverable names no proof/);
    expect(evaluatePhase({ phase: 'PH99', roadmap, ...goodRecords() }).ok).toBe(false);
    expect(evaluatePhase({ phase: '__proto__', roadmap, ...goodRecords() }).ok).toBe(false);
  });
});

// End to end: the real CLI against a stand-in `gh` that serves canned records.
describe('check-trust-phase-proof CLI', () => {
  let dir;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'trust-phase-proof-'));
    const fm = ['---', 'type: roadmap', 'slug: test', 'slices:'];
    for (const s of roadmap.slices) {
      fm.push(`  - id: ${s.id}`, `    phase: ${s.phase}`, `    title: ${JSON.stringify(s.title)}`, `    deliverable: ${JSON.stringify(s.deliverable)}`);
    }
    writeFileSync(path.join(dir, 'roadmap.md'), `${fm.join('\n')}\n---\n\n# body\n`);
    writeFileSync(path.join(dir, 'gh'), `#!/usr/bin/env node
const data = JSON.parse(require('fs').readFileSync(process.env.FAKE_GH_DATA, 'utf8'));
const a = process.argv.slice(2);
const val = (flag) => { const i = a.indexOf(flag); return i < 0 ? undefined : a[i + 1]; };
const field = (k) => (a.find((x) => x.startsWith(k + '=')) || '').slice(k.length + 1);
if (a[0] === 'issue' && a[1] === 'list') {
  const repo = val('-R');
  const rows = (data.labelled || []).filter((i) => i.repo === repo).map((i) => ({ number: i.number, state: i.state, labels: i.labels.map((name) => ({ name })) }));
  process.stdout.write(JSON.stringify(rows));
} else if (a[0] === 'api' && a[1] === 'graphql') {
  const key = (field('owner') + '/' + field('name')).toLowerCase() + '#' + field('number');
  process.stdout.write(JSON.stringify({ data: { repository: { issue: (data.issues || {})[key] || null } } }));
} else { process.stderr.write('fake gh: unexpected ' + a.join(' ')); process.exit(1); }
`);
    chmodSync(path.join(dir, 'gh'), 0o755);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function run(records) {
    const dataFile = path.join(dir, `data-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(dataFile, JSON.stringify({ labelled: records.labelled, issues: Object.fromEntries(records.issues) }));
    return spawnSync(process.execPath, [CLI, '--phase', 'PH8', '--roadmap', path.join(dir, 'roadmap.md')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, FAKE_GH_DATA: dataFile },
    });
  }

  it('exits 0 when every slice has its proof', () => {
    const r = run(goodRecords());
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/PASS — PH8/);
  });
  it('exits 1 when a closed slice lacks its proof', () => {
    const rec = goodRecords();
    rec.issues.set(issueKey('ojfbot/LocalHelp', 127), closedIssue(bodyPlaceholder));
    const r = run(rec);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/S2 OW-0 .*placeholder/);
  });
  it('exits 1 when a slice\'s only "None." is hidden in an HTML comment', () => {
    const rec = goodRecords();
    rec.issues.set(issueKey('ojfbot/LocalHelp', 127), closedIssue(`${head}${TEMPLATE}Template note <!--\nNone.\n-->\n`));
    const r = run(rec);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/S2 OW-0 .*no entries/);
  });
  it('exits 1 when GitHub cannot be read', () => {
    const r = spawnSync(process.execPath, [CLI, '--phase', 'PH8', '--roadmap', path.join(dir, 'roadmap.md')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, FAKE_GH_DATA: path.join(dir, 'missing.json') },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/could not read the records/);
  });
  it('exits 2 on a usage error', () => {
    expect(spawnSync(process.execPath, [CLI], { encoding: 'utf8' }).status).toBe(2);
    expect(spawnSync(process.execPath, [CLI, '--phase', 'PH99'], { encoding: 'utf8' }).status).toBe(2);
    expect(spawnSync(process.execPath, [CLI, '--phase', 'constructor'], { encoding: 'utf8' }).status).toBe(2);
    expect(spawnSync(process.execPath, [CLI, '--phase', 'PH8', '--roadmap'], { encoding: 'utf8' }).status).toBe(2);
  });
});
