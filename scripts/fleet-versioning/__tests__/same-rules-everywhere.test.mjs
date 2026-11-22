// The local hook, the CI job and `pnpm verify` must all apply the same rules, with the same CLI
// version (adr:deterministic-fleet-versioning). Each assertion below fails if one of them is
// pointed somewhere else.
import { describe, it, expect } from 'vitest';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMMITLINT_VERSION, CONFIG_RELATIVE, configPath } from '../lint-commits.mjs';
import { LOCAL_REUSABLE, checkPlan, loadWorkflows } from '../../lib/verify-ci.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const workflows = loadWorkflows(join(root, '.github', 'workflows'));
const runText = (file) =>
  workflows
    .find((w) => w.file === file)
    .jobs.flatMap((j) => j.steps.map((s) => String(s.run ?? '')))
    .join('\n');

describe('one rules file', () => {
  it('is the file the shared package exports', () => {
    expect(realpathSync(configPath)).toBe(realpathSync(join(root, 'packages/commitlint-config/index.mjs')));
    expect(CONFIG_RELATIVE).toBe('packages/commitlint-config/index.mjs');
  });

  it('is what the local hook loads: commitlint.config.mjs re-exports the same module object', async () => {
    const hookConfig = (await import(pathToFileURL(join(root, 'commitlint.config.mjs')).href)).default;
    const shared = (await import(pathToFileURL(configPath).href)).default;
    expect(hookConfig).toBe(shared);
    const requireFromRoot = createRequire(join(root, 'package.json'));
    expect(realpathSync(requireFromRoot.resolve('@core/commitlint-config'))).toBe(realpathSync(configPath));
  });

  it('is what the hook runs: no --config override, so only commitlint.config.mjs applies', () => {
    const hook = read('.githooks/commit-msg');
    expect(hook).toMatch(/pnpm exec commitlint --edit "\$1"/);
    expect(hook).not.toMatch(/--config/);
    expect(read('commitlint.config.mjs').trim()).toBe("export { default } from '@core/commitlint-config';");
    expect(read('scripts/install-git-hooks.sh')).toMatch(/core\.hooksPath \.githooks/);
  });

  it('is what the CI job runs: the reusable workflow calls the shared script and names no rules itself', () => {
    const text = runText('reusable-commitlint.yml');
    expect(text).toContain('node .fleet-core/scripts/fleet-versioning/lint-commits.mjs');
    expect(text).not.toMatch(/--config|commitlint\.config|dlx/);
    const yaml = read('.github/workflows/reusable-commitlint.yml');
    expect(yaml).toMatch(/packages\/commitlint-config/);
    expect(yaml).toMatch(/scripts\/fleet-versioning/);
  });

  it('is what pnpm verify runs: its mapping calls the same script and verify agrees with the workflow', () => {
    expect(LOCAL_REUSABLE['./.github/workflows/reusable-commitlint.yml'].command).toBe(
      'node scripts/fleet-versioning/lint-commits.mjs',
    );
    expect(runText('reusable-commitlint.yml').replaceAll('.fleet-core/', '')).toContain(
      LOCAL_REUSABLE['./.github/workflows/reusable-commitlint.yml'].command,
    );
    expect(runText('reusable-version-edit-check.yml').replaceAll('.fleet-core/', '')).toContain(
      LOCAL_REUSABLE['./.github/workflows/reusable-version-edit-check.yml'].command,
    );
    expect(checkPlan(workflows)).toEqual([]);
  });

  it('is called by Core\'s own pull request workflow', () => {
    const yaml = read('.github/workflows/versioning.yml');
    expect(yaml).toContain('uses: ./.github/workflows/reusable-commitlint.yml');
    expect(yaml).toContain('uses: ./.github/workflows/reusable-version-edit-check.yml');
  });

  it('ci/build-test lints HEAD with the repository config, never another file', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('pnpm exec commitlint --last --verbose');
    expect(ci).not.toMatch(/commitlint[^\n]*--config/);
  });
});

describe('one CLI version', () => {
  it('is pinned the same in the script, the root devDependency and nowhere else', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.devDependencies['@commitlint/cli']).toBe(COMMITLINT_VERSION);
    expect(pkg.devDependencies['@core/commitlint-config']).toBe('workspace:*');
    for (const file of ['reusable-commitlint.yml', 'versioning.yml', 'ci.yml']) {
      expect(read(`.github/workflows/${file}`)).not.toMatch(/@commitlint\/cli@/);
    }
  });
});
