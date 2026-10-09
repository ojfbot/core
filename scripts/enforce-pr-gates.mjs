import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const POLICY_NAME = 'PR-only default branch';
const BASELINE = ['pull_request', 'deletion', 'non_fast_forward'];

export function hasPrGate(effectiveRules, sources) {
  return sources.some(source =>
    source.enforcement === 'active' &&
    Array.isArray(source.bypass_actors) && source.bypass_actors.length === 0 &&
    BASELINE.every(type => effectiveRules.some(rule =>
      rule.type === type && rule.ruleset_id === source.id)));
}

export function policyBody(existing) {
  const defaults = {
    name: POLICY_NAME,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'pull_request', parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
        allowed_merge_methods: ['merge', 'squash', 'rebase'],
      } },
    ],
  };
  if (!existing) return defaults;
  const scope = existing.conditions?.ref_name;
  if (!scope || scope.include.length !== 1 || scope.include[0] !== '~DEFAULT_BRANCH' || scope.exclude.length !== 0) {
    throw new Error('Owned policy has unexpected branch scope; manual reconciliation required');
  }
  return {
    ...defaults,
    rules: [...(existing.rules ?? []), ...defaults.rules.filter(rule =>
      !(existing.rules ?? []).some(current => current.type === rule.type))],
  };
}

function gh(args, body) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
    ...(body ? { input: JSON.stringify(body) } : {}),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh exited ${result.status}`);
  return JSON.parse(result.stdout);
}

function inspect(owner, repo) {
  const endpoint = `repos/${owner}/${repo.name}`;
  const rules = gh(['api', '--paginate', '--slurp', `${endpoint}/rules/branches/${encodeURIComponent(repo.defaultBranchRef.name)}?per_page=100`]).flat();
  const sourceIds = [...new Set(rules.filter(rule =>
    rule.type === 'pull_request' && rule.ruleset_source_type === 'Repository').map(rule => rule.ruleset_id))];
  const sources = sourceIds.map(id => gh(['api', `${endpoint}/rulesets/${id}`]));
  return { protected: hasPrGate(rules, sources), rules, sources };
}

export function enforceRepo(owner, repo, apply, inspectRepo = inspect, callGh = gh) {
  const before = inspectRepo(owner, repo);
  if (before.protected) return { status: 'protected', changed: false };
  if (!apply) return { status: 'needs-policy', changed: false };
  const endpoint = `repos/${owner}/${repo.name}/rulesets`;
  const existing = callGh(['api', '--paginate', '--slurp', `${endpoint}?per_page=100`]).flat().filter(rule => rule.name === POLICY_NAME && rule.target === 'branch');
  if (existing.length > 1) throw new Error('Duplicate policy names; manual reconciliation required');
  const id = existing[0]?.id;
  const current = id ? callGh(['api', `${endpoint}/${id}`]) : undefined;
  callGh(['api', id ? `${endpoint}/${id}` : endpoint, '--method', id ? 'PUT' : 'POST', '--input', '-'], policyBody(current));
  if (!inspectRepo(owner, repo).protected) throw new Error('Policy write did not produce an effective no-bypass gate');
  return { status: 'protected', changed: true };
}

function main() {
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--apply', '--public-only'].includes(flag) && !/^--(?:owner|repo|output)=.+$/.test(flag))) {
    throw new Error('Usage: pnpm exec node scripts/enforce-pr-gates.mjs [--apply] [--public-only] [--owner=ojfbot] [--repo=name] [--output=path]');
  }
  const value = name => flags.find(flag => flag.startsWith(`--${name}=`))?.slice(name.length + 3);
  const owner = value('owner') ?? 'ojfbot';
  const apply = flags.includes('--apply');
  const repos = gh(['repo', 'list', owner, '--limit', '1000', '--json', 'name,isArchived,isFork,visibility,defaultBranchRef']);
  if (!Array.isArray(repos) || repos.length === 0 || repos.length >= 1000) throw new Error('Discovery empty or at limit; refusing incomplete coverage');
  const active = repos.filter(repo => !repo.isArchived && !repo.isFork && repo.defaultBranchRef &&
    (!flags.includes('--public-only') || repo.visibility === 'PUBLIC'));
  const selected = value('repo') ? active.filter(repo => repo.name === value('repo')) : active;
  if (selected.length === 0) throw new Error('No matching active repository');
  const results = selected.map(repo => {
    try {
      return { repo: repo.name, visibility: repo.visibility, ...enforceRepo(owner, repo, apply) };
    } catch (error) {
      const platformBlocked = /Upgrade to GitHub Pro or make this repository public/.test(error.message);
      return { repo: repo.name, visibility: repo.visibility, status: platformBlocked ? 'plan-blocked' : 'error', changed: platformBlocked ? false : null, error: error.message };
    }
  });
  const report = { observedAt: new Date().toISOString(), owner, apply, results };
  if (value('output')) writeFileSync(value('output'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    active: selected.length, protected: results.filter(result => result.status === 'protected').length,
    changed: results.filter(result => result.changed).length,
    needsPolicy: results.filter(result => result.status === 'needs-policy').length,
    planBlocked: results.filter(result => result.status === 'plan-blocked').length,
    errors: results.filter(result => result.status === 'error').length,
  }));
  if (results.some(result => result.status !== 'protected')) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
