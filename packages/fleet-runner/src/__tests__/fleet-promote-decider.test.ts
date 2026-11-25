import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Box,
  DASH,
  DECIDER,
  GUARD,
  HAND_NAME,
  PROJECT,
  TLS,
  alive,
  completeLines,
  containers,
  decider,
  deciderAsync,
  destroyBox,
  destroyBoxAsync,
  docker,
  dockerLog,
  dropImageName,
  field,
  imageId,
  jobsIn,
  journal,
  lockIsFree,
  makeBox,
  newOp,
  opDir,
  perlCount,
  planSha,
  playMac,
  putFile,
  readOut,
  reality,
  record,
  records,
  revOf,
  run,
  setFaults,
  setPerlFaults,
  sha,
  sleep,
  startDecider,
  states,
} from "./fakes/promote-harness.js";

// The promote's server-side decider (fleet-promote-decider.sh) against the fake engine, under dash.
// EVERYTHING HERE IS SYNTHETIC: folders, revisions, image IDs, keys and jobs mean nothing outside
// this file. No server and no real engine are involved.
vi.setConfig({ testTimeout: 1_800_000 });
// The sweeps below run many sandboxes at once; each is its own folders, engine state and processes.
const POOL = Math.max(2, Math.min(8, availableParallelism() - 1));
const CHANGING = /^(stop|start|rm|run|compose .* up)\b/;
const OLD_IMAGE = `sha256:${"0".repeat(63)}1`;
const HAND = { image: OLD_IMAGE, name: HAND_NAME };
const LINE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ [a-z-]+( \S+=\S*)*$/;
const boxes: Box[] = [];
const box = (opts = {}) => {
  const b = makeBox(opts);
  boxes.push(b);
  return b;
};
afterEach(() => {
  for (const b of boxes.splice(0)) destroyBox(b);
});

/** Engine calls that disrupt production, from line <from> of the fake's log on: a stop, a start, a removal, a Compose up, or a helper that may write. */
const disruptive = (b: Box, from = 0) =>
  dockerLog(b)
    .slice(from)
    .filter((l) => /^(stop|start|rm|compose .* up)\b/.test(l) || (/^run\b/.test(l) && !l.includes(":ro ")));
/** Run fn over items, <limit> at a time. Every item is run to its end before the first error is thrown, so nothing is left running behind a failed test. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = items.slice();
  const errors: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        try {
          await fn(item);
        } catch (e) {
          errors.push(e);
        }
      }
    }),
  );
  if (errors.length) throw errors[0];
}
/** A first promote that passes: production is then the Compose run this returns. */
async function passed(b: Box, rev = revOf(1)) {
  const op = newOp(b, { rev });
  const r = await run(b, op);
  if (r.status !== 0) throw new Error(`the setup promote did not pass: ${r.out}`);
  return op;
}
const nextPlan = (b: Box, prev: string, rev: string) => ({ rev, kind: "compose" as const, prevOp: prev, prevCfg: field(b, prev, "verified", "cfg") });

/**
 * THE invariant after any interruption and recover: production is exactly one of
 *  - the new revision, with a committed record, or
 *  - the previous production, with an undo record,
 * and the record matches what the engine and the folders show. Returns what is wrong, if anything.
 * An operation that halted has no terminal outcome and so never satisfies it.
 */
function wrong(b: Box, op: string, prev: { image: string; name?: string }, newImage: string): string[] {
  const bad: string[] = [];
  const st = states(b, op);
  const outcome = field(b, op, "done", "outcome");
  const now = reality(b);
  const mine = records(b).filter((f) => f.endsWith(`-${op}.txt`));
  if (!["pass", "undone", "unchanged"].includes(outcome)) bad.push(`no terminal outcome (journal ends: ${st.slice(-2).join(",")})`);
  if (mine.length !== 1) bad.push(`records of this run: ${mine.join(",") || "none"}`);
  if (now.helpers !== 0) bad.push(`${now.helpers} helper container(s) left`);
  if (!lockIsFree(b)) bad.push("the lock is still held");
  if (now.running.length !== 1) bad.push(`${now.running.length} containers run`);
  for (const l of completeLines(b, op)) if (!LINE.test(l)) bad.push(`a malformed journal line: ${l.slice(0, 60)}`);
  if (outcome === "pass") {
    if (!st.includes("committed")) bad.push("pass without a committed line");
    if (mine[0] !== `promote-${op}.txt`) bad.push("pass without its record");
    if (now.running[0]?.image !== newImage) bad.push("pass, but the new revision does not run");
  } else if (outcome === "undone" || outcome === "unchanged") {
    if (st.includes("committed")) bad.push(`${outcome} after a committed line`);
    if (mine[0] !== `undo-${op}.txt`) bad.push(`${outcome} without its record`);
    if (now.running[0]?.image !== prev.image) bad.push(`${outcome}, but the previous production does not run`);
    if (prev.name && now.running[0]?.name !== prev.name) bad.push(`${outcome}, but what runs is not the previous container`);
    if (!prev.name && now.projectContainers !== 1) bad.push(`${now.projectContainers} project containers`);
    if (prev.name && now.projectContainers !== 0) bad.push(`${now.projectContainers} project containers left`);
    if (now.stateStartedBy.includes(newImage)) bad.push("the state folder is the one the new revision ran on");
    if (now.jobs !== 3) bad.push(`the state folder holds ${now.jobs} jobs, not the 3 it had`);
    if (st.includes("starting") && outcome === "undone") {
      if (!now.stateFolders.includes(`state.failed-${op}`)) bad.push("the new revision may have started, but its state was not set aside");
      if (now.stateFolders.includes(`state.pre-${op}`)) bad.push("the snapshot was not put back");
    } else if (now.stateFolders.includes(`state.failed-${op}`)) bad.push("a state folder was set aside though the new revision never started");
  }
  return bad;
}
/** Kill the decider and everything of the run still alive: its bound helpers and its steps. */
function killAll(b: Box, op: string, pid: number) {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, "SIGKILL");
    } catch {}
  }
  const g = join(opDir(b, op), "groups");
  if (existsSync(g)) {
    for (const row of readFileSync(g, "utf8").split("\n")) {
      const pgid = Number(row.split(" ")[0]);
      if (pgid > 1) {
        try {
          process.kill(-pgid, "SIGKILL");
        } catch {}
      }
    }
  }
}
/** recover until it no longer halts (a late engine effect may make one attempt halt), at most 4 times. */
async function recoverUntilDone(b: Box, op: string) {
  let last = { status: 0 as number | null, out: "" };
  const all: string[] = [];
  for (let i = 0; i < 4; i++) {
    last = await deciderAsync(b, op, "recover");
    all.push(last.out);
    if (last.status !== 4 && last.status !== 75) break;
    await sleep(1500);
  }
  return { ...last, all: all.join("\n---\n") };
}
/** Start a run, let it get to <state>, and kill it there with everything it started. */
async function killedAt(b: Box, op: string, state: string) {
  const s = startDecider(b, op, "run");
  await playMac(b, op, { vanish: (st) => st.includes(state) }, () => false);
  killAll(b, op, s.pid);
  await s.done;
}

describe("the decider: a promote that passes", () => {
  it("first cutover: stops the hand-started container, snapshots, starts the checked config, waits for evidence, commits", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const r = await run(b, op);
    expect(r.out).toContain(`PASS production runs ${rev}`);
    expect(r.status).toBe(0);
    expect(states(b, op)).toEqual(["begun", "go", "verified", "spent", "stopped", "snapshot", "starting", "started", "server-checked", "evidence", "committed", "done"]);
    const now = reality(b);
    expect(now.running).toHaveLength(1);
    expect(now.running[0]?.image).toBe(imageId(rev));
    expect(now.stateFolders).toEqual(["state", `state.pre-${op}`]);
    // The hand-started container is stopped, not removed: a revert can bring it back.
    expect(containers(b).find((c) => c.name === HAND_NAME)?.status).toBe("exited");
    // Exactly the checked bytes were started.
    expect(sha(readFileSync(join(b.fake, "started", `${PROJECT}.json`)))).toBe(field(b, op, "verified", "cfg"));
    expect(records(b)).toEqual([`promote-${op}.txt`]);
    expect(record(b, `promote-${op}.txt`)).toContain(`-> ${rev}`);
    expect(record(b, `promote-${op}.txt`)).toContain(`fleet-promote.sh revert ${op} --owner-approved`);
    expect(field(b, op, "verified", "policy")).toBe("unless-stopped");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    // The snapshot carries the marker that names this run.
    expect(readFileSync(join(b.prodRoot, `state.pre-${op}`, ".fleet-promote-snapshot"), "utf8")).toBe(`op=${op}\n`);
    // Every step's process group was recorded before it ran.
    const groups = readFileSync(join(opDir(b, op), "groups"), "utf8").trim().split("\n");
    expect(groups.length).toBeGreaterThan(20);
    for (const g of groups) expect(g).toMatch(/^\d+ \S+ [a-z-]+$/);
    // Helper containers: the whole service root is only ever mounted for root; the service account
    // gets the one folder it checks and nothing else (it cannot pass through the service root, and
    // SQLite needs that folder writable to open a write-ahead-mode database, read-only as it opens it).
    const helpers = dockerLog(b).filter((l) => l.startsWith("run "));
    expect(helpers.length).toBeGreaterThan(5);
    for (const l of helpers) {
      const whole = l.includes(` -v ${b.prodRoot}:/srv`);
      if (whole) expect(l).toContain(" --user 0:0 ");
      else expect(l).toMatch(/ --user [1-9]\d*:\d+ /);
      expect(l).toContain(" --network none ");
    }
    const integrity = helpers.find((l) => l.includes(`fleet-promote-${op}-integrity`)) ?? "";
    expect(integrity).toContain(` -v ${b.prodRoot}/state.pre-${op}.part:/srv/state.pre-${op}.part `);
    expect(integrity).not.toContain(` -v ${b.prodRoot}:/srv`);
  });

  it("a later promote replaces the Compose production, carrying its own checked copy of the previous config", async () => {
    const b = box();
    const first = await passed(b);
    const rev = revOf(2);
    const op = newOp(b, nextPlan(b, first, rev));
    const r = await run(b, op);
    expect(r.out).toContain(`PASS production runs ${rev}`);
    expect(sha(readFileSync(join(opDir(b, op), "previous.json")))).toBe(field(b, first, "verified", "cfg"));
    expect(field(b, op, "verified", "prev")).toBe(first);
    expect(field(b, op, "verified", "prev_cfg")).toBe(field(b, first, "verified", "cfg"));
    expect(field(b, op, "verified", "prev_image")).toBe(imageId(revOf(1)));
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(rev)]);
    expect(reality(b).projectContainers).toBe(1);
  });

  it("prints and records nothing private: no path, no address, in the journal, the records or its output (pass and undo)", async () => {
    const b = box();
    const a = newOp(b, { rev: revOf(1) });
    await run(b, a, { evidence: "wrong-build" });
    const c = newOp(b, { rev: revOf(2) });
    await run(b, c);
    const text = [...journal(b, a), ...journal(b, c), readOut(b, a), readOut(b, c), ...records(b).map((f) => record(b, f))].join("\n");
    expect(field(b, a, "done", "outcome")).toBe("undone");
    expect(field(b, c, "done", "outcome")).toBe("pass");
    for (const secret of [b.root, tmpdir(), "127.0.0.1", "/server/", "service-root", String(b.port)]) expect(text).not.toContain(secret);
    // Engine output is in the run's own log, and holds no environment value.
    const eng = readFileSync(join(opDir(b, c), "engine.log"), "utf8") + readFileSync(join(opDir(b, a), "engine.log"), "utf8");
    expect(eng).not.toContain("FLEET_WORKERS");
    expect(eng).not.toContain("worker-a");
  });
});

describe("the decider: bounds", () => {
  const bounds = (plan?: string) => spawnSync(DASH, [DECIDER, "bounds", ...(plan ? [plan] : [])], { encoding: "utf8" });
  it("with NO bound set, the defaults add up to the documented worst case and are accepted", () => {
    const r = bounds();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("worst_case=1120 pass_path=605 silent_max=850 before=305");
    expect(r.stdout).toContain("120  wait for this Mac's evidence");
    expect(r.stdout).toContain("this Mac waits for the decider's first journal line");
    // The printed rows of the offline window and the undo are the sum.
    const all = r.stdout.split("\n");
    const rows = all.slice(all.findIndex((l) => l.includes("production offline:")));
    const sum = rows.map((l) => /^ {4}(\d+) {2}/.exec(l)?.[1]).filter(Boolean).reduce((t, n) => t + Number(n), 0);
    expect(sum).toBe(1120);
    // The documented number is this number.
    expect(readFileSync(join(DECIDER, "../../deployment.md"), "utf8")).toContain("1120 seconds");
  });

  it("a whole promote and a whole undo run with every bound left at its default", async () => {
    const b = box();
    const a = newOp(b, { rev: revOf(1), defaults: true });
    expect(readFileSync(join(opDir(b, a), "plan"), "utf8")).not.toContain("b_");
    const u = await run(b, a, { evidence: "interrupted" });
    expect(u.out).toContain("UNDONE production is back on");
    expect(field(b, a, "verified", "offline_max")).toBe("1120");
    expect(field(b, a, "server-checked", "window")).toBe("120");
    const c = newOp(b, { rev: revOf(2), defaults: true });
    const p = await run(b, c);
    expect(p.out).toContain("PASS production runs");
  });

  it("refuses an impossible setting before anything is touched", () => {
    const b = box();
    for (const [k, v, why] of [
      ["b_evidence", "30", "b_evidence must be at least 60"],
      ["b_evidence", "601", "b_evidence must be at most 600"],
      ["b_stop", "20", "b_stop must be at least 40"],
      ["b_copy", "soon", "b_copy must be a whole number"],
      ["b_start", "0", "b_start must be at least 10"],
    ] as const) {
      const op = newOp(b, { rev: revOf(1), override: { [k]: v } });
      const before = dockerLog(b).length;
      const r = decider(b, op, "run");
      expect(r.out).toContain(`REFUSED ${why}`);
      expect(r.status).toBe(1);
      expect(dockerLog(b).length).toBe(before);
      expect(journal(b, op)).toEqual([]);
      expect(bounds(join(opDir(b, op), "plan")).status).toBe(1);
    }
  });

  it("every engine call a full switch and a full undo make is in the sum: none is missing from the table", async () => {
    const b = box();
    const op = newOp(b, { rev: revOf(1) });
    await run(b, op, { evidence: "wrong-build" });
    expect(field(b, op, "done", "outcome")).toBe("undone");
    const steps = readFileSync(join(opDir(b, op), "steps.log"), "utf8").split("\n").filter(Boolean).map((l) => l.split(" ") as [string, string]);
    const from = steps.findIndex(([label]) => label === "stop-previous");
    // Waits that poll are counted by their whole bound, not by the polls a quick fake needs.
    const polls: Record<string, number> = { "new-health": 12, "undo-health": 12, "undo-recheck": 5 };
    let sum = 0;
    const seen = new Set<string>();
    for (const [label, secs] of steps.slice(from)) {
      if (label in polls) {
        if (!seen.has(label)) sum += polls[label] as number;
        seen.add(label);
      } else sum += Number(secs);
    }
    sum += 60 + 1 + 10; // the evidence window, the settle interval, the record writes
    const table = spawnSync(DASH, [DECIDER, "bounds", join(opDir(b, op), "plan")], { encoding: "utf8" }).stdout;
    const worst = Number(/worst_case=(\d+)/.exec(table)?.[1]);
    // The sum is every call plus the allowance for ending two timed-out steps (2 x 30), no more, no less.
    expect(sum).toBe(worst - 60);
  });
});

describe("the decider: refusals before production is touched", () => {
  const refused = async (b: Box, op: string, why: string | RegExp, play = {}) => {
    const before = dockerLog(b).length;
    const r = await run(b, op, play);
    expect(r.out).toMatch(why);
    expect(r.out).toContain("nothing was changed in production");
    expect(r.status).toBe(1);
    expect(field(b, op, "done", "outcome")).toBe("unchanged");
    expect(states(b, op)).not.toContain("spent");
    expect(disruptive(b, before)).toEqual([]);
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    expect(lockIsFree(b)).toBe(true);
  };

  it("a hand-started container whose restart policy would bring it back at a reboot (the owner's step, never changed here)", async () => {
    const b = box({ policy: "always" });
    await refused(b, newOp(b, { rev: revOf(1) }), /restart policy \(always\) would bring it back at a reboot.*the owner's step/);
    expect(containers(b).find((c) => c.name === HAND_NAME)?.policy).toBe("always");
  });

  it("an approval that was already used, an image that is not the receipt's, a config changed after it was checked", async () => {
    const b = box();
    const first = newOp(b, { rev: revOf(1), approval: "Yes, promote it (synthetic one)" });
    await run(b, first, { evidence: "wrong-build" });
    expect(field(b, first, "done", "outcome")).toBe("undone");
    // The same words with other spacing and case are the same yes (the Mac hashes them normalised).
    await refused(b, newOp(b, { rev: revOf(1), approval: "yes,  PROMOTE it (synthetic one)" }), /this approval was already used/);
    const img = newOp(b, { rev: revOf(2), override: { new_image: imageId("another") } });
    await refused(b, img, /not the one this Mac's receipt names/);
    const cfg = newOp(b, { rev: revOf(3) });
    writeFileSync(join(opDir(b, cfg), "resolved.json"), `${readFileSync(join(opDir(b, cfg), "resolved.json"), "utf8")} `);
    await refused(b, cfg, /is not the one that was checked/);
  });

  it("a production that is not in the form the plan says, enrolled keys that are not the plan's, a stray project container", async () => {
    const b = box();
    await refused(b, newOp(b, { rev: revOf(1), kind: "compose", prevOp: "some-run", prevCfg: "0".repeat(64), skipPrepare: true }), /the plan says production is a compose production, the journals say container/);
    await refused(b, newOp(b, { rev: revOf(1), override: { key_ids: "observer,owner" } }), /enrolled keys are not exactly the ones the plan names/);
    // A container of the project that an interrupted engine call created late and nobody started.
    const stray = newOp(b, { rev: revOf(2) });
    setFaults(b, { createOnly: { match: "up -d" } });
    spawnSync("docker", ["compose", "-p", PROJECT, "--env-file", "/dev/null", "-f", "-", "up", "-d", "--pull", "never"], {
      env: b.env,
      input: readFileSync(join(opDir(b, stray), "resolved.json")),
    });
    setFaults(b, {});
    expect(reality(b).strays).toBe(1);
    await refused(b, stray, /a container of the production project already exists/);
  });

  it("no go from the Mac: a start that arrives with nobody watching changes nothing", async () => {
    const b = box();
    const op = newOp(b, { rev: revOf(1), bounds: { b_go: 10 } });
    await refused(b, op, /the Mac's go did not arrive within 10 seconds/, { go: false });
    expect(field(b, op, "done", "reason")).toBe("no-go");
    // A go that does not answer THIS run's challenge is no go either.
    const other = newOp(b, { rev: revOf(1), bounds: { b_go: 10 } });
    const s = startDecider(b, other, "run");
    while (!states(b, other).includes("begun")) await sleep(40);
    putFile(b, other, "go", { nonce: "0".repeat(32) });
    await s.done;
    expect(field(b, other, "done", "reason")).toBe("no-go");
  });

  it("another operation is unfinished; this run already has a journal; a rehearsal outside a throwaway", async () => {
    const b = box();
    const stuckOp = newOp(b, { rev: revOf(1) });
    await killedAt(b, stuckOp, "stopped");
    const next = newOp(b, { rev: revOf(2), skipPrepare: true });
    const r = decider(b, next, "run");
    expect(r.out).toContain(`REFUSED operation ${stuckOp} is unfinished: run recover for it first`);
    expect(journal(b, next)).toEqual([]);
    // The read-only check the Mac makes before the start says the same, without the lock.
    const calls = dockerLog(b).length;
    const check = decider(b, next, "check");
    expect(check.status).toBe(1);
    expect(check.out).toContain(`REFUSED operation ${stuckOp} is unfinished: run recover for it first`);
    expect(disruptive(b, calls)).toEqual([]);
    expect(decider(b, stuckOp, "run").out).toContain("already has a journal");
    expect(decider(b, stuckOp, "recover").out).toContain("UNDONE production is back on");
    const reh = newOp(b, { rev: revOf(3), rehearsal: true });
    const rr = await run(b, reh);
    expect(rr.out).toContain("a rehearsal needs a throwaway production");
    expect(field(b, reh, "done", "outcome")).toBe("unchanged");
  });

  it("a plan for another operation, a service root inside the control folder, a control folder that was replaced by a copy", async () => {
    const b = box();
    const other = newOp(b, { rev: revOf(1), override: { op: "another-operation" } });
    expect(decider(b, other, "run").out).toContain("REFUSED the plan is for another operation");
    const inside = newOp(b, { rev: revOf(1), override: { root: join(b.ctl, "promote-runs") }, skipPrepare: true });
    expect(decider(b, inside, "run").out).toContain("REFUSED the service root is inside the control folder");
    // An earlier operation ran in a folder with another identity: this one is a copy of it.
    const first = newOp(b, { rev: revOf(1) });
    await run(b, first, { evidence: "wrong-build" });
    const j = join(opDir(b, first), "journal");
    writeFileSync(j, readFileSync(j, "utf8").replace(/ ctl=\S+/, " ctl=1:2"));
    const next = newOp(b, { rev: revOf(2) });
    const r = await run(b, next);
    expect(r.out).toContain("the control folder is not the folder earlier operations ran in");
    expect(field(b, next, "done", "outcome")).toBe("unchanged");
    // The decider only runs from promote-runs/<op> of a marked control folder: a plan cannot name another.
    expect(spawnSync(DASH, [DECIDER, "run", "some-op"], { encoding: "utf8" }).stdout).toContain("REFUSED this decider is not in promote-runs/some-op");
    expect(readFileSync(join(opDir(b, next), "plan"), "utf8")).not.toMatch(/^(ctl|control|deploy)/m);
  });

  it("check says the same refusals without the lock and without changing anything", () => {
    const b = box({ policy: "always" });
    const op = newOp(b, { rev: revOf(1) });
    const before = dockerLog(b).length;
    const r = decider(b, op, "check");
    expect(r.out).toMatch(/REFUSED the hand-started container's restart policy \(always\)/);
    expect(r.status).toBe(1);
    expect(disruptive(b, before)).toEqual([]);
    expect(journal(b, op)).toEqual([]);
    const ok = box();
    const good = newOp(ok, { rev: revOf(1) });
    const c = decider(ok, good, "check");
    expect(c.out).toContain("PASS every check the decider makes before it touches production");
    expect(c.out).toMatch(/disk: the state folder is \d+ MB, \d+ MB are free; the snapshot needs \d+ MB free/);
    expect(journal(ok, good)).toEqual([]);
  });
});

describe("the decider: it undoes, by itself, whatever fails once the yes is spent", () => {
  const undone = async (faults: Record<string, unknown>, play: Parameters<typeof run>[2], reason: string, starting: boolean) => {
    const b = makeBox();
    boxes.push(b);
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setFaults(b, faults);
    const r = await run(b, op, play);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason"), reason).toBe(reason);
    expect(r.out, reason).toContain("UNDONE production is back on the hand-started container");
    expect(r.out, reason).not.toContain("PASS");
    expect(r.status, reason).toBe(1);
    expect(states(b, op).includes("starting"), reason).toBe(starting);
    expect(wrong(b, op, HAND, imageId(rev)), reason).toEqual([]);
    return { b, op, r };
  };

  it("evidence that says the wrong build, a changed certificate, an interrupted Mac, another run, another plan", async () => {
    const cases = [
      ["wrong-build", "wrong-build"],
      ["tls-changed", "certificate-changed"],
      ["interrupted", "client-reported-failure"],
      ["other-run", "evidence-for-another-run"],
      ["other-plan", "evidence-for-another-run"],
    ] as const;
    await pool([...cases], POOL, async ([evidence, reason]) => {
      const { b, op } = await undone({}, { evidence }, reason, true);
      expect(record(b, `undo-${op}.txt`)).toContain(`reason: ${reason}`);
      expect(record(b, `undo-${op}.txt`)).toContain("jobs: the set-aside state holds 3; the snapshot held 3");
    });
  });

  it("no evidence at all: a Mac that goes silent ends in the undo when the window closes", async () => {
    const { b, op } = await undone({}, { evidence: "none" }, "no-evidence", true);
    const at = (state: string) => Date.parse(journal(b, op).find((l) => l.includes(` ${state}`))?.split(" ")[0] ?? "");
    expect(at("undoing") - at("server-checked")).toBeGreaterThanOrEqual(59_000);
    expect(at("undoing") - at("server-checked")).toBeLessThan(80_000);
  });

  it("evidence that does not answer this run's challenge is ignored, not treated as bad: the wait goes on", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // Evidence that was there before the run even began is not evidence.
    putFile(b, op, "evidence", { op, revision: rev, plan: planSha(b, op), nonce: "1".repeat(32), build: rev, tls: TLS, client: "ok" });
    const s = startDecider(b, op, "run");
    await playMac(b, op, { evidence: "no-nonce" }, () => states(b, op).includes("server-checked") && existsSync(join(opDir(b, op), "evidence")));
    await sleep(2500);
    expect(states(b, op)).not.toContain("undoing");
    expect(states(b, op)).not.toContain("committed");
    putFile(b, op, "evidence", { op, revision: rev, plan: planSha(b, op), nonce: field(b, op, "server-checked", "nonce"), build: rev, tls: TLS, client: "ok" });
    await s.done;
    expect(field(b, op, "done", "outcome")).toBe("pass");
  });

  it("a snapshot that fails its integrity check: the live state is left alone and the unverified copy is removed", async () => {
    const { b, op } = await undone({ corruptSnapshot: true }, {}, "snapshot-integrity-failed", false);
    expect(reality(b).stateFolders).toEqual(["state"]);
    expect(field(b, op, "undo-state-back", "skipped")).toBe("1");
    expect(field(b, op, "undo-state-aside", "skipped")).toBe("1");
  });

  it("a new revision that does not start, is not healthy, lost a job, or whose keys cannot be read", async () => {
    await pool(
      [
        [{ fail: { match: "up -d" } }, "start-failed"],
        [{ health: { [imageId(revOf(1))]: "unhealthy" } }, "new-not-healthy"],
        [{ dropJobs: { [imageId(revOf(1))]: 1 } }, "jobs-fewer"],
        [{ fail: { match: "exec " } }, "keys-unreadable"],
      ] as [Record<string, unknown>, string][],
      POOL,
      async ([faults, reason]) => {
        const { b, op } = await undone(faults, {}, reason, true);
        if (reason === "jobs-fewer") {
          // What the unconfirmed build did to the jobs is kept, and said.
          expect(jobsIn(join(b.prodRoot, `state.failed-${op}`, "fleet.sqlite"))).toBe(2);
          expect(record(b, `undo-${op}.txt`)).toContain("jobs: the set-aside state holds 2; the snapshot held 3");
        }
      },
    );
  });

  it("jobs the unconfirmed build accepted are counted in the undo record", async () => {
    const { b, op } = await undone({ addJobs: { [imageId(revOf(1))]: 2 } }, { evidence: "wrong-build" }, "wrong-build", true);
    expect(record(b, `undo-${op}.txt`)).toContain("jobs: the set-aside state holds 5; the snapshot held 3");
    expect(reality(b).jobs).toBe(3);
  });

  it("a config changed AFTER it was checked is never started: the check and the start use one buffer", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const file = join(opDir(b, op), "resolved.json");
    const checked = readFileSync(file, "utf8");
    const s = startDecider(b, op, "run");
    // After the decider verified the file, before it starts it: a privileged copy takes its place.
    await playMac(b, op, { vanish: (st) => st.includes("spent") }, () => false);
    writeFileSync(file, checked.replace('"read_only": true', '"read_only": false, "privileged": true'));
    await playMac(b, op, {}, () => !alive(s.pid));
    await s.done;
    expect(field(b, op, "undoing", "reason")).toBe("config-changed-after-check");
    expect(existsSync(join(b.fake, "started", `${PROJECT}.json`))).toBe(false);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a step that runs into its bound is ended, with its helper container, before the undo starts", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setFaults(b, { hang: { match: "cp -a", when: "after" } });
    const t0 = Date.now();
    const r = await run(b, op);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason")).toBe("snapshot-copy-failed");
    expect(r.out).toContain("UNDONE production is back on");
    expect(Date.now() - t0).toBeLessThan(45_000);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    // The helper container was removed by name and seen gone, and the unverified copy with it.
    expect(dockerLog(b).some((l) => l.startsWith(`rm -f fleet-promote-${op}-copy`))).toBe(true);
    expect(readdirSync(b.prodRoot).filter((f) => f.endsWith(".part"))).toEqual([]);
  });

  it("a later promote that fails goes back to the previous revision from this run's own checked copy of its config", async () => {
    const b = box();
    const first = await passed(b);
    const prevImage = imageId(revOf(1));
    const rev = revOf(2);
    const op = newOp(b, nextPlan(b, first, rev));
    const r = await run(b, op, { evidence: "wrong-build" });
    expect(r.out).toContain(`UNDONE production is back on revision ${revOf(1).slice(0, 12)} (run ${first})`);
    expect(wrong(b, op, { image: prevImage }, imageId(rev))).toEqual([]);
    expect(sha(readFileSync(join(b.fake, "started", `${PROJECT}.json`)))).toBe(field(b, first, "verified", "cfg"));
    // Before the new revision started, the previous CONTAINER itself is restarted, not recreated.
    const again = newOp(b, nextPlan(b, first, revOf(3)));
    const before = containers(b).find((c) => c.project === PROJECT)?.id;
    setFaults(b, { corruptSnapshot: true });
    await run(b, again);
    setFaults(b, {});
    expect(field(b, again, "undoing", "reason")).toBe("snapshot-integrity-failed");
    expect(containers(b).find((c) => c.project === PROJECT)?.id).toBe(before);
    expect(wrong(b, again, { image: prevImage }, imageId(revOf(3)))).toEqual([]);
  });

  it("what comes back must be what ran before: a previous container whose image changed during the switch is not started", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const s = startDecider(b, op, "run");
    await playMac(b, op, { vanish: (st) => st.includes("started") }, () => false);
    // Between the stop and the undo, the stopped container is no longer the one that was checked.
    const handFile = join(b.fake, "containers", `${"c".repeat(64)}.json`);
    const hand = JSON.parse(readFileSync(handFile, "utf8"));
    writeFileSync(handFile, JSON.stringify({ ...hand, image: imageId(rev) }));
    await playMac(b, op, { evidence: "wrong-build" }, () => !alive(s.pid));
    await s.done;
    expect(s.status()).toBe(4);
    expect(readOut(b, op)).toContain("HALTED the previous production's container no longer has the image it had; it was not started");
    expect(dockerLog(b).filter((l) => l.startsWith("start "))).toEqual([]);
    expect(states(b, op)).not.toContain("done");
    writeFileSync(handFile, JSON.stringify({ ...JSON.parse(readFileSync(handFile, "utf8")), image: OLD_IMAGE }));
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a changed copy of the previous config is never started: the undo halts, loudly, and blocks everything until it is resolved", async () => {
    const b = box();
    const first = await passed(b);
    const op = newOp(b, nextPlan(b, first, revOf(2)));
    const s = startDecider(b, op, "run");
    await playMac(b, op, { vanish: (st) => st.includes("started") }, () => false);
    const prev = join(opDir(b, op), "previous.json");
    writeFileSync(prev, readFileSync(prev, "utf8").replace('"read_only": true', '"read_only": false, "privileged": true'));
    await playMac(b, op, { evidence: "wrong-build" }, () => !alive(s.pid));
    await s.done;
    expect(s.status()).toBe(4);
    expect(readOut(b, op)).toContain("HALTED this run's copy of the previous config is not the one that was checked; it was not started and production is down");
    expect(states(b, op)).not.toContain("done");
    expect(reality(b).running).toEqual([]);
    // A halted operation has no terminal record, and blocks every other one.
    expect(records(b).filter((f) => f.includes(op))).toEqual([]);
    expect(wrong(b, op, { image: imageId(revOf(1)) }, imageId(revOf(2))).join()).toContain("no terminal outcome");
    const next = newOp(b, { rev: revOf(3), skipPrepare: true });
    expect(decider(b, next, "run").out).toContain(`operation ${op} is unfinished`);
    // recover refuses the same way, before touching anything, until the copy is the checked one again.
    const before = dockerLog(b).length;
    const rec = decider(b, op, "recover");
    expect(rec.status).toBe(4);
    expect(rec.out).toContain("this run's copy of the previous config is missing or changed");
    expect(disruptive(b, before)).toEqual([]);
    writeFileSync(prev, readFileSync(join(opDir(b, first), "resolved.json")));
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on revision");
    expect(wrong(b, op, { image: imageId(revOf(1)) }, imageId(revOf(2)))).toEqual([]);
  });
});

describe("the decider: an engine call that takes effect after its client is gone", () => {
  it("after an interrupted stop, 'it runs' is not taken for an answer: the stop is asked again and seen, then the start", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // The stop of the previous production: accepted, its client hangs, its effect lands later.
    setFaults(b, { late: { match: "stop -t", ms: 600 } });
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")));
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    killAll(b, op, s.pid);
    await s.done;
    setFaults(b, {});
    const from = dockerLog(b).length;
    const r = await recoverUntilDone(b, op);
    const calls = dockerLog(b).slice(from).map((l) => l.split(" ")[0]);
    expect(calls).toContain("stop");
    expect(calls.indexOf("stop")).toBeLessThan(calls.indexOf("start"));
    expect(r.out).toContain("UNDONE production is back on");
    await sleep(1000);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a stop that lands after the previous production was started again is caught by the settle check: no 'undone' over a stopped production", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev, bounds: { b_settle: 6 } });
    await killedAt(b, op, "started");
    // During recover's undo, a stop that someone's dead client left behind lands 2 s after the
    // previous production was started again.
    const watcher = (async () => {
      while (!states(b, op).includes("undo-previous-started")) await sleep(50);
      await sleep(2000);
      docker(b, ["stop", "-t", "1", HAND_NAME]);
    })();
    const rec = startDecider(b, op, "recover");
    await rec.done;
    await watcher;
    expect(rec.status()).toBe(4);
    expect(readOut(b, op)).toMatch(/HALTED after settling, /);
    expect(states(b, op)).not.toContain("done");
    expect(records(b).filter((f) => f.includes(op))).toEqual([]);
    // Nothing else may run while it is unresolved; recover then finishes it for real.
    expect(decider(b, newOp(b, { rev: revOf(2), skipPrepare: true }), "run").out).toContain("is unfinished");
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    expect(record(b, `undo-${op}.txt`)).toMatch(/checked: \d{4}-\d\d-\d\dT/);
  });

  it("a Compose up ended at its bound: a container its last call creates late is never started, and the next operation's entry check finds it", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // Accepted; the client hangs and is ended at the 10-second bound; the create lands at 14 s.
    setFaults(b, { late: { match: "up -d", ms: 14_000 } });
    const r = await run(b, op);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason")).toBe("start-failed");
    expect(r.out).toContain("UNDONE production is back on");
    for (let i = 0; i < 100 && reality(b).strays === 0; i++) await sleep(100);
    const now = reality(b);
    expect(now.strays).toBe(1);
    expect(now.running.map((c) => c.name)).toEqual([HAND_NAME]);
    const next = newOp(b, { rev: revOf(2) });
    const n = await run(b, next);
    expect(n.out).toContain("a container of the production project already exists");
    expect(field(b, next, "done", "outcome")).toBe("unchanged");
  });
});

describe("the decider: recover", () => {
  it("SIGKILL of the decider at EVERY engine call, before and after the call's effect, then recover twice: one invariant", async () => {
    // How many engine calls a passing first cutover makes, counted from a reference run.
    const ref = box();
    const refOp = newOp(ref, { rev: revOf(1) });
    const first = dockerLog(ref).length + 1;
    await run(ref, refOp);
    const refLog = dockerLog(ref);
    const last = refLog.length;
    expect(last - first).toBeGreaterThan(20);
    // A call that changes something is interrupted before its effect and after it. A query has no
    // effect to be before or after: one kill.
    const points: [number, string][] = [];
    for (let n = first; n <= last; n++) for (const when of CHANGING.test(refLog[n - 1] ?? "") ? ["before", "after"] : ["before"]) points.push([n, when]);
    const failures: string[] = [];
    const outcomes = new Set<string>();
    await pool(points, POOL, async ([n, when]) => {
      const b = makeBox();
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        setFaults(b, { hang: { at: n, when } });
        const s = startDecider(b, op, "run");
        await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
        if (!existsSync(join(b.fake, "hung"))) {
          failures.push(`call ${n} ${when}: the run ended without reaching it (journal: ${states(b, op).join(",")}; ${readOut(b, op).slice(-200)})`);
          return;
        }
        const at = states(b, op).slice(-1)[0];
        killAll(b, op, s.pid);
        await s.done;
        setFaults(b, {});
        const r1 = await recoverUntilDone(b, op);
        const logAfter = dockerLog(b).length;
        const r2 = await deciderAsync(b, op, "recover");
        const bad = wrong(b, op, HAND, imageId(rev));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (!r2.out.includes("Nothing was changed")) bad.push("the second recover did not say it changed nothing");
        outcomes.add(field(b, op, "done", "outcome"));
        if (bad.length) failures.push(`call ${n} ${when} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-600)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    // The sweep really covered runs that never touched production, undone runs and a committed one.
    expect([...outcomes].sort()).toEqual(["pass", "unchanged", "undone"]);
  });

  it("the same sweep for a later promote (Compose to Compose), with the interrupted engine call taking effect after the kill", async () => {
    const ref = box();
    const refFirst = await passed(ref);
    const refOp = newOp(ref, nextPlan(ref, refFirst, revOf(2)));
    const runFrom = dockerLog(ref).length;
    await run(ref, refOp);
    const log = dockerLog(ref);
    // From the stop on (the checks before it are the first sweep's, whatever production is), one
    // kill per call, alternately before and after its effect; and, for every call that changes
    // something, the call accepted, its client killed, and its effect landing afterwards.
    const first = log.findIndex((l, i) => i >= runFrom && l.startsWith("stop -t")) + 1;
    const last = log.length;
    expect(first).toBeGreaterThan(1);
    const points: [number, string][] = [];
    for (let n = first; n <= last; n++) {
      points.push([n, n % 2 ? "after" : "before"]);
      if (CHANGING.test(log[n - 1] ?? "")) points.push([n, "late"]);
    }
    const failures: string[] = [];
    let lateHits = 0;
    await pool(points, POOL, async ([n, when]) => {
      const b = makeBox();
      try {
        const one = await passed(b);
        const rev = revOf(2);
        const op = newOp(b, nextPlan(b, one, rev));
        setFaults(b, when === "late" ? { late: { at: n, ms: 700 } } : { hang: { at: n, when } });
        const s = startDecider(b, op, "run");
        await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
        if (!existsSync(join(b.fake, "hung"))) {
          failures.push(`call ${n} ${when}: not reached (journal: ${states(b, op).join(",")}; ${readOut(b, op).slice(-200)})`);
          return;
        }
        if (when === "late") lateHits += 1;
        const at = states(b, op).slice(-1)[0];
        killAll(b, op, s.pid);
        await s.done;
        setFaults(b, {});
        await sleep(when === "late" ? 1200 : 0);
        const r1 = await recoverUntilDone(b, op);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, op, "recover");
        const bad = wrong(b, op, { image: imageId(revOf(1)) }, imageId(rev));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (reality(b).strays) bad.push("a stray project container was left");
        if (bad.length) failures.push(`call ${n} ${when} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-600)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    expect(lateHits).toBeGreaterThan(4);
  });

  it("SIGKILL during the undo and during recover itself ('undo half done'), at every engine call of the undo", async () => {
    const ref = box();
    const refOp = newOp(ref, { rev: revOf(1) });
    await run(ref, refOp, { evidence: "wrong-build" });
    // The undo's first call is its listing of this run's helper containers: the first one after the
    // new revision was started (the checks before the stop make the same listing).
    const refLog = dockerLog(ref);
    const up = refLog.findIndex((l) => /^compose .* up\b/.test(l));
    expect(up).toBeGreaterThan(0);
    const undoFrom = refLog.findIndex((l, i) => i > up && l.startsWith("ps -aq --filter name=")) + 1;
    const last = refLog.length;
    expect(undoFrom).toBeGreaterThan(up + 1);
    expect(last - undoFrom).toBeGreaterThan(10);
    const points: [number, string, string][] = [];
    for (let n = undoFrom; n <= last; n++) {
      for (const when of CHANGING.test(refLog[n - 1] ?? "") ? ["before", "after"] : ["before"]) points.push([n, when, "run"]);
      points.push([n, n % 2 ? "after" : "before", "recover"]);
    }
    const failures: string[] = [];
    let recoverHits = 0;
    await pool(points, POOL, async ([n, when, who]) => {
      const b = makeBox();
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        if (who === "run") {
          setFaults(b, { hang: { at: n, when } });
          const s = startDecider(b, op, "run");
          await playMac(b, op, { evidence: "wrong-build" }, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
          if (!existsSync(join(b.fake, "hung"))) {
            failures.push(`call ${n} ${when} ${who}: not reached (journal: ${states(b, op).join(",")}; ${readOut(b, op).slice(-200)})`);
            return;
          }
          killAll(b, op, s.pid);
          await s.done;
        } else {
          // The decider dies with the new revision up; recover itself is then killed mid-undo.
          // (recover first checks the undo's prerequisites: three calls before the undo's first.)
          await killedAt(b, op, "server-checked");
          setFaults(b, { hang: { at: dockerLog(b).length + 3 + (n - undoFrom) + 1, when } });
          const rec = startDecider(b, op, "recover");
          while (!existsSync(join(b.fake, "hung")) && alive(rec.pid)) await sleep(40);
          if (existsSync(join(b.fake, "hung"))) recoverHits += 1;
          killAll(b, op, rec.pid);
          await rec.done;
        }
        const at = states(b, op).slice(-1)[0];
        setFaults(b, {});
        const r1 = await recoverUntilDone(b, op);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, op, "recover");
        const bad = wrong(b, op, HAND, imageId(rev));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (bad.length) failures.push(`call ${n} ${when} ${who} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-600)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    expect(recoverHits).toBeGreaterThan(10);
  });

  it("killing ONLY the decider: recover waits for the lock, which is free only once the bounded step has been ended, then undoes", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setFaults(b, { hang: { match: "cp -a", when: "before" } });
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")));
    const hungPid = Number(readFileSync(join(b.fake, "hung"), "utf8").trim().split(" ")[1]);
    process.kill(s.pid, "SIGKILL");
    await s.done;
    setFaults(b, {});
    // The decider is dead; the step it was bounding is not, and it keeps the lock.
    expect(alive(hungPid)).toBe(true);
    expect(lockIsFree(b)).toBe(false);
    const t0 = Date.now();
    const r = decider(b, op, "recover");
    expect(r.out).toContain("UNDONE production is back on");
    // It could only start once the bound (10 s here) had ended the step.
    expect(Date.now() - t0).toBeGreaterThan(4000);
    expect(alive(hungPid)).toBe(false);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a step that outlives the decider AND its bound keeps the lock: recover refuses, names the holder by command name, and deletes nothing", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev, bounds: { b_copy: 10, b_stop: 40, b_integrity: 10, b_start: 10, b_exec: 10, b_undo_start: 10 } });
    setFaults(b, { hang: { match: "cp -a", when: "before" } });
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => existsSync(join(b.fake, "hung")));
    const hungPid = Number(readFileSync(join(b.fake, "hung"), "utf8").trim().split(" ")[1]);
    // The decider and the bound are killed (their own group); the engine client they bounded lives on.
    for (const target of [-s.pid, s.pid]) {
      try {
        process.kill(target, "SIGKILL");
      } catch {}
    }
    await s.done;
    setFaults(b, {});
    expect(alive(hungPid)).toBe(true);
    const before = dockerLog(b).length;
    const r = decider(b, op, "recover");
    expect(r.status).toBe(75);
    expect(r.out).toContain("REFUSED another promote, recover or revert holds the lock: its decider, or a step it started that is still running. Nothing was changed.");
    expect(r.out).toMatch(new RegExp(`holding it: process ${hungPid} \\w+`));
    expect(r.out).toContain("production may be down until that process is ended");
    expect(r.out).not.toMatch(/\b(remove|delete|rm)\b/i);
    expect(r.out).not.toContain(b.root);
    expect(dockerLog(b).length).toBe(before);
    process.kill(hungPid, "SIGKILL");
    await sleep(500);
    expect((await recoverUntilDone(b, op)).out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("a recorded step still running with the lock free: recover halts, names the group's processes, and changes nothing", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    await killedAt(b, op, "started");
    // A step of this run that outlived everything and does not hold the lock: its bound was killed.
    const groups = join(opDir(b, op), "groups");
    const lines = readFileSync(groups, "utf8").split("\n").length;
    const started = spawnSync(DASH, ["-c", `perl "$1" bound --note "$2" start-new 60 1 -- sleep 61 > /dev/null 2>&1 & echo $!`, "sh", GUARD, groups], { encoding: "utf8" });
    while (readFileSync(groups, "utf8").split("\n").length === lines) await sleep(50);
    process.kill(Number(started.stdout.trim()), "SIGKILL");
    const pgid = Number(readFileSync(groups, "utf8").trim().split("\n").pop()?.split(" ")[0]);
    await sleep(300);
    const before = dockerLog(b).length;
    const r = decider(b, op, "recover");
    expect(r.status).toBe(4);
    expect(r.out).toContain(`HALTED a step of operation ${op} is still running; production may be down until that process is ended.`);
    expect(r.out).toContain(`still running: group ${pgid} (start-new): ${pgid} sleep`);
    expect(r.out).not.toMatch(/\b(remove|delete)\b/i);
    expect(dockerLog(b).length).toBe(before);
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(rev)]);
    process.kill(-pgid, "SIGKILL");
    await sleep(500);
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("works from the server's own console with nothing from the Mac: the uploaded run folder is all it needs", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    await killedAt(b, op, "started");
    // The documented one line, with only a PATH: cd <control folder> && sh promote-runs/<op>/decider.sh recover <op>
    const r = spawnSync("sh", ["-c", `cd "$1" && ${DASH} "promote-runs/$2/decider.sh" recover "$2"`, "sh", b.ctl, op], {
      env: { PATH: b.env.PATH as string, FAKE_STATE: b.fake, FAKE_BIN: b.bin, FAKE_REPO_ROOT: b.env.FAKE_REPO_ROOT as string },
      encoding: "utf8",
    });
    expect(r.stdout).toContain("UNDONE production is back on the hand-started container");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
    const st = decider(b, op, "status");
    expect(st.out).toContain("outcome: undone");
    expect(st.out).toContain("not a statement about what production runs now");
    // Safe to repeat: recover of a finished operation only reads. It calls the engine for nothing,
    // writes no journal line and no record, and says so.
    const calls = dockerLog(b).length;
    const lines = journal(b, op).length;
    const again = decider(b, op, "recover");
    expect(again.out).toContain(`operation ${op} is finished: undone`);
    expect(again.out).toContain("Nothing was changed.");
    expect(dockerLog(b).length).toBe(calls);
    expect(journal(b, op).length).toBe(lines);
    expect(journal(b, op).filter((l) => l.split(" ")[1] === "done")).toHaveLength(1);
  });

  it("an operation whose decider never began is closed, so a late start of it is refused; recover of one run while another is unfinished is refused", async () => {
    const b = box();
    const never = newOp(b, { rev: revOf(1) });
    const r = decider(b, never, "recover");
    expect(r.out).toContain(`the decider of ${never} never began`);
    expect(field(b, never, "done", "outcome")).toBe("unchanged");
    expect(decider(b, never, "run").out).toContain("already has a journal");
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    const open = newOp(b, { rev: revOf(2) });
    await killedAt(b, open, "stopped");
    const other = newOp(b, { rev: revOf(3), skipPrepare: true });
    expect(decider(b, other, "recover").out).toContain(`REFUSED operation ${open} is unfinished: recover that one first`);
    expect(decider(b, open, "recover").out).toContain("UNDONE");
  });

  it("a committed pass is confirmed, never undone: its record is completed; if the revision does not run, it halts and says so", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    // The decider dies right after writing "committed" (its 11th journal line), before the record.
    setPerlFaults(b, ["append 11 kill-after"]);
    const s = startDecider(b, op, "run");
    await playMac(b, op, {}, () => !alive(s.pid));
    await s.done;
    setPerlFaults(b, []);
    expect(states(b, op).slice(-1)).toEqual(["committed"]);
    expect(records(b)).toEqual([]);
    // The revision is stopped by something else: recover must not call that a pass, nor undo it.
    const cid = field(b, op, "started", "cid");
    docker(b, ["stop", "-t", "1", cid]);
    const halted = decider(b, op, "recover");
    expect(halted.status).toBe(4);
    expect(halted.out).toContain("was committed at");
    expect(halted.out).toContain("NOT seen running now");
    expect(states(b, op)).not.toContain("done");
    expect(states(b, op)).not.toContain("undoing");
    docker(b, ["start", cid]);
    const ok = decider(b, op, "recover");
    expect(ok.out).toContain(`PASS production runs ${rev}`);
    expect(ok.status).toBe(0);
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });
});

describe("the decider: what the undo needs is checked before the first disruptive call, in every mode", () => {
  it("recover with the unconfirmed build running: a missing prerequisite refuses and leaves that build running", async () => {
    const cases = ["previous-container", "previous-policy", "snapshot", "snapshot-marker", "helper-image"] as const;
    await pool([...cases], POOL, async (what) => {
      const b = makeBox();
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        await killedAt(b, op, "server-checked");
        const handFile = join(b.fake, "containers", `${"c".repeat(64)}.json`);
        const hand = readFileSync(handFile, "utf8");
        const snap = join(b.prodRoot, `state.pre-${op}`);
        const marker = join(snap, ".fleet-promote-snapshot");
        const images = readFileSync(join(b.fake, "images.json"), "utf8");
        let put = () => {};
        let say = /./;
        if (what === "previous-container") {
          unlinkSync(handFile);
          put = () => writeFileSync(handFile, hand);
          say = /the previous production's container is gone/;
        } else if (what === "previous-policy") {
          writeFileSync(handFile, JSON.stringify({ ...JSON.parse(hand), policy: "always" }));
          put = () => writeFileSync(handFile, hand);
          say = /restart policy is no longer one that stays stopped/;
        } else if (what === "snapshot") {
          spawnSync("mv", [snap, `${snap}.moved`]);
          put = () => spawnSync("mv", [`${snap}.moved`, snap]);
          say = /the state folders are not in a layout this operation left/;
        } else if (what === "snapshot-marker") {
          writeFileSync(marker, "op=some-other-run\n");
          put = () => writeFileSync(marker, `op=${op}\n`);
          say = /the state folders are not in a layout this operation left/;
        } else {
          dropImageName(b, imageId(rev));
          dropImageName(b, `fleet-runner:${rev}`);
          put = () => writeFileSync(join(b.fake, "images.json"), images);
          say = /the image the helper containers run from is gone/;
        }
        const before = dockerLog(b).length;
        const r = await deciderAsync(b, op, "recover");
        expect(r.status, what).toBe(4);
        expect(r.out, what).toMatch(say);
        expect(r.out, what).toContain("whatever runs now was left running");
        expect(disruptive(b, before), what).toEqual([]);
        expect(reality(b).running.map((c) => c.image), what).toEqual([imageId(rev)]);
        expect(states(b, op), what).not.toContain("done");
        put();
        expect((await deciderAsync(b, op, "recover")).out, what).toContain("UNDONE production is back on");
        expect(wrong(b, op, HAND, imageId(rev)), what).toEqual([]);
      } finally {
        await destroyBoxAsync(b);
      }
    });
  });

  it("a later promote: the previous image gone, its name pointing elsewhere, or the previous run's config changed refuses the RUN before the stop", async () => {
    const cases = ["image-gone", "name-drift", "previous-config"] as const;
    await pool([...cases], POOL, async (what) => {
      const b = makeBox();
      try {
        const first = await passed(b);
        const op = newOp(b, nextPlan(b, first, revOf(2)));
        if (what === "image-gone") {
          dropImageName(b, imageId(revOf(1)));
          dropImageName(b, `fleet-runner:${revOf(1)}`);
        } else if (what === "name-drift") {
          const file = join(b.fake, "images.json");
          const all = JSON.parse(readFileSync(file, "utf8"));
          all[`fleet-runner:${revOf(1)}`] = all[`fleet-runner:${revOf(2)}`];
          writeFileSync(file, JSON.stringify(all));
        } else {
          const f = join(opDir(b, first), "resolved.json");
          writeFileSync(f, `${readFileSync(f, "utf8")}\n`);
        }
        const before = dockerLog(b).length;
        const r = await run(b, op);
        expect(field(b, op, "done", "outcome"), what).toBe("unchanged");
        expect(r.out, what).toMatch(/REFUSED .*(previous revision's image|previous run's saved config)/);
        expect(disruptive(b, before), what).toEqual([]);
        expect(reality(b).running.map((c) => c.image), what).toEqual([imageId(revOf(1))]);
      } finally {
        await destroyBoxAsync(b);
      }
    });
  });
});

describe("the decider: the journal and the records when the disk fails", () => {
  it("a failure, a torn line, a write that reports failure, and a kill at EVERY journal append, record and flush of a pass and of an undo; recover twice", async () => {
    // Count the persistence calls of a passing run and of an undone one.
    const count = async (evidence: "ok" | "wrong-build") => {
      const b = box();
      setPerlFaults(b, ["append 0 none"]);
      await run(b, newOp(b, { rev: revOf(1) }), { evidence });
      return { append: perlCount(b, "append"), publish: perlCount(b, "publish"), sync: perlCount(b, "sync-path") };
    };
    const pass = await count("ok");
    const undo = await count("wrong-build");
    expect(pass.append).toBe(12);
    expect(undo.append).toBe(18);
    expect(pass.publish).toBe(1);
    const points: [string, string, number, string][] = [];
    for (const [evidence, c] of [["ok", pass], ["wrong-build", undo]] as const) {
      // Every append: a failure (nothing written, as on a full disk) and a kill right after it.
      // A torn line (a short write) and a write that reports failure though the line is there:
      // at every third append, and at the lines everything hinges on (the last three of each run,
      // and "starting").
      for (let n = 1; n <= c.append; n++) {
        const modes = ["fail", "kill-after"];
        if (n % 3 === 0 || n === 7 || n > c.append - 3) modes.push("torn", "wrote-failed");
        for (const mode of modes) points.push([evidence, "append", n, mode]);
      }
      for (let n = 1; n <= c.publish; n++) for (const mode of ["fail", "kill-before", "kill-after"]) points.push([evidence, "publish", n, mode]);
      for (let n = 1; n <= c.sync; n++) points.push([evidence, "sync-path", n, "fail"]);
    }
    const failures: string[] = [];
    const exits = new Set<number | null>();
    await pool(points, POOL, async ([evidence, call, n, mode]) => {
      const b = makeBox();
      const tag = `${evidence} ${call} ${n} ${mode}`;
      try {
        const rev = revOf(1);
        const op = newOp(b, { rev });
        setPerlFaults(b, [`${call} ${n} ${mode}`]);
        const r = await run(b, op, { evidence: evidence as "ok" });
        exits.add(r.status);
        const hit = existsSync(join(b.fake, "perl-faults.hit"));
        setPerlFaults(b, []);
        if (!hit) {
          failures.push(`${tag}: the fault was never reached (journal: ${states(b, op).join(",")}; ${r.out.slice(-200)})`);
          return;
        }
        const bad: string[] = [];
        // What it said must be true at the moment it said it.
        const outcome = field(b, op, "done", "outcome");
        if (r.out.includes("PASS production runs") && outcome !== "pass") bad.push("it printed PASS without a done line");
        if (/^UNDONE production/m.test(r.out) && outcome !== "undone") bad.push("it printed UNDONE without a done line");
        if (r.status === 0 && outcome !== "pass") bad.push("exit 0 without a recorded pass");
        if (states(b, op).includes("committed") && states(b, op).includes("undoing")) bad.push("a committed line AND an undo in one journal");
        // No complete line of the journal is ever two lines run together.
        for (const l of completeLines(b, op)) if (!LINE.test(l)) bad.push(`a malformed journal line: ${l.slice(0, 60)}`);
        const r1 = await recoverUntilDone(b, op);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, op, "recover");
        bad.push(...wrong(b, op, HAND, imageId(rev)));
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (bad.length) failures.push(`${tag}: ${[...new Set(bad)].join("; ")}\n${r.out.slice(-300)}\n${r1.all.slice(-300)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    // Among them: runs that ended "record incomplete" (3), never as a success.
    expect(exits.has(3)).toBe(true);
  });

  it("a journal that cannot be written during the undo does not stop the undo: production comes back, the run says 'record incomplete'", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    const s = startDecider(b, op, "run");
    await playMac(b, op, { vanish: (st) => st.includes("server-checked") }, () => false);
    // From here on nothing can be appended (a full disk): every later append fails.
    setPerlFaults(b, Array.from({ length: 40 }, (_, i) => `append ${i + 1} fail`));
    await playMac(b, op, { evidence: "wrong-build" }, () => !alive(s.pid));
    await s.done;
    expect(s.status()).toBe(3);
    const out = readOut(b, op);
    expect(out).toContain("the journal cannot be written; the undo carries on");
    expect(out).toContain("UNDONE, RECORD INCOMPLETE production is back on the hand-started container");
    expect(out).not.toMatch(/^UNDONE production/m);
    expect(states(b, op)).not.toContain("done");
    // Production IS back, though the journal does not say so yet.
    expect(reality(b).running.map((c) => c.name)).toEqual([HAND_NAME]);
    expect(reality(b).jobs).toBe(3);
    setPerlFaults(b, []);
    expect(decider(b, op, "recover").out).toContain("UNDONE production is back on");
    expect(wrong(b, op, HAND, imageId(rev))).toEqual([]);
  });

  it("an uncertain commit: 'committed' is in the journal but the write reported failure: never undone, never called a pass", async () => {
    const b = box();
    const rev = revOf(1);
    const op = newOp(b, { rev });
    setPerlFaults(b, ["append 11 wrote-failed"]);
    const r = await run(b, op);
    setPerlFaults(b, []);
    expect(r.status).toBe(3);
    expect(r.out).toContain("COMMITTED, RECORD INCOMPLETE");
    expect(r.out).not.toContain("PASS production runs");
    expect(states(b, op).slice(-1)).toEqual(["committed"]);
    expect(states(b, op)).not.toContain("undoing");
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(rev)]);
    expect(decider(b, op, "recover").out).toContain(`PASS production runs ${rev}`);
    // And when the line did NOT make it: that is no commit, and it is undone.
    const b2 = box();
    const op2 = newOp(b2, { rev });
    setPerlFaults(b2, ["append 11 torn"]);
    const r2 = await run(b2, op2);
    setPerlFaults(b2, []);
    expect(field(b2, op2, "undoing", "reason")).toBe("journal-failed");
    expect(r2.out).toContain("UNDONE production is back on");
    expect(wrong(b2, op2, HAND, imageId(rev))).toEqual([]);
  });

  it("the disk filled by this run's own snapshot copy: the undo removes the unverified copy first, never a verified snapshot or another run's", async () => {
    const b = box();
    // A verified snapshot of an earlier run: not this run's to touch.
    const earlier = await passed(b);
    const rev = revOf(2);
    const op = newOp(b, nextPlan(b, earlier, rev));
    setFaults(b, { hang: { match: "cp -a", when: "after" } });
    const r = await run(b, op);
    setFaults(b, {});
    expect(field(b, op, "undoing", "reason")).toBe("snapshot-copy-failed");
    expect(r.out).toContain("UNDONE");
    const folders = readdirSync(b.prodRoot).filter((f) => f.startsWith("state"));
    expect(folders).toContain(`state.pre-${earlier}`);
    expect(folders).not.toContain(`state.pre-${op}.part`);
    // The removal names this run's own unverified copy, and came before the undo's first journal line.
    const log = dockerLog(b);
    const drop = log.findIndex((l) => l.includes(`fleet-promote-${op}-drop-partial`));
    expect(drop).toBeGreaterThan(-1);
    expect(log[drop]).toContain('rm -rf "/srv/state.pre-$1.part"');
    expect(log[drop]?.trim().endsWith(`sh ${op}`)).toBe(true);
  });

  it("flushes to disk in the order that makes the journal true: the run folder before the journal, the copy before 'snapshot', each rename before its line", async () => {
    const b = box();
    const op = newOp(b, { rev: revOf(1) });
    setPerlFaults(b, ["append 0 none"]);
    await run(b, op);
    expect(perlCount(b, "sync-path")).toBe(1);
    // The snapshot copy is flushed inside the same helper, before the integrity check runs.
    const copy = dockerLog(b).find((l) => l.includes("-copy "));
    expect(copy).toMatch(/cp -a \/srv\/state .* && sync/);
    expect(readFileSync(join(b.fake, "sync.log"), "utf8")).toContain("sync");
    // The rename helpers are real renames that flush the folder they renamed in.
    const src = readFileSync(DECIDER, "utf8");
    expect(src).toMatch(/RENAME_JS='[^']*renameSync[^']*fsyncSync\(d\)/);
    expect(src).toMatch(/NAME_JS='[^']*fsyncSync\(f\)[^']*renameSync[^']*fsyncSync\(d\)/);
  });
});

describe("the decider: revert, an operation of its own", () => {
  const revertPlan = (b: Box, target: string, approval?: string) => newOp(b, { mode: "revert", target, approval });

  it("after a first cutover: needs its own yes, says how many jobs it sets aside, brings the hand-started container back", async () => {
    const b = box();
    setFaults(b, { addJobs: { [imageId(revOf(1))]: 2 } });
    const first = await passed(b);
    setFaults(b, {});
    expect(reality(b).jobs).toBe(5);
    const z = revertPlan(b, first);
    const check = decider(b, z, "check");
    expect(check.out).toContain(`jobs: production holds 5 now, the snapshot of run ${first} holds 3: this revert sets aside 2 job(s) accepted since that promote`);
    expect(check.out).toContain("PASS every check");
    const r = await run(b, z);
    expect(r.out).toContain("REVERTED production is back on the hand-started container");
    expect(r.status).toBe(0);
    expect(states(b, z)).toEqual(["begun", "go", "verified", "spent", "undoing", "undo-quiet", "undo-new-removed", "undo-state-aside", "undo-state-back", "undo-previous-stopped", "undo-previous-started", "undo-healthy", "done"]);
    expect(field(b, z, "done", "outcome")).toBe("reverted");
    expect(field(b, z, "begun", "target")).toBe(first);
    const now = reality(b);
    expect(now.running.map((c) => c.name)).toEqual([HAND_NAME]);
    expect(now.projectContainers).toBe(0);
    expect(now.jobs).toBe(3);
    expect(now.stateFolders).toEqual(["state", `state.failed-${z}`]);
    expect(jobsIn(join(b.prodRoot, `state.failed-${z}`, "fleet.sqlite"))).toBe(5);
    expect(record(b, `revert-${z}.txt`)).toContain(`revert ${z} of run ${first}`);
    expect(record(b, `revert-${z}.txt`)).toContain("jobs: the set-aside state holds 5; the snapshot held 3");
    // The promote's own journal and record are untouched history.
    expect(field(b, first, "done", "outcome")).toBe("pass");
    expect(states(b, first)).not.toContain("undoing");
    expect(record(b, `promote-${first}.txt`)).toContain("committed:");
    // Production is the hand-started container again, by the journals: a new first cutover works.
    const again = newOp(b, { rev: revOf(2) });
    expect((await run(b, again)).out).toContain("PASS production runs");
  });

  it("after a later promote: back to the previous revision, from the config that run replaced", async () => {
    const b = box();
    const one = await passed(b);
    const two = newOp(b, nextPlan(b, one, revOf(2)));
    expect((await run(b, two)).status).toBe(0);
    const z = revertPlan(b, two);
    const r = await run(b, z);
    expect(r.out).toContain(`REVERTED production is back on revision ${revOf(1).slice(0, 12)} (run ${one})`);
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(revOf(1))]);
    expect(sha(readFileSync(join(b.fake, "started", `${PROJECT}.json`)))).toBe(field(b, one, "verified", "cfg"));
    // By the journals production is run one again: the next promote names it as its previous.
    const three = newOp(b, nextPlan(b, one, revOf(3)));
    expect((await run(b, three)).out).toContain("PASS production runs");
  });

  it("refuses: a run that is not the current one, the promote's own yes used again, a missing snapshot, another unfinished operation", async () => {
    const b = box();
    const one = await passed(b, revOf(1));
    const two = newOp(b, nextPlan(b, one, revOf(2)));
    expect((await run(b, two)).status).toBe(0);
    const before = dockerLog(b).length;
    const old = revertPlan(b, one);
    expect((await run(b, old)).out).toMatch(new RegExp(`run ${one} is not what production runs now`));
    const reused = revertPlan(b, two, /^approval=(.*)$/m.exec(readFileSync(join(opDir(b, two), "plan"), "utf8"))?.[1]);
    expect((await run(b, reused)).out).toContain("this approval was already used");
    const snap = join(b.prodRoot, `state.pre-${two}`);
    spawnSync("mv", [snap, `${snap}.moved`]);
    const noSnap = revertPlan(b, two);
    expect((await run(b, noSnap)).out).toContain(`the snapshot run ${two} took (with its marker) is not there`);
    spawnSync("mv", [`${snap}.moved`, snap]);
    for (const op of [old, reused, noSnap]) {
      expect(field(b, op, "done", "outcome")).toBe("unchanged");
      expect(states(b, op)).not.toContain("spent");
    }
    expect(disruptive(b, before)).toEqual([]);
    expect(reality(b).running.map((c) => c.image)).toEqual([imageId(revOf(2))]);
    // An unfinished promote: no revert of anything until it is recovered.
    const three = newOp(b, nextPlan(b, two, revOf(3)));
    await killedAt(b, three, "stopped");
    const blocked = revertPlan(b, two);
    expect(decider(b, blocked, "run").out).toContain(`REFUSED operation ${three} is unfinished`);
    expect(journal(b, blocked)).toEqual([]);
  });

  it("SIGKILL at every engine call of a revert, then recover twice: it is completed, never rolled back, and the promote's history stands", async () => {
    const ref = box();
    const refFirst = await passed(ref);
    const refZ = revertPlan(ref, refFirst);
    const first = dockerLog(ref).length + 1;
    await run(ref, refZ);
    const last = dockerLog(ref).length;
    const points: [number, string][] = [];
    for (let n = first; n <= last; n++) points.push([n, n % 2 ? "after" : "before"]);
    const failures: string[] = [];
    const outcomes = new Set<string>();
    await pool(points, POOL, async ([n, when]) => {
      const b = makeBox();
      try {
        const target = await passed(b);
        const z = revertPlan(b, target);
        setFaults(b, { hang: { at: n, when } });
        const s = startDecider(b, z, "run");
        await playMac(b, z, {}, () => existsSync(join(b.fake, "hung")) || !alive(s.pid));
        if (!existsSync(join(b.fake, "hung"))) {
          failures.push(`call ${n} ${when}: not reached (journal: ${states(b, z).join(",")}; ${readOut(b, z).slice(-200)})`);
          return;
        }
        const at = states(b, z).slice(-1)[0];
        killAll(b, z, s.pid);
        await s.done;
        setFaults(b, {});
        const r1 = await recoverUntilDone(b, z);
        const logAfter = dockerLog(b).length;
        await deciderAsync(b, z, "recover");
        const outcome = field(b, z, "done", "outcome");
        outcomes.add(outcome);
        const now = reality(b);
        const bad: string[] = [];
        if (dockerLog(b).length !== logAfter) bad.push("the second recover called the engine");
        if (!lockIsFree(b)) bad.push("the lock is held");
        if (now.helpers) bad.push("helper containers left");
        if (now.running.length !== 1) bad.push(`${now.running.length} containers run`);
        if (field(b, target, "done", "outcome") !== "pass" || states(b, target).includes("undoing")) bad.push("the promote's journal was rewritten");
        if (outcome === "reverted") {
          if (now.running[0]?.name !== HAND_NAME) bad.push("reverted, but the hand-started container does not run");
          if (now.jobs !== 3 || !now.stateFolders.includes(`state.failed-${z}`)) bad.push("reverted, but the snapshot is not the state folder");
          if (!records(b).includes(`revert-${z}.txt`)) bad.push("reverted without its record");
        } else if (outcome === "unchanged") {
          if (now.running[0]?.image !== imageId(revOf(1))) bad.push("unchanged, but the promoted revision does not run");
          if (states(b, z).includes("spent")) bad.push("unchanged after the yes was spent");
        } else bad.push(`no terminal outcome (${outcome || "none"})`);
        if (bad.length) failures.push(`call ${n} ${when} (journal at ${at}): ${bad.join("; ")}\n${r1.all.slice(-500)}`);
      } finally {
        await destroyBoxAsync(b);
      }
    });
    expect(failures).toEqual([]);
    expect([...outcomes].sort()).toEqual(["reverted", "unchanged"]);
  });
});
