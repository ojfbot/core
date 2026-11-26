import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  HAND_NAME,
  dockerLog,
  journal,
  opDir,
  reality,
} from "./fakes/promote-harness.js";
import { GIT_ID, headRev, lastOp, ops, promote, setup, sh, staged, useMacSandboxes, yes } from "./fakes/mac-harness.js";

// fleet-promote.sh end to end, without a server or a real engine. EVERYTHING HERE IS SYNTHETIC: the
// keys, certificates, revisions, folders, addresses and jobs are made by the test and mean nothing
// outside it. The real scripts run from a sandbox git repo (with its own origin); `ssh` runs the
// "server" side locally, under dash, in a sandbox folder; the engine is fake-docker.mjs; and every
// "container" is a real fleet-runner server over TLS from the built package, so the signed status
// calls and the certificate fingerprint are the real ones.
// (The sandbox is in fakes/mac-harness.ts. Here: the refusals before anything changes, which take
// seconds and run with `pnpm test`. The end-to-end runs, which sit through real waits, are in
// fleet-promote-mac.slow_test.ts, and the sweep that kills the Mac at every call it makes is in
// fleet-promote-mac.sweep_test.ts; CI runs those when a change touches fleet-runner.)
vi.setConfig({ testTimeout: 400_000 });
useMacSandboxes();

describe("fleet-promote.sh refuses before anything changes", () => {
  it("without the owner's yes, with a yes that does not name the revision, or that names another commit; a dated sentence is fine", async () => {
    const e = await setup();
    const head = headRev(e);
    const [a] = e.revs as [string];
    const none = promote(e, [head]);
    expect(none.status).toBe(3);
    expect(none.out).toContain("needs the owner's yes");
    expect(promote(e, [head, "--owner-approved", "   "]).status).toBe(3);
    const vague = promote(e, [head, "--owner-approved", "Yes, go ahead"]);
    expect(vague.out).toContain("must name the revision it approves");
    const other = promote(e, [head, "--owner-approved", `Yes, promote ${a.slice(0, 7)}`]);
    expect(other.out).toMatch(/the approval names [0-9a-f]{7}, which is [0-9a-f]{12}, not/);
    // A branch named like a short commit ID must not redirect the promote.
    sh(e.repo, "git", ["branch", a.slice(0, 7), head]);
    const redirected = promote(e, [a.slice(0, 7), "--owner-approved", `Yes, promote ${a.slice(0, 7)}`]);
    expect(redirected.out).toMatch(/does not start with it|unknown commit|must be a commit ID|refname .* is ambiguous/);
    expect(redirected.status).not.toBe(0);
    for (const r of [none, vague, other, redirected]) expect(r.out).not.toMatch(/^PASS run /m);
    expect(ops(e)).toEqual([]);
    expect(dockerLog(e.box)).toEqual([]);
    // A hex-looking word that names no commit (a date) is ignored: this approval passes the gate
    // and the run is refused later only because the checkout is not clean.
    writeFileSync(join(e.repo, "untracked.txt"), "x");
    const dated = promote(e, [head, "--owner-approved", `Yes, promote ${head.slice(0, 9)} on 20261125, feedback welcome`]);
    expect(dated.out).toContain("this checkout has uncommitted changes");
  });

  it("a revision that is not staged, has no receipt on this Mac, or whose server release is not the one this Mac verified", async () => {
    const e = await setup();
    const head = headRev(e);
    writeFileSync(join(e.stageDeploy, "stage-state"), `last_passed=${head}\nstaged_ok=\n`);
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("is not staged");
    staged(e, head, false);
    rmSync(join(dirname(e.conf), "receipts", `${head}.receipt`));
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("this Mac has no receipt");
    staged(e, head);
    writeFileSync(join(e.stageDeploy, "releases", head, "release.json"), "{}\n");
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("is not the one this Mac verified");
    expect(ops(e)).toEqual([]);
    expect(reality(e.box).running.map((c) => c.name)).toEqual([HAND_NAME]);
  });

  it("a Compose file that drops the hardening: refused by the allowlist on this Mac, before the decider is started", async () => {
    const e = await setup();
    const f = join(e.repo, "packages/fleet-runner/deploy/compose.production.yaml");
    writeFileSync(f, readFileSync(f, "utf8").replace("read_only: true", "read_only: false\n    privileged: true"));
    sh(e.repo, "git", ["commit", "-q", "-am", "a weaker compose file"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const head = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, head);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    expect(r.out).toContain("is not production's allowlisted shape; nothing was changed");
    expect(r.status).toBe(1);
    expect(journal(e.box, lastOp(e))).toEqual([]);
    expect(reality(e.box).running.map((c) => c.name)).toEqual([HAND_NAME]);
    // The decider of that run was never started: its folder holds no plan and no journal.
    expect(existsSync(join(opDir(e.box, lastOp(e)), "plan"))).toBe(false);
  });

  it("an impossible bound is refused here, with the decider's own arithmetic, before a plan is uploaded", async () => {
    const e = await setup();
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head)], { FLEET_B_EVIDENCE: "20" });
    expect(r.out).toContain("REFUSED b_evidence must be at least 60 seconds");
    expect(r.out).toContain("the bounds are not possible; nothing was changed");
    expect(existsSync(join(opDir(e.box, lastOp(e)), "plan"))).toBe(false);
  });
});
