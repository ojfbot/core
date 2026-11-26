// Drift tests for `pnpm verify` (ojfbot/core#650): the real workflow files must be fully understood by
// scripts/lib/verify-ci.mjs, and a key, action or job it does not know must be reported by name.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  GitHubOnly,
  JOB_NEEDS,
  OPT_IN_JOBS,
  assertRemovable,
  buildNativeEnv,
  checkPlan,
  checkoutDestination,
  describeHostMismatch,
  expectedLocalSkip,
  githubOnlyReason,
  globToRegExp,
  loadWorkflows,
  outOfScope,
  pathFilterMatches,
  redactText,
  runnerFor,
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

  it("reads an earlier step's output: what the step wrote, nothing if it wrote none, and refuses a step the job does not have", () => {
    const condition = "steps.promote_sweeps.outputs.run != 'false'";
    const knownSteps = new Set(["promote_sweeps"]);
    expect(stepCondition(condition, { succeeded: true, knownSteps, stepOutputs: { promote_sweeps: { run: "false" } } })).toBe(false);
    expect(stepCondition(condition, { succeeded: true, knownSteps, stepOutputs: { promote_sweeps: { run: "true" } } })).toBe(true);
    // No output at all (the step wrote nothing): GitHub compares the empty text, and so the step runs.
    expect(stepCondition(condition, { succeeded: true, knownSteps, stepOutputs: {} })).toBe(true);
    expect(stepCondition(condition, { succeeded: true, knownSteps, stepOutputs: { promote_sweeps: {} } })).toBe(true);
    expect(stepCondition("steps.promote_sweeps.outputs.run == 'true' && github.event_name == 'pull_request'", { succeeded: true, knownSteps, stepOutputs: { promote_sweeps: { run: "true" } } })).toBe(true);
    expect(() => stepCondition("steps.other.outputs.run != 'false'", { succeeded: true, knownSteps })).toThrow(/cannot evaluate/);
    expect(() => stepCondition(condition, { succeeded: true })).toThrow(/cannot evaluate/);
  });

  it("the promote sweeps' step, skipped by its condition, is a skip GitHub makes too, with its reason", () => {
    const step = { run: "pnpm exec vitest run --config vitest.promote-sweeps.config.ts", if: "steps.promote_sweeps.outputs.run != 'false'" };
    expect(expectedLocalSkip("ci/build-test", step)).toMatch(/kill sweeps and slow tests run only when the change touches fleet-runner/);
    expect(expectedLocalSkip("ci/build-test", { ...step, if: "steps.promote_sweeps.outputs.run == 'true'" })).toBeNull();
    expect(expectedLocalSkip("ci/other", step)).toBeNull();
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

describe("verify never deletes the repository", () => {
  const roots = { repoRoot: "/work/core", stateRoot: "/tmp/core-verify/abc" };

  it("refuses the repository, anything above it and anything inside it except a package's dist", () => {
    for (const target of ["/work/core", "/work/core/", "/work", "/", "/work/core/.git", "/work/core/src", "/work/core/packages/a", "/work/core/packages/a/src/dist", "/work/core/packages/a/dist/x"]) {
      expect(() => assertRemovable(target, roots), target).toThrow(/refuses/);
    }
  });

  it("refuses paths outside its own folder and the state folder itself", () => {
    expect(() => assertRemovable("/Users/someone", roots)).toThrow(/refuses/);
    expect(() => assertRemovable("/tmp/core-verify/abc", roots)).toThrow(/refuses/);
  });

  it("allows what it made: folders under its state folder and packages/<name>/dist", () => {
    expect(assertRemovable("/tmp/core-verify/abc/runner-temp-ci", roots)).toBe("/tmp/core-verify/abc/runner-temp-ci");
    expect(assertRemovable("/work/core/packages/fleet-runner/dist", roots)).toBe("/work/core/packages/fleet-runner/dist");
  });

  it("refuses a state folder that is the repository or contains it", () => {
    expect(() => assertRemovable("/work/core/x", { repoRoot: "/work/core", stateRoot: "/work" })).toThrow(/refuses/);
  });
});

describe("a checkout of another ref never lands on the repository", () => {
  it("is refused on this machine (--native, --quick), with or without a path", () => {
    expect(() => checkoutDestination({ base: "/work/core", path: undefined, native: true })).toThrow(/overwrite the repository/);
    expect(() => checkoutDestination({ base: "/work/core", path: "ref", native: true })).toThrow(/overwrite the repository/);
  });

  it("in the runner stays inside the container's workspace", () => {
    expect(checkoutDestination({ base: "/home/runner/work/x/ws", path: "python-reference", native: false })).toBe("/home/runner/work/x/ws/python-reference");
    expect(() => checkoutDestination({ base: "/home/runner/work/x/ws", path: "../../..", native: false })).toThrow(/leaves the workspace/);
    expect(() => checkoutDestination({ base: "/home/runner/work/x/ws", path: "/etc", native: false })).toThrow(/leaves the workspace/);
    expect(() => checkoutDestination({ base: "/home/runner/work/x/ws", path: ".git/hooks", native: false })).toThrow(/\.git/);
  });
});

describe("a job on this machine gets an allowlisted environment", () => {
  const parent = {
    PATH: "/usr/bin",
    HOME: "/Users/someone",
    LANG: "en_US.UTF-8",
    OPENAI_API_KEY: "probe-openai",
    AWS_SECRET_ACCESS_KEY: "probe-aws",
    ANTHROPIC_API_KEY: "probe-anthropic",
    SSH_AUTH_SOCK: "/tmp/agent.sock",
    GITHUB_TOKEN: "probe-gh",
    npm_config_x: "1",
  };
  const { env, dropped } = buildNativeEnv(parent, { home: "/scratch/home", tmp: "/scratch/tmp", path: "/clean/bin" });

  it("passes no credential, token or agent socket from the shell", () => {
    const text = JSON.stringify(env);
    for (const probe of ["probe-openai", "probe-aws", "probe-anthropic", "probe-gh", "agent.sock", "/Users/someone"]) expect(text).not.toContain(probe);
    expect(dropped).toBeGreaterThanOrEqual(6);
  });

  it("passes only PATH, a scratch HOME and TMPDIR, the locale and the CI markers", () => {
    expect(Object.keys(env).sort()).toEqual(["CI", "GITHUB_ACTIONS", "HOME", "LANG", "LOGNAME", "NO_COLOR", "PATH", "TMPDIR", "USER"]);
    expect(env.HOME).toBe("/scratch/home");
    expect(env.PATH).toBe("/clean/bin");
  });
});

describe("printed and logged text carries no machine path", () => {
  const where = { repoRoot: "/Users/someone/code/core", home: "/Users/someone", tmp: "/var/folders/ab/cd/T/" };

  it("replaces the repository, the home folder and the temp folder", () => {
    const text = redactText("at /Users/someone/code/core/src/a.ts and /Users/someone/.cache/x and /var/folders/ab/cd/T/core-verify/logs", where);
    expect(text).toBe("at <repo>/src/a.ts and ~/.cache/x and $TMPDIR/core-verify/logs");
  });

  it("replaces any other user's home, but keeps the runner's", () => {
    expect(redactText("/Users/other/x /home/other/y /home/runner/work/z", where)).toBe("~/x ~/y /home/runner/work/z");
  });

  it("replaces extra roots such as the runner's workspace", () => {
    expect(redactText("/home/runner/work/ab12/ws/a.ts", { ...where, extra: [["/home/runner/work/ab12", "<runner>"]] })).toBe("<runner>/ws/a.ts");
  });
});

describe("opt-in jobs", () => {
  it("names a job that exists and gives a reason", () => {
    const keys = loadWorkflows(realWorkflows).flatMap((w) => w.jobs.map((j) => j.key));
    for (const [key, reason] of Object.entries(OPT_IN_JOBS)) {
      expect(keys).toContain(key);
      expect(reason.length).toBeGreaterThan(20);
    }
    expect(Object.keys(OPT_IN_JOBS)).toContain("fleet-runner-release/release-image");
  });

  it("is reported when the list names a job that is not there", () => {
    const dir = workflowsWith({ "ci.yml": CI });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('lists "fleet-runner-release/release-image" as opt-in');
  });
});

describe("a workflow-level secret is GitHub-only, not a crash", () => {
  it("is found in the top-level env as well as the job's", () => {
    const [workflow] = loadWorkflows(workflowsWith({ "ci.yml": `${CI}env:\n  TOKEN: \${{ secrets.MY_TOKEN }}\n` }));
    const reason = githubOnlyReason(workflow.jobs[0], { workspace: "/w", runnerTemp: "/t", sha: "0", runId: "1" });
    expect(reason?.full).toMatch(/repository secret/);
  });
});

describe("runs-on names the machine", () => {
  const job = (runsOn) => ({ runsOn });

  it("maps ubuntu labels to the release they name, with ubuntu-latest as GitHub resolves it", () => {
    expect(runnerFor(job("ubuntu-latest")).ubuntu).toBe("26.04");
    expect(runnerFor(job("ubuntu-24.04")).ubuntu).toBe("24.04");
    expect(runnerFor(job("ubuntu-22.04")).ubuntu).toBe("22.04");
  });

  it("marks Windows and macOS labels as another operating system", () => {
    expect(runnerFor(job("windows-latest")).otherOs).toBe("windows-latest");
    expect(runnerFor(job("macos-14")).otherOs).toBe("macos-14");
  });

  it("does not know self-hosted, matrix or list labels, and --check names them", () => {
    expect(runnerFor(job("self-hosted"))).toBeNull();
    expect(runnerFor(job(["ubuntu-latest"]))).toBeNull();
    const dir = workflowsWith({ "ci.yml": CI.replace("ubuntu-latest", "self-hosted") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain('runs-on "self-hosted" is not one verify knows');
  });

  it("a job with no runs-on is reported", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("    runs-on: ubuntu-latest\n", "") });
    expect(checkPlan(loadWorkflows(dir)).join("\n")).toContain("has no runs-on");
  });
});

describe("service containers are refused by name until they work as on GitHub", () => {
  it("--check reports the key", () => {
    const dir = workflowsWith({ "ci.yml": CI.replace("    steps:", "    services:\n      db:\n        image: postgres:17\n        ports: [5432]\n    steps:") });
    const problems = checkPlan(loadWorkflows(dir)).join("\n");
    expect(problems).toContain('the key "services" is not one verify understands');
    expect(problems).toContain("not supported yet");
  });
});

describe("a doctored copy of the real workflows, run on this machine", () => {
  /** The real workflow files with one edit, so every job still has its JOB_NEEDS entry. */
  function doctored(edit) {
    const dir = mkdtempSync(join(tmpdir(), "verify-doctored-"));
    dirs.push(dir);
    cpSync(realWorkflows, dir, { recursive: true });
    const file = join(dir, "ci.yml");
    writeFileSync(file, edit(readFileSync(file, "utf8")));
    return dir;
  }
  const verifyNative = (dir) =>
    spawnSync(process.execPath, [join(repoRoot, "scripts/verify.mjs"), "--native", "--job", "ci/check-provenance"], {
      encoding: "utf8",
      env: { ...process.env, CORE_VERIFY_WORKFLOWS: dir, CORE_VERIFY_DIR: mkdtempSync(join(tmpdir(), "verify-state-")) },
    });

  it("reports a top-level secret as SKIPPED with the reason: no stack trace, no path, a summary, exit 0", () => {
    const dir = doctored((text) => text.replace("jobs:", "env:\n  TOKEN: ${{ secrets.MY_TOKEN }}\n\njobs:"));
    const result = verifyNative(dir);
    const output = result.stdout + result.stderr;
    expect(result.status).toBe(0);
    expect(output).toMatch(/SKIPPED\s+ci\/check-provenance\s+needs GitHub, uses a repository secret/);
    expect(output).toContain("verify summary");
    expect(output).not.toMatch(/node:internal|\n\s+at /);
    expect(output).not.toContain(repoRoot);
  });

  it("reports a Windows job as SKIPPED, not run in the Ubuntu container", () => {
    const dir = doctored((text) => text.replace(/(check-provenance:[\s\S]*?runs-on: )ubuntu-latest/, "$1windows-latest"));
    const result = verifyNative(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/SKIPPED\s+ci\/check-provenance\s+needs windows-latest/);
  });

  it("reports every selected job and still prints the summary", () => {
    // Both jobs are SKIPPED before anything runs: a native run deletes packages/*/dist, which the
    // tests that are running this one need.
    const dir = doctored((text) => text.replace(/runs-on: ubuntu-latest/g, "runs-on: windows-latest"));
    const result = spawnSync(process.execPath, [join(repoRoot, "scripts/verify.mjs"), "--native", "--job", "ci/check-provenance", "--job", "ci/build-test"], {
      encoding: "utf8",
      env: { ...process.env, CORE_VERIFY_WORKFLOWS: dir, CORE_VERIFY_DIR: mkdtempSync(join(tmpdir(), "verify-state-")) },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/SKIPPED\s+ci\/build-test/);
    expect(result.stdout).toMatch(/SKIPPED\s+ci\/check-provenance/);
    expect(result.stdout).toContain("verify summary");
  });
});

describe("a native run says how the machine differs from the job's runs-on image", () => {
  const target = { label: "ubuntu-latest", ubuntu: "26.04" };

  it("flags an older Ubuntu host (it could pass what GitHub's image fails)", () => {
    const message = describeHostMismatch(target, { platform: "linux", osId: "ubuntu", osVersion: "22.04", python: "3.10.12" });
    expect(message).toContain("ubuntu 22.04");
    expect(message).toContain("runs-on: ubuntu-latest is Ubuntu 26.04");
    expect(message).toContain("python3 is 3.10.12");
  });

  it("flags macOS and a non-Ubuntu Linux", () => {
    expect(describeHostMismatch(target, { platform: "darwin", osId: "", osVersion: "", python: "3.13.1" })).toContain("on macOS");
    expect(describeHostMismatch(target, { platform: "linux", osId: "fedora", osVersion: "41", python: "3.13.1" })).toContain("fedora 41");
  });

  it("flags a matching release with a different Python, where the image's Python is known", () => {
    const t = { label: "ubuntu-24.04", ubuntu: "24.04" };
    expect(describeHostMismatch(t, { platform: "linux", osId: "ubuntu", osVersion: "24.04", python: "3.11.4" })).toContain("that image's is 3.12.x");
    expect(describeHostMismatch(t, { platform: "linux", osId: "ubuntu", osVersion: "24.04", python: "3.12.3" })).toBeNull();
  });

  it("says nothing only for the same release (Python not recorded for 26.04)", () => {
    expect(describeHostMismatch(target, { platform: "linux", osId: "ubuntu", osVersion: "26.04", python: "3.14.0" })).toBeNull();
  });
});

describe("every host uses the runner container by default", () => {
  it("a job without Docker is SKIPPED, never run natively (on Linux too)", () => {
    const result = spawnSync(process.execPath, [join(repoRoot, "scripts/verify.mjs"), "--job", "ci/check-provenance"], {
      encoding: "utf8",
      env: { ...process.env, DOCKER_HOST: "unix:///nonexistent.sock", CORE_VERIFY_DIR: mkdtempSync(join(tmpdir(), "verify-state-")) },
    });
    const output = result.stdout + result.stderr;
    expect(result.status, output).toBe(2);
    expect(output).toMatch(/SKIPPED\s+ci\/check-provenance\s+Docker not running/);
  });
});
