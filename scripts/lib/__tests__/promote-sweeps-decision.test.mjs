import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// scripts/fleet-runner/promote-sweeps-decision.sh decides whether a CI run needs the FleetRunner
// promote's kill sweeps. Everything here is a throwaway git repository made by the test.
const SCRIPT = fileURLToPath(new URL("../../fleet-runner/promote-sweeps-decision.sh", import.meta.url));
const ID = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" };
const made = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A repository with a main, an origin/main at the same commit, and a branch that changes <files>. */
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "promote-sweeps-decision-"));
  made.push(dir);
  const git = (...a) => execFileSync("git", a, { cwd: dir, env: { ...process.env, ...ID }, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "base\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", base);
  git("checkout", "-q", "-b", "work");
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), "changed\n");
  }
  if (files.length) {
    git("add", "-A");
    git("commit", "-q", "-m", "change");
  }
  return { dir, base, git };
}
function decide(dir, env) {
  const out = join(dir, ".github-output");
  writeFileSync(out, "");
  const r = spawnSync("bash", [SCRIPT], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH, GITHUB_OUTPUT: out, ...env } });
  return { status: r.status, said: r.stdout.trim(), output: readFileSync(out, "utf8").trim() };
}
const pr = { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge", GITHUB_BASE_REF: "main" };
const push = { GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/work" };

describe("promote-sweeps-decision.sh", () => {
  it("skips, and says so, when no promote path changed (a pull request and a branch push)", () => {
    const r = repo(["docs/notes.md", "packages/fleet-runner/src/jobs.ts", "packages/other/scripts/x.sh", "scripts/roadmap-lint.mjs"]);
    for (const env of [pr, push]) {
      const d = decide(r.dir, env);
      expect(d).toEqual({ status: 0, said: "promote sweeps: skip, no promote path changed", output: "run=false" });
    }
  });

  it("runs, naming the path, when the change touches any path the sweeps depend on", () => {
    for (const file of [
      "packages/fleet-runner/scripts/fleet-promote-decider.sh",
      "packages/fleet-runner/scripts/lib/fleet-stage-lib.sh",
      "packages/fleet-runner/deploy/compose.production.yaml",
      "packages/fleet-runner/src/__tests__/fleet-promote-decider.sweep_test.ts",
      "packages/fleet-runner/src/__tests__/fakes/fake-docker.mjs",
      ".github/workflows/ci.yml",
      "vitest.config.ts",
      "vitest.promote-sweeps.config.ts",
      "packages/fleet-runner/vitest.config.ts",
      "package.json",
      "pnpm-lock.yaml",
      "packages/fleet-runner/package.json",
      ".nvmrc",
      "scripts/fleet-runner/promote-sweeps-decision.sh",
      "scripts/check-test-wiring.mjs",
    ]) {
      const r = repo(["docs/notes.md", file]);
      for (const env of [pr, push]) {
        const d = decide(r.dir, env);
        expect(d, file).toEqual({ status: 0, said: `promote sweeps: run, because ${file} changed`, output: "run=true" });
      }
    }
  });

  it("always runs on a push to main, whatever changed", () => {
    const r = repo(["docs/notes.md"]);
    const d = decide(r.dir, { GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" });
    expect(d).toEqual({ status: 0, said: "promote sweeps: run, because this is a push to main", output: "run=true" });
  });

  it("never skips on an error: an unknown or missing base branch, no origin/main, or no repository runs the sweeps", () => {
    const r = repo(["docs/notes.md"]);
    for (const env of [
      { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge" },
      { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge", GITHUB_BASE_REF: "no-such-branch" },
      { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge", GITHUB_BASE_REF: "--upload-pack=x" },
      { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge", GITHUB_BASE_REF: "main; echo run=false" },
    ]) {
      const d = decide(r.dir, env);
      expect(d.status).toBe(0);
      expect(d.said).toMatch(/^promote sweeps: run, because /);
      expect(d.output).toBe("run=true");
    }
    r.git("update-ref", "-d", "refs/remotes/origin/main");
    const noMain = decide(r.dir, push);
    expect(noMain.said).toBe("promote sweeps: run, because this change could not be compared with origin/main");
    expect(noMain.output).toBe("run=true");
    expect(decide(r.dir, pr).output).toBe("run=true");
    const nowhere = mkdtempSync(join(tmpdir(), "promote-sweeps-decision-"));
    made.push(nowhere);
    const d = decide(nowhere, push);
    expect(d.said).toMatch(/^promote sweeps: run, because /);
    expect(d.output).toBe("run=true");
  });

  it("a pull request is compared with its own base branch, not with main", () => {
    // The base branch already holds a promote change; the pull request adds only a note.
    const r = repo(["packages/fleet-runner/scripts/fleet-promote.sh"]);
    r.git("update-ref", "refs/remotes/origin/release", r.git("rev-parse", "HEAD"));
    writeFileSync(join(r.dir, "NOTE.md"), "note\n");
    r.git("add", "-A");
    r.git("commit", "-q", "-m", "note");
    expect(decide(r.dir, { ...pr, GITHUB_BASE_REF: "release" }).said).toBe("promote sweeps: skip, no promote path changed");
    expect(decide(r.dir, pr).said).toBe("promote sweeps: run, because packages/fleet-runner/scripts/fleet-promote.sh changed");
  });

  it("an event that is neither a pull request nor a push to main is compared with origin/main", () => {
    const quiet = repo(["docs/notes.md"]);
    expect(decide(quiet.dir, { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/work" }).output).toBe("run=false");
    const loud = repo(["packages/fleet-runner/deploy/compose.yaml"]);
    expect(decide(loud.dir, { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/work" }).output).toBe("run=true");
  });
});
