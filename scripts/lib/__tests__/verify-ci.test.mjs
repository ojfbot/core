// Drift tests for `pnpm verify` (ojfbot/core#650): the real workflow files must be fully understood by
// scripts/lib/verify-ci.mjs, and a key, action or job it does not know must be reported by name.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  GitHubOnly,
  JOB_NEEDS,
  checkPlan,
  githubOnlyReason,
  globToRegExp,
  loadWorkflows,
  outOfScope,
  pathFilterMatches,
  stepCondition,
  substitute,
} from "../verify-ci.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const realWorkflows = join(repoRoot, ".github/workflows");

const dirs = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});
/** A folder holding the given workflow files, as `{ "name.yml": "text" }`. */
function workflowsWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "verify-ci-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const CI = `
name: t
on: [pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

describe("the real workflow files", () => {
  const workflows = loadWorkflows(realWorkflows);

  it("are fully understood: no job without a verify entry, no key verify does not know", () => {
    expect(checkPlan(workflows)).toEqual([]);
  });

  it("every job of a workflow that runs on pull_request has a JOB_NEEDS entry, and none is stale", () => {
    const keys = workflows.filter((w) => w.pullRequest).flatMap((w) => w.jobs.map((j) => j.key));
    expect(Object.keys(JOB_NEEDS).sort()).toEqual([...keys].sort());
  });

  it("names the workflows it does not run because they have no pull_request trigger", () => {
    expect(outOfScope(workflows).join(" ")).toMatch(/claude\.yml/);
  });

  it("stands in for every action it runs, and reports the GitHub-only jobs as such", () => {
    const audit = workflows.find((w) => w.stem === "claude-skill-audit").jobs[0];
    const scan = workflows.find((w) => w.stem === "security-scan").jobs[0];
    const ctx = { workspace: "/w", runnerTemp: "/t", sha: "0".repeat(40), runId: "1" };
    expect(githubOnlyReason(audit, ctx)?.full).toMatch(/skill-audit/);
    expect(githubOnlyReason(scan, ctx)?.full).toMatch(/reusable workflow/);
    const ci = workflows.find((w) => w.stem === "ci").jobs[0];
    expect(githubOnlyReason(ci, ctx)).toBeNull();
  });
});

describe("a workflow key verify does not understand is reported by name", () => {
  const problemsFor = (extraJob, extraWorkflow = "") =>
    checkPlan(loadWorkflows(workflowsWith({ "ci.yml": CI.replace("    steps:", `${extraJob}\n    steps:`) + extraWorkflow })));

  it.each([
    ["needs", "    needs: other"],
    ["strategy", "    strategy:\n      matrix:\n        node: [22]"],
    ["container", "    container: node:22"],
    ["defaults", "    defaults:\n      run:\n        shell: bash"],
    ["continue-on-error", "    continue-on-error: true"],
  ])("job key %s", (key, yaml) => {
    expect(problemsFor(yaml).join("\n")).toContain(`the key "${key}" is not one verify understands`);
  });

  it("step key shell (it adds pipefail on GitHub)", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("- run: echo hi", "- run: echo hi\n        shell: bash") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('the key "shell" is not one verify understands');
  });

  it("workflow key defaults", () => {
    const dir = workflowsWith({ "ci.yml": `${CI}defaults:\n  run:\n    shell: bash\n` });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('the key "defaults"');
  });

  it("pull_request key branches-ignore", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("on: [pull_request]", "on:\n  pull_request:\n    branches-ignore: [x]") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('the key "branches-ignore"');
  });

  it("an action input", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("- run: echo hi", "- uses: actions/checkout@v4\n        with:\n          lfs: true") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('the input "lfs"');
  });

  it("an external action nobody classified", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("- run: echo hi", "- uses: someone/else@v1") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('uses "someone/else@v1", which verify cannot stand in for');
  });

  it("a job with no verify entry", () => {
    const dir = workflowsWith({ "other.yml": CI });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('CI job "other/build-test" has no verify step');
  });

  it("an expression it cannot evaluate", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("echo hi", "echo ${{ github.base_ref }}") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain("verify cannot evaluate ${{ github.base_ref }}");
  });
});

describe("GitHub-only features are named, never evaluated as empty", () => {
  it("a secret is GitHub-only", () => {
    expect(() => substitute("${{ secrets.TOKEN }}", { stepOutputs: {} })).toThrow(GitHubOnly);
    expect(() => substitute("${{ github.token }}", { stepOutputs: {} })).toThrow(GitHubOnly);
  });

  it("a job whose step uses a secret is reported GitHub-only", () => {
    const [workflow] = loadWorkflows(workflowsWith({ "ci.yml": CI.replace("echo hi", "echo ${{ secrets.TOKEN }}") }));
    const reason = githubOnlyReason(workflow.jobs[0], { workspace: "/w", runnerTemp: "/t", sha: "0", runId: "1" });
    expect(reason?.full).toMatch(/repository secret/);
  });
});

describe("path filters follow GitHub", () => {
  it("matches `*` within a folder, `**` across folders and `?` for one character", () => {
    expect(globToRegExp("packages/fleet-runner/**").test("packages/fleet-runner/src/a/b.ts")).toBe(true);
    expect(globToRegExp("packages/*/x.ts").test("packages/a/b/x.ts")).toBe(false);
    expect(globToRegExp(".claude/skills/frame-standup/scripts/*.js").test(".claude/skills/frame-standup/scripts/a.js")).toBe(true);
    expect(globToRegExp("a?c").test("abc")).toBe(true);
    expect(globToRegExp("package.json").test("packageXjson")).toBe(false);
  });

  it("runs a path-filtered workflow only when a changed file matches", () => {
    const northstar = loadWorkflows(realWorkflows).find((w) => w.stem === "northstar-lint");
    expect(pathFilterMatches(northstar, ["decisions/northstar/x.md"])).toBe(true);
    expect(pathFilterMatches(northstar, ["packages/fleet-runner/src/a.ts"])).toBe(false);
    const ci = loadWorkflows(realWorkflows).find((w) => w.stem === "ci");
    expect(pathFilterMatches(ci, [])).toBe(true);
  });

  it("applies `!` patterns in order", () => {
    const workflow = { paths: ["src/**", "!src/docs/**"], pathsIgnore: null };
    expect(pathFilterMatches(workflow, ["src/a.ts"])).toBe(true);
    expect(pathFilterMatches(workflow, ["src/docs/a.md"])).toBe(false);
  });
});

describe("conditions are evaluated as a pull request", () => {
  it("skips a push-to-main-only step and runs always()", () => {
    expect(stepCondition("${{ github.event_name != 'pull_request' && github.ref == 'refs/heads/main' }}", { succeeded: true })).toBe(false);
    expect(stepCondition("github.event_name == 'pull_request'", { succeeded: true })).toBe(true);
    expect(stepCondition("always()", { succeeded: false })).toBe(true);
    expect(stepCondition(undefined, { succeeded: false })).toBe(false);
  });

  it("refuses a condition it cannot read", () => {
    expect(() => stepCondition("contains(github.ref, 'x')", { succeeded: true })).toThrow(/cannot evaluate/);
  });
});

describe("the command line", () => {
  const verify = (env, ...argv) =>
    spawnSync(process.execPath, [join(repoRoot, "scripts/verify.mjs"), ...argv], { encoding: "utf8", env: { ...process.env, ...env } });

  it("--list names every pull_request job as workflow/job", () => {
    const { stdout, status } = verify({}, "--list");
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toContain("ci/build-test");
    expect(JSON.parse(stdout)).toContain("fleet-runner-release/release-image");
  });

  it("--check passes on the real workflows", () => {
    expect(verify({}, "--check").status).toBe(0);
  });

  it("--check fails and names a key it does not understand", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("    steps:", "    needs: other\n    steps:") });
    const result = verify({ CORE_VERIFY_WORKFLOWS: dir }, "--check");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('the key "needs" is not one verify understands');
  });

  it("refuses to run when a workflow has drifted", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("    steps:", "    needs: other\n    steps:") });
    const result = verify({ CORE_VERIFY_WORKFLOWS: dir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("disagree");
  });

  it("rejects an unknown job and an unknown option", () => {
    expect(verify({}, "--job", "nope").status).toBe(2);
    expect(verify({}, "--bogus").status).toBe(2);
  });
});
