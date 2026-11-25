// What the decider's test files share: the invariant every interrupted run must end in, the kill
// and recover helpers, and the pool the sweeps run their sandboxes in. EVERYTHING HERE IS SYNTHETIC.
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import {
  type Box,
  HAND_NAME,
  completeLines,
  deciderAsync,
  destroyBox,
  dockerLog,
  field,
  liveGroups,
  lockIsFree,
  makeBox,
  newOp,
  opDir,
  playMac,
  reality,
  records,
  revOf,
  run,
  sleep,
  startDecider,
  states,
} from "./promote-harness.js";

/** Sandboxes that are removed after each test of the file that calls this. Returns the maker. */
export function useBoxes() {
  const boxes: Box[] = [];
  afterEach(() => {
    for (const b of boxes.splice(0)) destroyBox(b);
  });
  return (opts: Parameters<typeof makeBox>[0] = {}) => {
    const b = makeBox(opts);
    boxes.push(b);
    return b;
  };
}

export const POOL = Math.max(2, Math.min(8, availableParallelism() - 1));
export const CHANGING = /^(stop|start|rm|run|compose .* up)\b/;
export const OLD_IMAGE = `sha256:${"0".repeat(63)}1`;
export const HAND = { image: OLD_IMAGE, name: HAND_NAME };
export const LINE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ [a-z-]+( \S+=\S*)*$/;

/** Engine calls that disrupt production, from line <from> of the fake's log on: a stop, a start, a removal, a Compose up, or a helper that may write. */
export const disruptive = (b: Box, from = 0) =>
  dockerLog(b)
    .slice(from)
    .filter((l) => /^(stop|start|rm|compose .* up)\b/.test(l) || (/^run\b/.test(l) && !l.includes(":ro ")));
/** Run fn over items, <limit> at a time. Every item is run to its end before the first error is thrown, so nothing is left running behind a failed test. */
export async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
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
export async function passed(b: Box, rev = revOf(1)) {
  const op = newOp(b, { rev });
  const r = await run(b, op);
  if (r.status !== 0) throw new Error(`the setup promote did not pass: ${r.out}`);
  return op;
}
export const nextPlan = (b: Box, prev: string, rev: string) => ({ rev, kind: "compose" as const, prevOp: prev, prevCfg: field(b, prev, "verified", "cfg") });

/**
 * THE invariant after any interruption and recover: production is exactly one of
 *  - the new revision, with a committed record, or
 *  - the previous production, with an undo record,
 * and the record matches what the engine and the folders show. Returns what is wrong, if anything.
 * An operation that halted has no terminal outcome and so never satisfies it.
 */
export function wrong(b: Box, op: string, prev: { image: string; name?: string }, newImage: string): string[] {
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
export function killAll(b: Box, op: string, pid: number) {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, "SIGKILL");
    } catch {}
  }
  // Its steps that are still running: checked by the guard by start time, never a recorded number alone.
  for (const pgid of liveGroups(join(opDir(b, op), "groups"))) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {}
  }
}
/** recover until it no longer halts (a late engine effect may make one attempt halt), at most 4 times. */
export async function recoverUntilDone(b: Box, op: string) {
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
export async function killedAt(b: Box, op: string, state: string) {
  const s = startDecider(b, op, "run");
  await playMac(b, op, { vanish: (st) => st.includes(state) }, () => false);
  killAll(b, op, s.pid);
  await s.done;
}
