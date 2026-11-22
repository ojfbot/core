// The local hook itself: .githooks/commit-msg is run the way git runs it (the path of the message
// file as its one argument) and must accept and refuse the same messages as CI and `pnpm verify`.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function hook(message) {
  const dir = mkdtempSync(join(tmpdir(), 'hook-'));
  try {
    const file = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(file, message);
    const r = spawnSync('sh', [join(root, '.githooks', 'commit-msg'), file], { cwd: root, encoding: 'utf8' });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('.githooks/commit-msg', () => {
  it.each([
    'feat(fleet-runner): add a thing\n',
    'fix: repair\n\nCo-Authored-By: Someone <someone@example.com>\n',
    "Merge branch 'main' into feature/add-thing\n\n# Conflicts:\n#\tpackage.json\n",
    'Merge pull request #7 from ojfbot/some-branch\n',
    // GitHub's merge button, with the PR title as the body (a real commit of this repository, 60653a7)
    'Merge pull request #70 from ojfbot/feat/agent-bead-bridge\n\nfeat: AgentBead bridge — session initializer + Gas Town A2/A3 CLI commands\n',
  ])('lets %j through', (message) => {
    expect(hook(message).status).toBe(0);
  });

  it.each([
    'wip: add a thing\n',
    'feat add a thing\n',
    'feat(Bad Scope): add a thing\n',
    `feat: ${'x'.repeat(120)}\n`,
    'fixup! feat: add a thing\n',
    'squash! feat: add a thing\n',
    '1.2.3\n',
    "Merge branch 'main'\n",
    'Merge abc1234 into def5678\n',
    'Revert "feat: add a thing"\n',
    'Revert whatever I like\n',
    'fixup! anything\n',
    'Merged PR 5: whatever\n',
    'Automatic merge stuff\n',
    'feat add thing no colon\n\nMerge branch foo\n',
    'Merge pull request #7 from o/b\n\nfeat: title\n\nand a second paragraph\n',
  ])('refuses %j', (message) => {
    const r = hook(message);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/✖/);
  });
});
