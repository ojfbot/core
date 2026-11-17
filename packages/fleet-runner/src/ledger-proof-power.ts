import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { canonicalJson } from "./jobs.js";
import {
  integer,
  object,
  privatePath,
  proofHash,
  readPrivateJson,
  type LedgerProof,
} from "./ledger-proof.js";
import { parseProofCommand, runProofCommand, type ProofCommand } from "./ledger-proof-command.js";

interface PowerPlan {
  proof: LedgerProof;
  wakeAtMs: number;
  directory: string;
  protectedProbe: ProofCommand;
}
export function parsePowerPlan(value: unknown, proof: LedgerProof): PowerPlan {
  const r = object(value),
    wakeAtMs = integer(r.wakeAtMs);
  if (
    wakeAtMs < proof.startsAtMs + 390_000 ||
    wakeAtMs > proof.startsAtMs + 450_000 ||
    wakeAtMs >= proof.endsAtMs - 60_000
  )
    throw Error("proof-wake-time-mismatch");
  return {
    proof,
    wakeAtMs,
    directory: privatePath(r.directory),
    protectedProbe: parseProofCommand(r.protectedProbe),
  };
}
const pmset = (args: string[], limit = 1024 * 1024): string =>
  execFileSync("/usr/bin/pmset", args, { encoding: "utf8", timeout: 10_000, maxBuffer: limit });
const privileged = (args: string[]): void => {
  execFileSync("/usr/bin/sudo", ["-n", "/usr/bin/pmset", ...args], {
    stdio: "ignore",
    timeout: 10_000,
  });
};
const owner = (plan: PowerPlan) => `cg307-u1-${plan.proof.proofId}`;
function dateString(time: number, fullYear: boolean): string {
  const d = new Date(time),
    pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${fullYear ? d.getFullYear() : pad(d.getFullYear() % 100)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function ownWake(plan: PowerPlan, schedule: string): boolean {
  const lines = schedule.split("\n").filter((line) => line.includes(`by '${owner(plan)}'`));
  return lines.length === 1 && lines[0]!.includes(`wake at ${dateString(plan.wakeAtMs, true)}`);
}
function scheduleWithoutOwn(plan: PowerPlan, schedule: string): string {
  return schedule
    .split("\n")
    .filter((line) => !line.includes(`by '${owner(plan)}'`))
    .map((line) => line.replace(/^\s*\[\d+\]/, "[event]"))
    .join("\n");
}
async function protectedReady(plan: PowerPlan): Promise<Record<string, unknown>> {
  const result = object(
    await runProofCommand(plan.protectedProbe, { proofId: plan.proof.proofId }),
  );
  if (
    result.proofId !== plan.proof.proofId ||
    result.protectedIdle !== true ||
    result.baselineUnchanged !== true ||
    Math.abs(Date.now() - integer(result.observedAtMs)) > 10_000
  )
    throw Error("proof-protected-work-held");
  return result;
}
/** One root-authorized schedule entry, with exact cancellation selector. No general power setting is written. */
export async function prepareProofWake(plan: PowerPlan): Promise<unknown> {
  if (
    process.platform !== "darwin" ||
    Date.now() >= plan.proof.startsAtMs ||
    !pmset(["-g", "cap"]).includes("sleep")
  )
    throw Error("proof-wake-not-ready");
  await protectedReady(plan);
  const privilege = spawnSync(
    "/usr/bin/sudo",
    [
      "-n",
      "-l",
      "--",
      "/usr/bin/pmset",
      "schedule",
      "wake",
      dateString(plan.wakeAtMs, false),
      owner(plan),
    ],
    { stdio: "ignore", timeout: 5000 },
  );
  if (privilege.error || privilege.status !== 0) throw Error("proof-wake-privilege-unavailable");
  const file = join(plan.directory, "power-baseline.json");
  if (existsSync(file)) throw Error("proof-wake-already-prepared");
  const schedule = pmset(["-g", "sched"]),
    policy = pmset(["-g", "custom"]);
  if (schedule.includes(owner(plan))) throw Error("proof-wake-selector-conflict");
  const baseline = {
    proofId: plan.proof.proofId,
    wakeAtMs: plan.wakeAtMs,
    owner: owner(plan),
    schedule,
    policy,
  };
  writeFileSync(file, `${canonicalJson(baseline)}\n`, { flag: "wx", mode: 0o600 });
  // If this effect becomes unknown, retain the baseline and refuse another schedule attempt.
  privileged(["schedule", "wake", dateString(plan.wakeAtMs, false), owner(plan)]);
  const after = pmset(["-g", "sched"]);
  if (
    !ownWake(plan, after) ||
    scheduleWithoutOwn(plan, after) !== scheduleWithoutOwn(plan, schedule) ||
    pmset(["-g", "custom"]) !== policy
  )
    throw Error("proof-wake-readback-mismatch");
  writeFileSync(
    join(plan.directory, "wake-prepared.json"),
    `${canonicalJson({ proofId: plan.proof.proofId, wakeAtMs: plan.wakeAtMs, baselineSha256: proofHash(canonicalJson(baseline)) })}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return { prepared: true, proofId: plan.proof.proofId, wakeAtMs: plan.wakeAtMs };
}
function appAbsent(name: string): boolean {
  const result = spawnSync("/usr/bin/pgrep", ["-x", name], { encoding: "utf8", timeout: 5000 });
  if (result.error || (result.status !== 0 && result.status !== 1))
    throw Error("proof-process-inventory-unavailable");
  return result.status === 1;
}
export async function proofHostProbe(plan: PowerPlan, primary: boolean): Promise<unknown> {
  const session = execFileSync("/usr/sbin/ioreg", ["-n", "Root", "-d1"], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  const protectedWork = await protectedReady(plan);
  const prepared = existsSync(join(plan.directory, "wake-prepared.json"))
    ? object(readPrivateJson(join(plan.directory, "wake-prepared.json")))
    : {};
  return {
    proofId: plan.proof.proofId,
    observedAtMs: Date.now(),
    loggedIn: session.includes('"kCGSessionLoginDoneKey"=Yes'),
    screenLocked: session.includes('"CGSSessionScreenIsLocked"=Yes'),
    appsClosed: ["ChatGPT", "Codex", "Claude", "claude", "codex"].every(appAbsent),
    protectedIdle: protectedWork.protectedIdle === true,
    ac: pmset(["-g", "batt"]).includes("'AC Power'"),
    wakeReady:
      !primary ||
      (prepared.proofId === plan.proof.proofId &&
        prepared.wakeAtMs === plan.wakeAtMs &&
        ownWake(plan, pmset(["-g", "sched"]))),
  };
}
export function sleepEvents(log: string, afterMs: number): { sleepAtMs: number; wakeAtMs: number } {
  const rows = log.split("\n").flatMap((line) => {
    const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})\s+(Sleep|Wake)\s/.exec(line);
    if (!m) return [];
    const at = Date.parse(`${m[1]}T${m[2]}${m[3]!.slice(0, 3)}:${m[3]!.slice(3)}`);
    return at >= afterMs - 1000 ? [{ type: m[4], at }] : [];
  });
  const sleeps = rows.filter((row) => row.type === "Sleep"),
    wakes = rows.filter((row) => row.type === "Wake");
  if (sleeps.length !== 1 || wakes.length !== 1 || wakes[0]!.at <= sleeps[0]!.at)
    throw Error("proof-os-sleep-evidence-missing");
  return { sleepAtMs: sleeps[0]!.at, wakeAtMs: wakes[0]!.at };
}
export async function runProofSleep(plan: PowerPlan, input: unknown): Promise<unknown> {
  const row = object(input);
  if (
    row.proofId !== plan.proof.proofId ||
    row.deadlineMs !== plan.proof.endsAtMs ||
    Date.now() >= plan.proof.endsAtMs ||
    plan.wakeAtMs - Date.now() < 360_000 ||
    plan.wakeAtMs - Date.now() > 450_000
  )
    throw Error("proof-sleep-margin-held");
  const renewal = object(row.renewal);
  if (Date.now() - integer(renewal.started) > 10_000) throw Error("proof-renewal-not-fresh");
  const ready = object(await proofHostProbe(plan, true));
  if (
    ready.appsClosed !== true ||
    ready.screenLocked !== true ||
    ready.loggedIn !== true ||
    ready.ac !== true ||
    ready.wakeReady !== true
  )
    throw Error("proof-sleep-readiness-held");
  const baseline = object(readPrivateJson(join(plan.directory, "power-baseline.json")));
  if (baseline.proofId !== plan.proof.proofId || baseline.policy !== pmset(["-g", "custom"]))
    throw Error("proof-power-policy-drift");
  const effect = join(plan.directory, "sleep-started.json");
  const started = Date.now();
  writeFileSync(effect, `${canonicalJson({ proofId: plan.proof.proofId, started })}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  privileged(["sleepnow"]);
  while (Date.now() < plan.wakeAtMs + 2000) await delay(1000);
  if (Date.now() >= plan.proof.endsAtMs) throw Error("proof-sleep-deadline");
  const observed = sleepEvents(pmset(["-g", "log"], 16 * 1024 * 1024), started);
  const schedule = pmset(["-g", "sched"]);
  if (schedule.includes(owner(plan))) {
    if (!ownWake(plan, schedule)) throw Error("proof-wake-selector-mismatch");
    privileged(["schedule", "cancel", "wake", dateString(plan.wakeAtMs, false), owner(plan)]);
  }
  const remaining = pmset(["-g", "sched"]),
    protectedWork = await protectedReady(plan);
  const result = {
    proofId: plan.proof.proofId,
    ...observed,
    osSleepObserved: true,
    osWakeObserved: true,
    wakeEntryRemoved: !remaining.includes(owner(plan)),
    powerPolicyUnchanged: baseline.policy === pmset(["-g", "custom"]),
    protectedServicesUnchanged: protectedWork.baselineUnchanged === true,
  };
  if (scheduleWithoutOwn(plan, String(baseline.schedule)) !== scheduleWithoutOwn(plan, remaining))
    throw Error("proof-schedule-baseline-changed");
  writeFileSync(join(plan.directory, "sleep-result.json"), `${canonicalJson(result)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return result;
}
