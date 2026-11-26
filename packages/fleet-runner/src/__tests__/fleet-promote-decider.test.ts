import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DASH,
  DECIDER,
  HAND_NAME,
  PROJECT,
  containers,
  decider,
  dockerLog,
  field,
  imageId,
  journal,
  newOp,
  opDir,
  reality,
  record,
  records,
  revOf,
  run,
  setFaults,
  sha,
  states,
} from "./fakes/promote-harness.js";
import { HAND, useBoxes, wrong } from "./fakes/decider-kit.js";

// The promote's server-side decider (fleet-promote-decider.sh) against the fake engine, under dash:
// the few tests that take seconds and so run with `pnpm test` on every change: one whole promote,
// the bounds' arithmetic and its refusals, and a check that writes nothing. Everything that sits
// through real waits is in fleet-promote-decider.slow_test.ts and fleet-promote-recover.slow_test.ts,
// and the kill sweeps in *.sweep_test.ts; CI runs those when a change touches fleet-runner.
// EVERYTHING HERE IS SYNTHETIC: folders, revisions, image IDs, keys and jobs mean nothing outside
// this file. No server and no real engine are involved.
vi.setConfig({ testTimeout: 600_000 });
const box = useBoxes();

describe("the decider, in seconds", () => {
  const bounds = (plan?: string) => spawnSync(DASH, [DECIDER, "bounds", ...(plan ? [plan] : [])], { encoding: "utf8" });

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

  it("with NO bound set, the defaults add up to the documented worst case and are accepted", () => {
    const r = bounds();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("worst_case=1167 pass_path=626 silent_max=966 before=315");
    expect(r.stdout).toContain("120  wait for this Mac's evidence");
    expect(r.stdout).toContain("this Mac waits for the decider's first journal line");
    // The printed rows of the offline window and the undo are the sum.
    const all = r.stdout.split("\n");
    const rows = all.slice(all.findIndex((l) => l.includes("production offline:")));
    const sum = rows.map((l) => /^ {4}(\d+) {2}/.exec(l)?.[1]).filter(Boolean).reduce((t, n) => t + Number(n), 0);
    expect(sum).toBe(1167);
    // The documented number is this number.
    expect(readFileSync(join(DECIDER, "../../deployment.md"), "utf8")).toContain("1167 seconds");
  });

  it("refuses an impossible setting before anything is touched", () => {
    const b = box();
    for (const [k, v, why] of [
      ["b_evidence", "30", "b_evidence must be at least 60"],
      ["b_evidence", "601", "b_evidence must be at most 600"],
      ["b_stop", "20", "b_stop must be at least 40"],
      ["b_copy", "soon", "b_copy must be a whole number"],
      ["b_start", "0", "b_start must be a whole number of seconds, written plainly"],
      ["b_start", "5", "b_start must be at least 10"],
      ["b_health", "12", "b_health must be at least 20"],
      // A leading zero would be octal to the table's arithmetic and decimal to the timer.
      ["b_copy", "0777", "b_copy must be a whole number of seconds, written plainly"],
      ["b_stop", "0045", "b_stop must be a whole number of seconds, written plainly"],
      ["b_evidence", "0100", "b_evidence must be a whole number of seconds, written plainly"],
      ["b_copy", "+60", "b_copy must be a whole number"],
      ["b_copy", "6e1", "b_copy must be a whole number"],
      // Every bound has a ceiling: a worst case of days is not a setting, it is a mistake.
      ["b_stop", "301", "b_stop must be at most 300"],
      ["b_stop", "99999", "b_stop must be at most 300"],
      ["b_copy", "3601", "b_copy must be at most 3600"],
      ["b_settle", "121", "b_settle must be at most 120"],
      ["b_go", "301", "b_go must be at most 300"],
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

  it("check writes nothing: a check that halts leaves no journal, and blocks no operation", async () => {
    const b = box();
    const op = newOp(b, { rev: revOf(1) });
    // The helper that lists the enrolled keys fails, and whether it is gone cannot be seen: a halt.
    setFaults(b, { fail: { match: "keys-before" } });
    const r = decider(b, op, "check");
    setFaults(b, {});
    expect(r.status).toBe(4);
    expect(r.out).toContain("HALTED could not see whether the helper container keys-before is gone");
    expect(existsSync(join(opDir(b, op), "journal"))).toBe(false);
    expect(decider(b, op, "current").out).toMatch(/unfinished=$/m);
    // Nothing is blocked: the very same operation, and any other, still runs.
    expect((await run(b, op)).out).toContain("PASS production runs");
  });
});
