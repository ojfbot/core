// What `pnpm verify` knows about .github/workflows/*.yml: how to read them, which of their steps it
// can run on this machine, which it cannot (and says so), and the checks that fail when the two
// drift apart.
//
// The commands, environment and step order come from the workflow files
// themselves. This file only holds what they cannot say: what each job needs from the machine, how
// to stand in for the GitHub actions (`uses:`) a laptop does not have, and which GitHub-only
// features no local run can reproduce. Ported from LocalHelp's scripts/lib/verify-ci.mjs
// (LocalHelp issues #74 and #85) and extended to every workflow that runs on `pull_request`.
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { parse } from "yaml";

/** What verify pretends GitHub is doing: a pull request is open on this branch. */
export const EVENT = { name: "pull_request", ref: "refs/pull/0/merge" };

/** The GitHub actions verify can stand in for. Any other `uses:` must be in GITHUB_ONLY or it is reported. */
export const KNOWN_ACTIONS = [
  "actions/checkout",
  "pnpm/action-setup",
  "actions/setup-node",
  "actions/setup-python",
  "actions/upload-artifact",
];

/**
 * Actions and reusable workflows that need GitHub itself and have no local stand-in. A job that uses
 * one is reported SKIPPED with this reason, never run partway and never passed. The key is the
 * `uses:` text without `@<ref>`. A `uses:` in neither this table nor KNOWN_ACTIONS is reported by
 * name as a check problem, so a new external action cannot slip in unseen.
 */
export const GITHUB_ONLY = {
  "ojfbot/github-actions/skill-audit": {
    short: "posts a PR comment through the GitHub API",
    why: "posts a sticky comment on the pull request through the GitHub API (needs the PR number and a token); advisory, it never fails the PR. `bash scripts/hooks/pr-skill-audit.sh` is the manual equivalent",
  },
  "ojfbot/github-actions/.github/workflows/security-scan.yml": {
    short: "reusable workflow from another repository (TruffleHog, key grep, dist guard, pnpm audit)",
    why: "a reusable workflow from another repository: a secret scan with the TruffleHog action over the PR's commit range, an API-key grep, a committed-dist guard and `pnpm audit`. It runs on GitHub only",
  },
};

/**
 * Contexts that only GitHub can fill in. A job whose commands or environment mention one is SKIPPED
 * with that reason, never run with the value left empty.
 */
export const GITHUB_ONLY_CONTEXTS = [
  [/^secrets\./, "uses a repository secret"],
  [/^github\.token$/, "uses the GitHub token"],
  [/^vars\./, "uses a repository variable"],
  [/^github\.event\./, "reads the GitHub event payload"],
];

export class GitHubOnly extends Error {}

/**
 * What each job needs from this machine before it can run, keyed `<workflow file name>/<job id>`.
 * Every job of every workflow that runs on pull_request must be listed; the drift test fails when
 * one is not. "docker" is the Docker engine, "buildx" Docker Buildx, "git-head" a commit to build
 * from. A job that cannot run here at all (GITHUB_ONLY) is listed with no needs.
 */
export const JOB_NEEDS = {
  "ci/build-test": [],
  "ci/check-provenance": ["git-head"],
  "bead-lint/lint": [],
  "northstar-lint/lint": [],
  "fleet-reconcile/reconcile": [],
  "claude-skill-audit/skill-audit": [],
  "security-scan/security": [],
  "fleet-runner-release/release-image": ["docker", "buildx", "git-head"],
};

/**
 * The runner each `runs-on` label stands for. verify builds its Linux runner from the Ubuntu release
 * the label names: `ubuntu-latest` is whatever GitHub currently points it at (ubuntu-26.04 in the
 * CI log of 2026-11-22: "Image: ubuntu-26.04"), so UBUNTU_LATEST is a fact to keep current by hand.
 * The container has the tools core's jobs use (bash, git, python3, jq, sqlite3, Node, pnpm, the
 * Docker CLI); it is a stand-in, not GitHub's full runner image. Labels for another operating
 * system are SKIPPED with the reason; any other label is reported by name.
 */
export const UBUNTU_LATEST = "26.04";
export const LINUX_RUNNERS = {
  "ubuntu-latest": UBUNTU_LATEST,
  "ubuntu-26.04": "26.04",
  "ubuntu-24.04": "24.04",
  "ubuntu-22.04": "22.04",
};
export const OTHER_OS_RUNNER = /^(windows|macos)-/;

/** `{ ubuntu: "26.04" }` for a Linux label, `{ otherOs: label }` for Windows or macOS, else null. */
export function runnerFor(job) {
  const label = job.runsOn;
  if (typeof label !== "string") return null;
  if (label in LINUX_RUNNERS) return { ubuntu: LINUX_RUNNERS[label], label };
  if (OTHER_OS_RUNNER.test(label)) return { otherOs: label, label };
  return null;
}

/** The jobs `--quick` runs, on the working tree on this machine: the build and the unit tests. */
export const QUICK_JOBS = ["ci/build-test"];

/**
 * Jobs that `pnpm verify` runs only when asked for by name (`--job`), never as part of the default
 * run, because they would hand the pull request's code more of this machine than a job should get.
 * The reason is printed next to the job. A pull request that triggers one still needs it run before
 * it is marked ready: the default run exits non-zero for it (see `optInGap` in verify.mjs).
 */
export const OPT_IN_JOBS = {
  "fleet-runner-release/release-image":
    "builds Docker images, so it needs a Docker engine; the only engine here is this machine's own, and the job's scripts (which the pull request can change) could start containers that mount this machine's folders or read other containers' secrets. GitHub runs it on a throwaway engine",
};

/**
 * Every key of a workflow file that verify knows. A key in neither list is reported by name
 * (checkPlan), so nothing GitHub would act on is silently skipped here: a `shell: bash` (which adds
 * pipefail on GitHub), `needs`, `strategy`, `container`, `defaults.run` or `matrix` could otherwise
 * let `pnpm verify` pass what CI fails (LocalHelp issue #85).
 *
 * SUPPORTED_KEYS: verify reads the key and does what GitHub does with it.
 * IGNORED_KEYS: verify reads the key and deliberately does nothing with it; the reason is the value.
 * Adding a key to either list is a decision to make in review, never a way to quiet the check.
 */
export const SUPPORTED_KEYS = {
  workflow: ["env", "jobs"],
  job: ["name", "env", "runs-on", "steps", "if", "timeout-minutes", "uses"],
  step: ["id", "name", "uses", "with", "run", "env", "if", "working-directory", "continue-on-error"],
  pullRequest: ["paths", "paths-ignore"],
};
export const IGNORED_KEYS = {
  workflow: {
    name: "a label",
    "run-name": "a label",
    on: "read separately: only the pull_request trigger and its path filter matter here",
    permissions: "the token's scope on GitHub; verify uses no token",
    concurrency: "cancels older runs on GitHub; verify runs one at a time",
  },
  job: {
    permissions: "the token's scope on GitHub; verify uses no token",
    with: "inputs of a reusable workflow, which is not run here (GITHUB_ONLY)",
    secrets: "secrets of a reusable workflow, which is not run here (GITHUB_ONLY)",
  },
  step: {},
  pullRequest: {
    types: "which pull request actions start the run; verify stands in for an open pull request",
    branches: "which base branches start the run; verify stands in for a pull request to main",
  },
};
/** `with:` keys of each action: the ones verify honours, and the ones it deliberately ignores. */
export const ACTION_INPUTS = {
  "actions/checkout": {
    supported: ["ref", "path", "sparse-checkout"],
    ignored: { "fetch-depth": "the clean clone in the runner always has the full history, a superset of a shallow one" },
  },
  "pnpm/action-setup": { supported: [], ignored: {} },
  "actions/setup-node": {
    supported: ["node-version-file", "node-version"],
    ignored: { cache: "a download cache; verify installs with a cached pnpm store of its own" },
  },
  "actions/setup-python": { supported: ["python-version"], ignored: {} },
  "actions/upload-artifact": {
    supported: [],
    ignored: {
      name: "nothing is uploaded from a local run",
      path: "nothing is uploaded from a local run",
      "retention-days": "nothing is uploaded from a local run",
      "if-no-files-found": "nothing is uploaded from a local run",
    },
  },
};

/**
 * Steps whose `if:` is false on an open pull request, which GitHub skips too. verify evaluates every
 * step condition as a pull request (EVENT). Any other step that its condition skips is a check that
 * did not run, so its job is reported INCOMPLETE and verify exits non-zero (LocalHelp #85):
 * a condition must not turn into a quiet PASS. An entry needs a reason; it matches the job, the
 * action and the exact condition text.
 */
export const EXPECTED_LOCAL_SKIPS = [
  {
    job: "fleet-runner-release/release-image",
    uses: "actions/upload-artifact",
    if: "github.event_name != 'pull_request' && github.ref == 'refs/heads/main'",
    reason: "publishes the release archive from a push to main; a pull request does not publish",
  },
  {
    job: "ci/build-test",
    uses: "",
    if: "steps.promote_sweeps.outputs.run != 'false'",
    reason: "the FleetRunner promote's kill sweeps run only when the change touches the promote; the step before decides and prints why",
  },
];

/** The Node a job gets when it has no setup-node step: the runner's own, as on GitHub's Ubuntu image. */
export const DEFAULT_NODE = "22";

/** What to tell the person when a step fails, matched on the step's command. First match wins. */
export const FIX_HINTS = [
  [/pnpm install --frozen-lockfile/, "pnpm-lock.yaml is out of date: run `pnpm install` and commit the lockfile."],
  [/test_user_scope_install/, "The user-scope installer regression failed: read the log, then run it again with `python3 scripts/__tests__/test_user_scope_install.py -v`."],
  [/pnpm build/, "A package does not compile: read the errors above, then run `pnpm build`."],
  [/pnpm test\b/, "A test failed: read the log, then re-run `pnpm test` (core#649 tracks the known FleetRunner flakes)."],
  [/proof:local:test/, "A FleetRunner proof-helper test failed: read the log (core#649 tracks the known flakes)."],
  [/launcher-tests/, "A launcher registration test failed: read the log."],
  [/check-provenance/, "An ADR provenance SHA does not resolve in the history: read the log."],
  [/roadmap-lint|northstar-lint|bead-lint/, "The lint reported an error: read the log, then run the same `node scripts/<name>.mjs --check`."],
  [/fleet-manifest/, "The fleet manifest script failed: read the log."],
  [/release-image\.sh/, "The image build or its reproducibility check failed: read the log."],
  [/verify-release\.sh/, "The release checksum, archive identity or non-root check failed: read the log."],
];

/** The keys of `value` when it is a mapping, else none. */
const keysOf = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];

/** `on:` as a mapping of trigger name to its configuration, whatever shape the file uses. */
function triggersOf(on) {
  if (typeof on === "string") return { [on]: null };
  if (Array.isArray(on)) return Object.fromEntries(on.map((name) => [name, null]));
  return on !== null && typeof on === "object" ? on : {};
}

/** Every workflow file in `dir`, in name order, with only what verify uses plus every raw key. */
export function loadWorkflows(dir) {
  return readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((file) => {
      const stem = basename(file).replace(/\.ya?ml$/, "");
      const doc = parse(readFileSync(join(dir, file), "utf8")) ?? {};
      const triggers = triggersOf(doc.on);
      const pullRequest = "pull_request" in triggers;
      const filter = triggers.pull_request ?? {};
      const jobs = Object.entries(doc.jobs ?? {}).map(([id, job]) => ({
        id,
        key: `${stem}/${id}`,
        name: job.name ?? id,
        env: job.env ?? {},
        runsOn: job["runs-on"],
        workflowEnv: doc.env ?? {},
        uses: job.uses === undefined ? null : String(job.uses),
        if: job.if,
        timeoutMinutes: job["timeout-minutes"],
        steps: (job.steps ?? []).map((step, index) => ({ ...step, index, rawKeys: keysOf(step) })),
        rawKeys: keysOf(job),
      }));
      return {
        file,
        stem,
        name: doc.name ?? stem,
        env: doc.env ?? {},
        triggers: Object.keys(triggers),
        pullRequest,
        pullRequestKeys: pullRequest ? keysOf(filter) : [],
        paths: Array.isArray(filter?.paths) ? filter.paths.map(String) : null,
        pathsIgnore: Array.isArray(filter?.["paths-ignore"]) ? filter["paths-ignore"].map(String) : null,
        jobs,
        rawKeys: keysOf(doc),
      };
    });
}

/** Keys that are in neither list, as plain sentences naming the key and where it is. */
function unsupportedKeys(keys, level, where) {
  return keys
    .filter((key) => !SUPPORTED_KEYS[level].includes(key) && !(key in IGNORED_KEYS[level]))
    .map((key) => `${where}: the key "${key}" is not one verify understands, so a pass here would not mean a pass on GitHub; ${key === "services" ? "service containers are not supported yet (a service must be reachable by name and on localhost as on GitHub)" : "teach scripts/lib/verify-ci.mjs, or take the key out of the workflow"}`);
}

// ---------------------------------------------------------------------------------------------
// Path filters (`on.pull_request.paths`)

/** GitHub's filter glob as a RegExp: `*` stays inside a folder, `**` crosses folders, `?` is one character. */
export function globToRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        i += 1;
        if (glob[i + 1] === "/") {
          i += 1;
          source += "(?:.*/)?";
        } else source += ".*";
      } else source += "[^/]*";
    } else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

/**
 * Whether GitHub starts the workflow for a pull request that changes `files`. A `paths` list with
 * `!` patterns is applied in order, last match wins; `paths-ignore` skips the run when every file
 * matches. No filter means always.
 */
export function pathFilterMatches(workflow, files) {
  if (workflow.paths) {
    return files.some((file) => {
      let selected = false;
      for (const pattern of workflow.paths) {
        const negated = pattern.startsWith("!");
        if (globToRegExp(negated ? pattern.slice(1) : pattern).test(file)) selected = !negated;
      }
      return selected;
    });
  }
  if (workflow.pathsIgnore) {
    return files.some((file) => !workflow.pathsIgnore.some((pattern) => globToRegExp(pattern).test(file)));
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Expressions

const EXPRESSION = /\$\{\{\s*([\s\S]+?)\s*\}\}/g;

/**
 * Evaluate the `${{ }}` expressions the workflows use in `run`, `env` and `with`. A GitHub-only
 * context throws GitHubOnly (the job is SKIPPED with the reason); anything else unknown throws, so a
 * new kind of expression stops verify instead of being run wrongly.
 * `ctx`: { workspace, runnerTemp, sha, runId, stepOutputs: { <id>: { <name>: value } }, knownSteps?: Set }.
 */
export function substitute(text, ctx) {
  if (typeof text !== "string") return text;
  return text.replace(EXPRESSION, (_whole, expression) => {
    if (expression === "github.workspace") return ctx.workspace;
    if (expression === "runner.temp") return ctx.runnerTemp;
    if (expression === "github.sha") return ctx.sha;
    if (expression === "github.event_name") return EVENT.name;
    if (expression === "github.ref") return EVENT.ref;
    if (expression === "github.run_id") return ctx.runId;
    if (expression === "runner.os") return "Linux";
    if (/^inputs\.[A-Za-z0-9_-]+$/.test(expression)) return ""; // a pull request has no workflow_dispatch inputs
    const output = /^steps\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)$/.exec(expression);
    if (output) {
      const [, id, name] = output;
      if (ctx.stepOutputs[id]?.[name] !== undefined) return ctx.stepOutputs[id][name];
      if (ctx.knownSteps?.has(id)) return "";
      throw new Error(`\${{ ${expression} }} refers to a step that has not run`);
    }
    const only = GITHUB_ONLY_CONTEXTS.find(([pattern]) => pattern.test(expression));
    if (only) throw new GitHubOnly(`${only[1]} (\${{ ${expression} }}), which only GitHub has`);
    throw new Error(`verify cannot evaluate \${{ ${expression} }}; teach scripts/lib/verify-ci.mjs`);
  });
}

/**
 * A step's (or job's) `if:`, evaluated as an open pull request (EVENT). Only the forms the workflows
 * use are understood (success(), always(), failure(), cancelled(), github.event_name, github.ref
 * and an earlier step's output, `steps.<id>.outputs.<name>`, compared with ==, !=, &&, || and !);
 * anything else throws. An output is the text the step wrote (`stepOutputs`), or "" when the step
 * is one of the job's (`knownSteps`) and wrote none, as on GitHub; a step the job does not have
 * throws. A small parser, not eval: workflow text never becomes code.
 */
export function stepCondition(condition, { succeeded, stepOutputs = {}, knownSteps = new Set() }) {
  if (condition === undefined) return succeeded;
  const text = String(condition).replace(/^\s*\$\{\{\s*([\s\S]*?)\s*\}\}\s*$/, "$1");
  const unsupported = () => new Error(`verify cannot evaluate if: ${condition}`);
  const tokens = text.match(/\s*(&&|\|\||==|!=|!|\(|\)|'[^']*'|[A-Za-z_][\w.]*)/gy)?.map((t) => t.trim()) ?? [];
  if (tokens.join("").length !== text.replace(/\s+/g, "").length) throw unsupported();
  const values = { "github.event_name": EVENT.name, "github.ref": EVENT.ref };
  const calls = { success: succeeded, always: true, failure: !succeeded, cancelled: false };
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const operand = () => {
    const token = take();
    if (token === "(") {
      const inner = or();
      if (take() !== ")") throw unsupported();
      return inner;
    }
    if (token === "!") return !operand();
    if (token === undefined) throw unsupported();
    if (token.startsWith("'")) return token.slice(1, -1);
    if (peek() === "(") {
      take();
      if (take() !== ")" || !(token in calls)) throw unsupported();
      return calls[token];
    }
    const output = /^steps\.([A-Za-z0-9_]+)\.outputs\.([A-Za-z0-9_]+)$/.exec(token);
    if (output) {
      const [, id, name] = output;
      if (stepOutputs[id]?.[name] !== undefined) return stepOutputs[id][name];
      if (knownSteps.has(id) || id in stepOutputs) return "";
      throw unsupported();
    }
    if (!(token in values)) throw unsupported();
    return values[token];
  };
  const comparison = () => {
    let left = operand();
    while (peek() === "==" || peek() === "!=") {
      const operator = take();
      const right = operand();
      left = operator === "==" ? left === right : left !== right;
    }
    return left;
  };
  const and = () => {
    let left = comparison();
    while (peek() === "&&") {
      take();
      const right = comparison();
      left = left && right;
    }
    return left;
  };
  function or() {
    let left = and();
    while (peek() === "||") {
      take();
      const right = and();
      left = left || right;
    }
    return left;
  }
  const result = or();
  if (position !== tokens.length) throw unsupported();
  return Boolean(result);
}

const bareCondition = (condition) =>
  String(condition)
    .replace(/^\s*\$\{\{\s*([\s\S]*?)\s*\}\}\s*$/, "$1")
    .replace(/\s+/g, " ")
    .trim();

/** Why this step may be skipped on a pull request, or null when its skip means a check did not run. */
export function expectedLocalSkip(jobKey, step) {
  if (step.if === undefined) return null;
  const condition = bareCondition(step.if);
  const found = EXPECTED_LOCAL_SKIPS.find(
    (entry) =>
      entry.job === jobKey && entry.uses === String(step.uses ?? "").split("@")[0] && entry.if === condition,
  );
  return found ? found.reason : null;
}

/** The `uses:` of a step or job without its `@<ref>`. */
export const usesName = (uses) => String(uses ?? "").split("@")[0];

/**
 * Why this job cannot run on this machine (a GitHub-only action, reusable workflow, secret or
 * event payload), or null when it can: `short` for the summary, `full` for the job's own line.
 */
export function githubOnlyReason(job, ctx) {
  if (job.uses) {
    const entry = GITHUB_ONLY[usesName(job.uses)];
    return { short: entry?.short ?? "a reusable workflow verify does not know", full: `calls ${usesName(job.uses)}, ${entry?.why ?? "a reusable workflow verify does not know"}` };
  }
  for (const step of job.steps) {
    if (step.uses && GITHUB_ONLY[usesName(step.uses)]) {
      const entry = GITHUB_ONLY[usesName(step.uses)];
      return { short: entry.short, full: `step ${step.index + 1} uses ${usesName(step.uses)}, which ${entry.why}` };
    }
  }
  const known = new Set(job.steps.filter((step) => step.id).map((step) => step.id));
  const probe = { ...ctx, stepOutputs: {}, knownSteps: known };
  const texts = [
    ...Object.values(job.workflowEnv ?? {}),
    ...Object.values(job.env),
    ...job.steps.flatMap((step) => [step.run, ...Object.values(step.env ?? {}), ...Object.values(step.with ?? {})]),
  ];
  for (const text of texts) {
    try {
      substitute(typeof text === "string" ? text : String(text ?? ""), probe);
    } catch (error) {
      if (error instanceof GitHubOnly) return { short: error.message.split(" (")[0], full: error.message };
    }
  }
  return null;
}

/**
 * The Node version a setup-node step asks for, as text, or null when it asks for none. A
 * `node-version-file` is read from `repoRoot`; an unreadable one gives "" so it never matches.
 */
export function requestedNode(step, repoRoot) {
  const file = step.with?.["node-version-file"];
  if (file !== undefined) {
    try {
      return readFileSync(join(repoRoot, String(file)), "utf8").trim().replace(/^v/, "");
    } catch {
      return "";
    }
  }
  const version = step.with?.["node-version"];
  return version === undefined ? null : String(version).trim().replace(/^v/, "");
}

/**
 * Everything wrong between the workflow files and verify, as plain sentences. Empty when they
 * agree. Only workflows that run on pull_request are checked; the others are not run and are named
 * by `outOfScope`.
 */
export function checkPlan(workflows) {
  const problems = [];
  const inScope = workflows.filter((workflow) => workflow.pullRequest);
  const keys = inScope.flatMap((workflow) => workflow.jobs.map((job) => job.key));
  for (const key of keys) {
    if (!(key in JOB_NEEDS)) {
      problems.push(`CI job "${key}" has no verify step: add it to JOB_NEEDS in scripts/lib/verify-ci.mjs`);
    }
  }
  for (const key of Object.keys(JOB_NEEDS)) {
    if (!keys.includes(key)) problems.push(`verify lists "${key}" but no workflow that runs on pull_request has that job: remove it from JOB_NEEDS`);
  }
  for (const key of QUICK_JOBS) {
    if (!keys.includes(key)) problems.push(`--quick lists "${key}" but there is no such job`);
  }
  for (const key of Object.keys(OPT_IN_JOBS)) {
    if (!keys.includes(key)) problems.push(`verify lists "${key}" as opt-in but there is no such job: remove it from OPT_IN_JOBS`);
  }
  for (const workflow of inScope) {
    problems.push(...unsupportedKeys(workflow.rawKeys, "workflow", workflow.file));
    problems.push(...unsupportedKeys(workflow.pullRequestKeys, "pullRequest", `${workflow.file}: on.pull_request`));
    for (const job of workflow.jobs) {
      problems.push(...checkJob(workflow, job));
    }
  }
  return problems;
}

function checkJob(workflow, job) {
  const problems = [];
  problems.push(...unsupportedKeys(job.rawKeys, "job", job.key));
  if (job.uses) {
    if (!GITHUB_ONLY[usesName(job.uses)]) {
      problems.push(`${job.key}: calls "${job.uses}", a reusable workflow verify does not know; add it to GITHUB_ONLY with the reason it cannot run here`);
    }
    return problems;
  }
  if (job.if !== undefined) {
    try {
      stepCondition(job.if, { succeeded: true });
    } catch (error) {
      problems.push(`${job.key}: ${error.message}`);
    }
  }
  if (job.timeoutMinutes !== undefined && !(Number(job.timeoutMinutes) > 0)) {
    problems.push(`${job.key}: timeout-minutes "${job.timeoutMinutes}" is not a number of minutes`);
  }
  if (job.runsOn === undefined) {
    problems.push(`${job.key}: has no runs-on, so verify cannot tell which machine GitHub would give it`);
  } else if (!runnerFor(job)) {
    problems.push(`${job.key}: runs-on "${typeof job.runsOn === "string" ? job.runsOn : JSON.stringify(job.runsOn)}" is not one verify knows (${Object.keys(LINUX_RUNNERS).join(", ")}, or windows-* / macos-*, which are SKIPPED); teach LINUX_RUNNERS in scripts/lib/verify-ci.mjs`);
  }
  const known = new Set(job.steps.filter((step) => step.id).map((step) => step.id));
  const ctx = { workspace: "/w", runnerTemp: "/t", sha: "0".repeat(40), runId: "1", stepOutputs: {}, knownSteps: known };
  const strings = [
    ...Object.values(workflow.env),
    ...Object.values(job.env),
  ];
  for (const step of job.steps) {
    problems.push(...unsupportedKeys(step.rawKeys, "step", `${job.key}: step ${step.index + 1}`));
    if (step.uses) {
      const action = usesName(step.uses);
      if (GITHUB_ONLY[action]) continue; // the whole job is SKIPPED; its inputs are never evaluated
      if (!KNOWN_ACTIONS.includes(action)) {
        problems.push(`${job.key}: step ${step.index + 1} uses "${step.uses}", which verify cannot stand in for; add it to GITHUB_ONLY with the reason, or teach scripts/lib/verify-ci.mjs`);
        continue;
      }
      const inputs = ACTION_INPUTS[action] ?? { supported: [], ignored: {} };
      for (const key of keysOf(step.with)) {
        if (!inputs.supported.includes(key) && !(key in inputs.ignored)) {
          problems.push(`${job.key}: step ${step.index + 1} (${action}): the input "${key}" is not one verify understands, so a pass here would not mean a pass on GitHub; teach scripts/lib/verify-ci.mjs, or take it out of the workflow`);
        }
      }
      if (action === "actions/setup-node" && step.with?.["node-version-file"] !== undefined && step.with?.["node-version"] !== undefined) {
        // GitHub's setup-node uses node-version when both are given; reading only one here would
        // let the other be what verify checks and CI ignores.
        problems.push(`${job.key}: step ${step.index + 1} (${action}) sets both node-version and node-version-file, which conflict`);
      }
    } else if (typeof step.run !== "string") {
      problems.push(`${job.key}: step ${step.index + 1} has neither run nor uses`);
    }
    strings.push(step.run, ...Object.values(step.env ?? {}), ...Object.values(step.with ?? {}));
    if (step.if !== undefined) {
      try {
        stepCondition(step.if, { succeeded: true, knownSteps: known });
      } catch (error) {
        problems.push(`${job.key}: ${error.message}`);
      }
    }
  }
  for (const text of strings) {
    try {
      substitute(typeof text === "string" ? text : String(text ?? ""), ctx);
    } catch (error) {
      if (!(error instanceof GitHubOnly)) problems.push(`${job.key}: ${error.message}`);
    }
  }
  return problems;
}

/** Workflow files that do not run on pull_request, by file name: verify does not run them. */
export const outOfScope = (workflows) =>
  workflows.filter((workflow) => !workflow.pullRequest).map((workflow) => `${workflow.file} (${workflow.triggers.join(", ") || "no trigger"})`);

// ---------------------------------------------------------------------------------------------
// Guards: what verify will delete, what a job may see, what it may print

const inside = (parent, child) => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);

/**
 * Refuse to delete anything that is, contains or could be the repository itself. verify removes
 * only (a) folders under its own state folder and (b) a package's git-ignored `dist`; every other
 * path, and anything equal to or above the repository root (its `.git` and uncommitted files
 * included), throws.
 */
export function assertRemovable(target, { repoRoot, stateRoot }) {
  const path = resolve(target);
  const repo = resolve(repoRoot);
  const state = resolve(stateRoot);
  if (inside(path, repo)) throw new Error(`verify refuses to delete the repository or a folder that contains it (${path})`);
  if (inside(state, repo)) throw new Error(`verify refuses to delete anything: its state folder is or contains the repository (${state})`);
  if (inside(state, path) && path !== state) return path;
  if (inside(repo, path)) {
    const relative = path.slice(repo.length + 1).split(sep);
    if (relative.length === 3 && relative[0] === "packages" && relative[2] === "dist") return path;
    throw new Error(`verify refuses to delete anything in the repository except packages/<name>/dist (${path})`);
  }
  throw new Error(`verify refuses to delete ${path}: it is outside verify's own folder`);
}

/**
 * Where a `actions/checkout` step with `ref:` puts its files. Natively the step would replace the
 * workspace, which is the repository, so it is refused; in the runner it is a path inside the
 * container's own workspace. `path` may not climb out of the workspace, name `.git`, or be absolute.
 */
export function checkoutDestination({ base, path, native }) {
  if (native) {
    throw new Error("a checkout of another ref would overwrite the repository on this machine, so it only runs in the Linux runner (drop --native and --quick)");
  }
  const relative = String(path ?? ".");
  const target = resolve(base, relative);
  if (relative.startsWith("/") || !inside(resolve(base), target)) throw new Error(`checkout path "${relative}" leaves the workspace`);
  if (target === resolve(base) && path !== undefined && path !== ".") throw new Error(`checkout path "${relative}" is the workspace itself`);
  if (target.split(sep).includes(".git")) throw new Error(`checkout path "${relative}" is inside .git`);
  return target;
}

/** Variables a native job gets from this machine's environment: locale only. Everything else is dropped. */
const NATIVE_KEEP = /^(LANG|LANGUAGE|LC_[A-Z]+|TZ)$/;

/**
 * The environment of a job run natively: an allowlist, so a key or token in this shell (an API key,
 * a cloud credential, an SSH agent) can never reach the pull request's code. Only PATH, a scratch
 * HOME and TMPDIR, the locale, the CI markers and what the workflow itself declares get through.
 * `workflowEnv` is what `env:` declares for the job and is added last by the caller.
 * Returns the environment and the number of variables that were not passed on.
 */
export function buildNativeEnv(parent, { home, tmp, path }) {
  const env = {};
  for (const [key, value] of Object.entries(parent)) if (NATIVE_KEEP.test(key)) env[key] = value;
  Object.assign(env, {
    PATH: path,
    HOME: home,
    TMPDIR: tmp,
    USER: "runner",
    LOGNAME: "runner",
    CI: "true",
    GITHUB_ACTIONS: "true",
    NO_COLOR: "1",
  });
  const dropped = Object.keys(parent).filter((key) => !(key in env)).length;
  return { env, dropped };
}

/**
 * Replace the home folder, the repository root, the temp folder and any other `/Users/<name>` or
 * `/home/<name>` in text that is printed or logged, so output pasted into a public pull request
 * carries no machine-specific path. Longest root first.
 */
export function redactText(text, { repoRoot, home, tmp, extra = [] }) {
  const roots = [
    [repoRoot, "<repo>"],
    ...extra,
    [tmp?.replace(/\/$/, ""), "$TMPDIR"],
    [home, "~"],
  ]
    .filter(([root]) => root && root.length > 1)
    .sort((a, b) => b[0].length - a[0].length);
  let result = String(text);
  for (const [root, label] of roots) result = result.split(root).join(label);
  return result
    .replace(/\/Users\/[^/\s:'"`)]+/g, "~")
    .replace(/\/home\/(?!runner\b)[^/\s:'"`)]+/g, "~");
}

/** Python 3 of each Ubuntu release, where known (Ubuntu 26.04's is not recorded here). */
export const PYTHON_OF_UBUNTU = { "22.04": "3.10", "24.04": "3.12" };

/**
 * How a machine running a job natively differs from the Ubuntu image its `runs-on` names, as one
 * sentence, or null when it is the same release with the same Python. A pass on a different
 * release can hide a failure on GitHub's, so a native run always says so.
 * `target`: { label, ubuntu }. `host`: { platform, osId, osVersion, python }.
 */
export function describeHostMismatch(target, host) {
  const wantedPython = PYTHON_OF_UBUNTU[target.ubuntu];
  const where = host.platform === "linux" ? (host.osId ? `${host.osId} ${host.osVersion}`.trim() : "Linux of unknown release") : host.platform === "darwin" ? "macOS" : host.platform;
  const sameOs = host.platform === "linux" && host.osId === "ubuntu" && host.osVersion === target.ubuntu;
  const pythonSame = host.python && wantedPython ? host.python.startsWith(`${wantedPython}.`) : true;
  if (sameOs && pythonSame) return null;
  const python = host.python
    ? `this machine's python3 is ${host.python}${wantedPython ? `, that image's is ${wantedPython}.x` : ", that image's is not recorded here"}`
    : "python3 was not found here";
  return `on ${where}, but runs-on: ${target.label} is Ubuntu ${target.ubuntu} on GitHub, so a pass here is not a pass there (${python})`;
}
