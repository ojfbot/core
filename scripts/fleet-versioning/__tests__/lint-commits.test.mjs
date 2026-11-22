import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const script = join(root, 'scripts', 'fleet-versioning', 'lint-commits.mjs');
let dir;
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const commit = (message) => {
  writeFileSync(join(dir, `f${Math.random()}.txt`), message);
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message, '--no-gpg-sign');
  return git('rev-parse', 'HEAD');
};
const lint = (base, head, extra = {}) => {
  const r = spawnSync('node', [script], {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, COMMITLINT_RUNNER: 'exec', BASE_SHA: base, HEAD_SHA: head, ...extra },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

let base;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'lint-commits-'));
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'package.json'), '{"name":"t","private":true}\n');
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  base = commit('chore: baseline');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const good = ['feat: add a thing', 'fix(fleet-runner): handle empty lease', 'feat(api)!: drop v1', 'docs: describe it'];
const bad = [
  ['wrong type', 'wip: add a thing'],
  ['missing colon', 'feat add a thing'],
  ['bad scope', 'feat(Fleet Runner): add a thing'],
  ['oversized header', `feat: ${'x'.repeat(120)}`],
];

describe('lint-commits (the script CI and pnpm verify both run)', () => {
  it.each(good)('PASSes a branch whose commit is %j', (message) => {
    const head = commit(message);
    const r = lint(base, head);
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/commits [0-9a-f]{7}\.\.[0-9a-f]{7}: PASS/);
  });

  it.each(bad)('FAILs a branch with a %s commit', (_label, message) => {
    const head = commit(message);
    const r = lint(base, head);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/: FAIL/);
  });

  it('FAILs on a bad title and PASSes on a good one, even when every commit is good', () => {
    git('reset', '-q', '--hard', base);
    const head = commit('feat: fine');
    expect(lint(base, head, { PR_TITLE: 'feat: fine title' }).status).toBe(0);
    const badTitle = lint(base, head, { PR_TITLE: 'Fine title with no type' });
    expect(badTitle.status).toBe(1);
    expect(badTitle.out).toMatch(/pull request title .*: FAIL/);
    // verify passes titles base64 so any text is safe
    const b64 = Buffer.from('fix: ok ${{ not an expression }}').toString('base64');
    expect(lint(base, head, { PR_TITLE_B64: b64 }).status).toBe(0);
  });

  it('reports the title SKIPPED with its reason when none is known, and still lints the commits', () => {
    git('reset', '-q', '--hard', base);
    const head = commit('feat: fine');
    const r = lint(base, head, { PR_TITLE_SKIP_REASON: 'gh found no pull request' });
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/pull request title: SKIPPED \(gh found no pull request\)/);
    const badHead = commit('nonsense');
    expect(lint(base, badHead, { PR_TITLE_SKIP_REASON: 'x' }).status).toBe(1);
  });

  it('refuses to run without a range', () => {
    expect(lint('', '').status).toBe(2);
  });
});

describe('merge, fixup and version-number commits are linted too', () => {
  it("passes GitHub's own \"Merge branch 'main' into <branch>\" and a conventional commit around it", () => {
    git('reset', '-q', '--hard', base);
    git('checkout', '-q', '-b', 'topic');
    commit('feat: topic work');
    git('checkout', '-q', 'main');
    const tip = commit('chore: main moved on');
    git('checkout', '-q', 'topic');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'merge', '-q', '--no-ff', 'main', '--no-gpg-sign');
    const head = git('rev-parse', 'HEAD');
    expect(git('log', '-1', '--format=%s')).toBe("Merge branch 'main' into topic");
    const r = lint(tip, head);
    expect(r.out).toMatch(/: PASS/);
    expect(r.status).toBe(0);
    git('checkout', '-q', 'main');
  });

  it.each([
    ['a fixup commit', 'fixup! feat: topic work'],
    ['a squash commit', 'squash! feat: topic work'],
    ['a bare version number', '1.2.3'],
    ['a git revert message', 'Revert "feat: topic work"'],
    ['a merge in any other shape', "Merge branch 'main'"],
  ])('FAILs %s', (_label, message) => {
    git('checkout', '-q', 'main');
    git('reset', '-q', '--hard', base);
    const head = commit(message);
    const r = lint(base, head);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/type-empty|subject-empty/);
  });
});

describe('lint-commits failure summary', () => {
  it('ends with the problems, so a tail of the log shows why', () => {
    git('reset', '-q', '--hard', base);
    const head = commit('feat add a thing without a colon');
    const r = lint(base, head);
    expect(r.status).toBe(1);
    const tail = r.out.trim().split('\n').slice(-4).join('\n');
    expect(tail).toMatch(/problems:/);
    expect(tail).toMatch(/commits: .*✖/);
  });
});
