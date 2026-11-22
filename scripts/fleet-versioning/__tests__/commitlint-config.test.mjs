import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const config = join(root, 'packages', 'commitlint-config', 'index.mjs');

function lint(message) {
  const r = spawnSync('pnpm', ['exec', 'commitlint', '--config', config], {
    cwd: root,
    input: message,
    encoding: 'utf8',
  });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
}

const accept = [
  'feat: add a thing',
  'fix(fleet-runner): handle empty lease',
  'feat(read-model-contract)!: drop the v1 shape',
  'feat!: drop the v1 shape',
  'chore(main): release fleet-runner 0.2.6',
  'docs(adr): record the decision',
  'revert: undo the thing',
  'feat: x\n\nBREAKING CHANGE: the field is renamed',
  `fix: ${'x'.repeat(50)}\n\n${'long body line '.repeat(30)}`,
  // the only two merge headers allowed: what git merge, "Update branch" and the merge button write
  "Merge branch 'main' into feature/add-thing",
  'Merge pull request #123 from ojfbot/claude/some-branch',
  "Merge branch 'main' into feature/add-thing\n\n# Conflicts:\n#\tfile.txt",
];
const reject = [
  ['fixed the bug', /type may not be empty|subject may not be empty/],
  ['wip: stuff', /type must be one of/],
  ['feat add a thing', /type may not be empty|subject may not be empty/],
  ['feat(scope) add a thing', /type may not be empty|subject may not be empty/],
  ['Feat: x', /type must be lower-case|type must be one of/],
  ['feat(Fleet Runner): x', /scope|type may not be empty/],
  ['feat(Bad_Scope): x', /scope/],
  ['feat(a/B): x', /scope/],
  ['fix(): empty scope', /type may not be empty|subject may not be empty/],
  ['feat: add thing.', /full stop/],
  ['feat:', /subject may not be empty|type may not be empty/],
  [`feat: ${'x'.repeat(120)}`, /header must not be longer/],
  ['feat: x\nbody without blank line', /blank line/],
  // the conventional-commits default ignores are off: none of these slips through
  ['fixup! feat: add a thing', /type may not be empty|subject may not be empty/],
  ['squash! feat: add a thing', /type may not be empty|subject may not be empty/],
  ['amend! feat: add a thing', /type may not be empty|subject may not be empty/],
  ['1.2.3', /type may not be empty|subject may not be empty/],
  ['v1.2.3', /type may not be empty|subject may not be empty/],
  ['Revert "feat: add a thing"', /type may not be empty|subject may not be empty/],
  // the review's examples: none of these may ride on a built-in or loose merge/revert/fixup pattern
  ['Revert whatever I like', /type may not be empty|subject may not be empty/],
  ['fixup! anything', /type may not be empty|subject may not be empty/],
  ['Merged PR 5: whatever', /type may not be empty|subject may not be empty/],
  ['Automatic merge stuff', /type may not be empty|subject may not be empty/],
  ['feat add thing no colon\n\nMerge branch foo', /type may not be empty|subject may not be empty/],
  ["feat add thing no colon\n\nMerge branch 'main' into feature/x", /type may not be empty|subject may not be empty/],
  ["Merge branch 'main'", /type may not be empty|subject may not be empty/],
  ['Merge abc1234 into def5678', /type may not be empty|subject may not be empty/],
  ["Merge remote-tracking branch 'origin/main'", /type may not be empty|subject may not be empty/],
  ["Merge branch 'main' into feature/x\nand a hand-written extra line without a blank line", /type may not be empty|subject may not be empty/],
];

describe('shared commitlint config', () => {
  it.each(accept)('accepts %j', (message) => {
    const r = lint(message);
    expect(r.out).not.toMatch(/✖/);
    expect(r.ok).toBe(true);
  });

  it.each(reject)('rejects %j', (message, why) => {
    const r = lint(message);
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(why);
  });
});
