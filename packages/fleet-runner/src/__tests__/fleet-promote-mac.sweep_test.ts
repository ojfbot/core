import {
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  OLD_BUILD,
  field,
  opDir,
  sleep,
  states,
} from "./fakes/promote-harness.js";
import { all, deciderGone, destroy, headRev, lastOp, macLog, promote, promoteAsync, setSsh, setup, sshCount, statusNow, useMacSandboxes, yes } from "./fakes/mac-harness.js";

// The Mac side of the promote, killed at every call it makes to the server. One sandbox per call,
// before it and after it: expensive, so it is not in `pnpm test`. CI runs it with the decider's
// kill sweeps (vitest.promote-sweeps.config.ts) on every push to main and whenever a change touches
// the promote. EVERYTHING HERE IS SYNTHETIC (see fakes/mac-harness.ts).
vi.setConfig({ testTimeout: 1_800_000 });
useMacSandboxes();

describe("fleet-promote.sh when the Mac goes away, at every call", () => {
  it("the whole Mac side killed at EVERY call it makes to the server, before and after the call: never a PASS without the decider's record, and the server is never left to a second decider", async () => {
    // How many calls a passing promote makes.
    const ref = await setup();
    const refHead = headRev(ref);
    const refStart = sshCount(ref);
    expect(promote(ref, [refHead, "--owner-approved", yes(refHead)]).status).toBe(0);
    const calls = sshCount(ref) - refStart;
    expect(calls).toBeGreaterThan(15);
    // Every call by its number; and, because how many times the Mac reads the journal before the
    // decider is ready depends on the machine, the one call everything hinges on by what it is:
    // the delivery of the evidence, killed just before it and just after it.
    const EVIDENCE = "/evidence.part";
    const points: [number | string, string][] = [];
    for (let n = 1; n <= calls; n++) for (const when of ["before", "after"]) points.push([n, when]);
    for (const when of ["before", "after"]) points.push([EVIDENCE, when]);
    const failures: string[] = [];
    const seen = new Set<string>();
    const queue = points.slice();
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
          const [n, when] = p;
          const e = await setup({ track: false });
          try {
            const head = headRev(e);
            setSsh(e, [typeof n === "number" ? `kill_at=${sshCount(e) + n}` : `kill_match=${n}`, `kill_when=${when}`]);
            const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
            await m.done;
            setSsh(e, []);
            const bad: string[] = [];
            const op = lastOp(e);
            if (!existsSync(join(e.box.fake, "mac.killed"))) {
              // How often the Mac reads the journal while it waits depends on the machine and the
              // moment, so a run can make fewer calls than the reference run did and end, by
              // itself, before the numbered call. That is only right if it ended in a pass.
              if (typeof n !== "number") bad.push("the Mac never made the call that delivers its evidence");
              else if (m.status() !== 0 || !op || field(e.box, op, "done", "outcome") !== "pass") bad.push("the Mac was not killed at that call and did not end in a pass either");
              if (bad.length) failures.push(`call ${n} ${when}: ${bad.join("; ")}\n${m.out().slice(-400)}`);
              continue;
            }
            const log = `${m.out()}\n${macLog(e)}`;
            // Whatever the Mac printed before it died: a PASS needs the decider's finished record.
            if (log.includes("PASS production runs") && !(op && field(e.box, op, "done", "outcome") === "pass")) bad.push("PASS was printed without the decider's done line");
            // The decider goes on alone, by design, and writes into the sandbox until it is done.
            // So every case waits for it to END BY ITSELF, then looks at what it decided: without a
            // go it changes nothing; with a go and no evidence it undoes; with evidence it commits.
            const outcomeWithin = async (seconds: number) => {
              for (let i = 0; i < seconds * 10 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
              return field(e.box, op, "done", "outcome");
            };
            const answersAs = async (build: string) => {
              for (let i = 0; i < 50 && statusNow(e) !== build; i++) await sleep(200);
              return statusNow(e) === build;
            };
            if (op) {
              const sentEvidence = existsSync(join(opDir(e.box, op), "evidence"));
              const sentGo = states(e.box, op).includes("go") || existsSync(join(opDir(e.box, op), "go"));
              if (sentGo && sentEvidence) {
                const outcome = await outcomeWithin(90);
                seen.add(`evidence:${outcome}`);
                if (outcome !== "pass") bad.push(`evidence was delivered, but the outcome is ${outcome || "none"}`);
                else if (!(await answersAs(head))) bad.push("pass, but production does not answer as the new revision");
                if (n === EVIDENCE && when === "before") bad.push("the Mac was killed before it delivered its evidence, yet evidence is there");
              } else if (sentGo) {
                // No evidence will ever come. It finishes the switch if it was still in it, waits
                // its whole window, and undoes: alone, with no second decider.
                const outcome = await outcomeWithin(240);
                seen.add("no-evidence");
                if (states(e.box, op).includes("committed")) bad.push("committed without evidence");
                if (outcome !== "undone") bad.push(`no evidence was delivered, and the decider ended ${outcome || "without an outcome"}, not undone`);
                else if (!(await answersAs(OLD_BUILD))) bad.push("undone, but production does not answer as the previous build");
                if (n === EVIDENCE && when === "after") bad.push("the Mac was killed after it delivered its evidence, yet no evidence is there");
              } else {
                // No go was sent. A decider that was started (it may not have written a line yet
                // when the Mac died) waits for the go, gets none, and changes nothing.
                const waiting = await deciderGone(e, op, 90);
                if (waiting) bad.push(waiting);
                if (states(e.box, op).length === 0) seen.add("never-began");
                else {
                  seen.add(`no-go:${field(e.box, op, "done", "outcome")}`);
                  if (field(e.box, op, "done", "outcome") !== "unchanged") bad.push("no go was sent, but the decider did not end unchanged");
                }
                if (!(await answersAs(OLD_BUILD))) bad.push("no go was sent, but production changed");
              }
              // Nothing of the run may be left when the sandbox is removed.
              const left = await deciderGone(e, op, 30);
              if (left) bad.push(left);
            } else {
              seen.add("never-began");
              if (statusNow(e) !== OLD_BUILD) bad.push("the decider never began, but production changed");
            }
            if (bad.length) failures.push(`call ${n} ${when}: ${bad.join("; ")}\n${m.out().slice(-400)}`);
          } finally {
            destroy(e);
          }
        }
      }),
    );
    expect(failures).toEqual([]);
    expect([...seen].sort()).toEqual(["evidence:pass", "never-began", "no-evidence", "no-go:unchanged"]);
    destroy(ref);
    all.splice(all.indexOf(ref), 1);
  });
});
