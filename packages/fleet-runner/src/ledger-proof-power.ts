import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
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
function shellQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
/** The authorized root command reads only a revocation flag and touches only this exact wake selector. */
export function wakeAuthorization(plan: PowerPlan): {
  command: string;
  cleanupAtMs: number;
  flag: string;
} {
  const selector = owner(plan),
    date = dateString(plan.wakeAtMs, false);
  if (
    !/^cg307-u1-[a-f0-9-]{36}$/.test(selector) ||
    !/^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(date)
  )
    throw Error("proof-wake-selector-mismatch");
  const flag = join(plan.directory, "wake-active"),
    cleanupAtMs = plan.wakeAtMs + 5000;
  const cleanup = `left=600; while [ "$left" -gt 0 ] && [ -e ${shellQuote(flag)} ] && [ "$(/bin/date +%s)" -lt ${Math.floor(cleanupAtMs / 1000)} ]; do /bin/sleep 1; left=$((left-1)); done; exec /usr/bin/pmset schedule cancel wake ${shellQuote(date)} ${shellQuote(selector)}`;
  const command = `set -e; remaining=$((${Math.floor(plan.wakeAtMs / 1000)} - $(/bin/date +%s))); if [ "$remaining" -lt 360 ] || [ "$remaining" -gt 570 ]; then exit 1; fi; /usr/bin/pmset schedule wake ${shellQuote(date)} ${shellQuote(selector)}; /bin/sh -c ${shellQuote(cleanup)} </dev/null >/dev/null 2>&1 & /usr/bin/printf %s "$!"`;
  return { command, cleanupAtMs, flag };
}
function cleanupProcess(plan: PowerPlan, pid: number): boolean {
  const result = spawnSync("/bin/ps", ["-ww", "-p", String(pid), "-o", "uid=,command="], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return false;
  return (
    /^\s*0\s/.test(result.stdout) &&
    result.stdout.includes(owner(plan)) &&
    result.stdout.includes("/bin/sh -c") &&
    result.stdout.includes("/usr/bin/pmset schedule cancel wake")
  );
}
function cleanupGone(plan: PowerPlan): boolean {
  const file = join(plan.directory, "wake-prepared.json");
  if (!existsSync(file)) return false;
  const pid = integer(object(readPrivateJson(file)).cleanupPid);
  const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "pid="], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error || (result.status !== 0 && result.status !== 1))
    throw Error("proof-cleanup-process-unobservable");
  return result.status === 1;
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
  const authorization = wakeAuthorization(plan);
  writeFileSync(authorization.flag, `${plan.proof.proofId}\n`, { flag: "wx", mode: 0o600 });
  // Only this pre-arm action can prompt. The native run never depends on cached sudo tickets.
  let prepared = false;
  try {
    const script = `do shell script ${JSON.stringify(authorization.command)} with administrator privileges without altering line endings`;
    const pidText = execFileSync("/usr/bin/osascript", ["-e", script], {
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 1024,
    }).trim();
    if (!/^[1-9][0-9]{0,8}$/.test(pidText) || !cleanupProcess(plan, Number(pidText)))
      throw Error("proof-wake-cleanup-unverified");
    if (Date.now() >= plan.proof.startsAtMs) throw Error("proof-wake-preparation-too-late");
    const after = pmset(["-g", "sched"]);
    if (
      !ownWake(plan, after) ||
      scheduleWithoutOwn(plan, after) !== scheduleWithoutOwn(plan, schedule) ||
      pmset(["-g", "custom"]) !== policy
    )
      throw Error("proof-wake-readback-mismatch");
    writeFileSync(
      join(plan.directory, "wake-prepared.json"),
      `${canonicalJson({ proofId: plan.proof.proofId, wakeAtMs: plan.wakeAtMs, baselineSha256: proofHash(canonicalJson(baseline)), cleanupPid: Number(pidText), cleanupAtMs: authorization.cleanupAtMs, authorizationSha256: proofHash(authorization.command) })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    prepared = true;
    return { prepared: true, proofId: plan.proof.proofId, wakeAtMs: plan.wakeAtMs };
  } finally {
    if (!prepared && existsSync(authorization.flag)) unlinkSync(authorization.flag);
  }
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
        ownWake(plan, pmset(["-g", "sched"])) &&
        cleanupProcess(plan, integer(prepared.cleanupPid))),
  };
}
export function sleepEvents(
  log: string,
  afterMs: number,
): { sleepAtMs: number; wakeAtMs: number; wakeReason: string } {
  const rows = log.split("\n").flatMap((line) => {
    const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})\s+(Sleep|Wake)\s/.exec(line);
    if (!m) return [];
    const at = Date.parse(`${m[1]}T${m[2]}${m[3]!.slice(0, 3)}:${m[3]!.slice(3)}`);
    return at >= afterMs - 1000 ? [{ type: m[4], at, line }] : [];
  });
  const sleeps = rows.filter((row) => row.type === "Sleep"),
    wakes = rows.filter((row) => row.type === "Wake");
  if (sleeps.length !== 1 || wakes.length !== 1 || wakes[0]!.at <= sleeps[0]!.at)
    throw Error("proof-os-sleep-evidence-missing");
  const reason = /due to (.{1,120}?)(?: Using |$)/.exec(wakes[0]!.line)?.[1];
  if (!reason || !/(?:RTC|Alarm)/i.test(reason)) throw Error("proof-wake-reason-mismatch");
  return { sleepAtMs: sleeps[0]!.at, wakeAtMs: wakes[0]!.at, wakeReason: reason };
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
  if (
    Date.now() >= plan.proof.endsAtMs ||
    plan.wakeAtMs - Date.now() < 360_000 ||
    Date.now() - integer(renewal.started) > 10_000
  )
    throw Error("proof-sleep-authority-expired");
  pmset(["sleepnow"]);
  while (Date.now() < plan.wakeAtMs + 2000) await delay(1000);
  if (Date.now() >= plan.proof.endsAtMs) throw Error("proof-sleep-deadline");
  const observed = sleepEvents(pmset(["-g", "log"], 16 * 1024 * 1024), started);
  if (Math.abs(observed.wakeAtMs - plan.wakeAtMs) > 15_000) throw Error("proof-wake-time-mismatch");
  const authorization = wakeAuthorization(plan);
  if (existsSync(authorization.flag)) unlinkSync(authorization.flag);
  const cleanupDeadline = Math.min(plan.proof.endsAtMs, authorization.cleanupAtMs + 5000);
  while (
    (pmset(["-g", "sched"]).includes(owner(plan)) || !cleanupGone(plan)) &&
    Date.now() < cleanupDeadline
  )
    await delay(500);
  const remaining = pmset(["-g", "sched"]),
    protectedWork = await protectedReady(plan);
  const result = {
    proofId: plan.proof.proofId,
    ...observed,
    osSleepObserved: true,
    osWakeObserved: true,
    scheduledWakeMatched: true,
    wakeEntryRemoved: !remaining.includes(owner(plan)) && cleanupGone(plan),
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

/** Stop-only cancellation also works before a worker has been launched. */
export async function cancelProofWake(plan: PowerPlan): Promise<unknown> {
  const authorization = wakeAuthorization(plan);
  if (existsSync(authorization.flag)) unlinkSync(authorization.flag);
  const end = Date.now() + 10_000;
  while ((pmset(["-g", "sched"]).includes(owner(plan)) || !cleanupGone(plan)) && Date.now() < end)
    await delay(250);
  if (pmset(["-g", "sched"]).includes(owner(plan)) || !cleanupGone(plan))
    throw Error("proof-wake-cleanup-unverified");
  const baselineFile = join(plan.directory, "power-baseline.json");
  if (
    existsSync(baselineFile) &&
    object(readPrivateJson(baselineFile)).policy !== pmset(["-g", "custom"])
  )
    throw Error("proof-power-policy-drift");
  return { proofId: plan.proof.proofId, cancelled: true, wakeEntryRemoved: true };
}
