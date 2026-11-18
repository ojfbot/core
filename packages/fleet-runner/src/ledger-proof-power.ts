import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { canonicalJson } from "./jobs.js";
import {
  exact,
  integer,
  string,
  object,
  privatePath,
  proofHash,
  readPrivateJson,
  type LedgerProof,
} from "./ledger-proof.js";
import { parseProofCommand, runProofCommand, type ProofCommand } from "./ledger-proof-command.js";

interface WakeRequest {
  proofId: string;
  approvalExpiresAtMs: number;
  wakeAtMs: number;
  directory: string;
  protectedProbe: ProofCommand;
}

interface PowerPlan extends WakeRequest {
  proof: LedgerProof;
}

export const AUTHORIZATION_TIMEOUT_MS = 120_000;
export const WAKE_RESERVATION_SECONDS = 1500;
export const MIN_WAKE_LEAD_SECONDS = 1200;
export const MAX_WAKE_LEAD_SECONDS = 1560;
const SCHEDULE_CHECK_MARGIN_MS = 5_000;

export function parseWakeRequest(value: unknown): WakeRequest {
  const r = exact(value, [
    "proofId",
    "approvalExpiresAtMs",
    "wakeAtMs",
    "directory",
    "protectedProbe",
  ]);
  const request = {
    proofId: string(
      r.proofId,
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    ),
    approvalExpiresAtMs: integer(r.approvalExpiresAtMs),
    wakeAtMs: integer(r.wakeAtMs),
    directory: privatePath(r.directory),
    protectedProbe: parseProofCommand(r.protectedProbe),
  };
  if (request.wakeAtMs % 1000 !== 0 || request.wakeAtMs + 60_000 >= request.approvalExpiresAtMs)
    throw Error("proof-wake-time-mismatch");
  return request;
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
    proofId: proof.proofId,
    approvalExpiresAtMs: proof.approvalExpiresAtMs,
    wakeAtMs,
    directory: privatePath(r.directory),
    protectedProbe: parseProofCommand(r.protectedProbe),
  };
}
const pmset = (args: string[], limit = 1024 * 1024): string =>
  execFileSync("/usr/bin/pmset", args, { encoding: "utf8", timeout: 10_000, maxBuffer: limit });

const owner = (plan: WakeRequest) => `cg307-u1-${plan.proofId}`;
function dateString(time: number, fullYear: boolean): string {
  const d = new Date(time),
    pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${fullYear ? d.getFullYear() : pad(d.getFullYear() % 100)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function ownWake(plan: WakeRequest, schedule: string): boolean {
  const lines = schedule.split("\n").filter((line) => line.includes(`by '${owner(plan)}'`));
  return lines.length === 1 && lines[0]!.includes(`wake at ${dateString(plan.wakeAtMs, true)}`);
}
export function scheduleWithoutOwn(plan: WakeRequest, schedule: unknown): string {
  if (typeof schedule !== "string" || schedule.includes("\0"))
    throw Error("proof-schedule-baseline-changed");
  return schedule
    .split("\n")
    .filter((line) => {
      const text = line.trim();
      return (
        text !== "" &&
        text !== "Scheduled power events:" &&
        text !== "No scheduled events." &&
        !line.includes(`by '${owner(plan)}'`)
      );
    })
    .map((line) => line.replace(/^\s*\[\d+\]/, "[event]"))
    .join("\n");
}
async function protectedReady(plan: WakeRequest): Promise<Record<string, unknown>> {
  const result = object(await runProofCommand(plan.protectedProbe, { proofId: plan.proofId }));
  if (
    result.proofId !== plan.proofId ||
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
export function wakeAuthorization(plan: WakeRequest): {
  command: string;
  cleanup: string;
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
  const wakeSeconds = Math.floor(plan.wakeAtMs / 1000);
  const deadline = wakeSeconds - MIN_WAKE_LEAD_SECONDS;
  const earliest = wakeSeconds - MAX_WAKE_LEAD_SECONDS;
  const cancel = `/usr/bin/pmset schedule cancel wake ${shellQuote(date)} ${shellQuote(selector)}`;
  const cleanup = `left=${MAX_WAKE_LEAD_SECONDS + 10}; while [ "$left" -gt 0 ] && [ -e ${shellQuote(flag)} ] && [ "$(/bin/date +%s)" -lt ${Math.floor(cleanupAtMs / 1000)} ]; do /bin/sleep 1; left=$((left-1)); done; exec ${cancel}`;
  const command = [
    "now=$(/bin/date +%s) || exit 1",
    `if [ "$now" -lt ${earliest} ] || [ "$now" -gt ${deadline} ] || [ ! -e ${shellQuote(flag)} ]; then /usr/bin/printf '%s' window; exit 0; fi`,
    `/bin/sh -c ${shellQuote(cleanup)} </dev/null >/dev/null 2>&1 & cleanup_pid=$!`,
    `if ! /usr/bin/pmset schedule wake ${shellQuote(date)} ${shellQuote(selector)} >/dev/null; then /usr/bin/printf '%s' schedule; exit 0; fi`,
    `if [ ! -e ${shellQuote(flag)} ]; then ${cancel} >/dev/null 2>&1; /usr/bin/printf '%s' window; exit 0; fi`,
    '/usr/bin/printf "%s" "$cleanup_pid"',
  ].join("; ");
  return { command, cleanup, cleanupAtMs, flag };
}
function rootShellCommand(line: string): string | undefined {
  return /^\s*0\s+(?:\/bin\/)?sh -c (.*)$/.exec(line.trimEnd())?.[1];
}
function cleanupProcess(plan: WakeRequest, pid: number): boolean {
  const result = spawnSync("/bin/ps", ["-ww", "-p", String(pid), "-o", "uid=,command="], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return false;
  return rootShellCommand(result.stdout) === wakeAuthorization(plan).cleanup;
}
export function hasWakeHelper(plan: WakeRequest, inventory: string): boolean {
  const { command, cleanup } = wakeAuthorization(plan);
  return inventory.split("\n").some((line) => {
    const shell = rootShellCommand(line);
    return (
      shell === command ||
      shell === cleanup ||
      line.trim().replace(/^0\s+/, "0 ") ===
        `0 /usr/bin/pmset schedule cancel wake ${dateString(plan.wakeAtMs, false)} ${owner(plan)}`
    );
  });
}
function cleanupGone(plan: WakeRequest): boolean {
  const result = spawnSync("/bin/ps", ["-ww", "-axo", "uid=,command="], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw Error("proof-cleanup-process-unobservable");
  return !hasWakeHelper(plan, result.stdout);
}
export function wakePreparationMatches(
  plan: WakeRequest,
  prepared: unknown,
  baseline: unknown,
): boolean {
  const receipt = object(prepared),
    savedBaseline = object(baseline),
    authorization = wakeAuthorization(plan);
  return (
    [receipt, savedBaseline].every(
      (saved) =>
        saved.proofId === plan.proofId &&
        saved.approvalExpiresAtMs === plan.approvalExpiresAtMs &&
        saved.wakeAtMs === plan.wakeAtMs,
    ) &&
    savedBaseline.owner === owner(plan) &&
    typeof savedBaseline.schedule === "string" &&
    typeof savedBaseline.policy === "string" &&
    Number.isSafeInteger(receipt.cleanupPid) &&
    Number(receipt.cleanupPid) > 0 &&
    receipt.baselineSha256 === proofHash(canonicalJson(baseline)) &&
    receipt.authorizationSha256 === proofHash(authorization.command) &&
    receipt.cleanupAtMs === authorization.cleanupAtMs
  );
}
/** One root-authorized schedule entry, with exact cancellation selector. No general power setting is written. */
export async function prepareProofWake(plan: WakeRequest): Promise<unknown> {
  if (
    process.platform !== "darwin" ||
    plan.wakeAtMs + 60_000 >= plan.approvalExpiresAtMs ||
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
    proofId: plan.proofId,
    approvalExpiresAtMs: plan.approvalExpiresAtMs,
    wakeAtMs: plan.wakeAtMs,
    owner: owner(plan),
    schedule,
    policy,
  };
  writeFileSync(file, `${canonicalJson(baseline)}\n`, { flag: "wx", mode: 0o600 });
  // If this effect becomes unknown, retain the baseline and refuse another schedule attempt.
  const authorization = wakeAuthorization(plan);
  writeFileSync(authorization.flag, `${plan.proofId}\n`, { flag: "wx", mode: 0o600 });
  // Only this pre-arm action can prompt. The native run never depends on cached sudo tickets.
  let prepared = false;
  try {
    if (
      Date.now() +
        AUTHORIZATION_TIMEOUT_MS +
        MIN_WAKE_LEAD_SECONDS * 1000 +
        SCHEDULE_CHECK_MARGIN_MS >
      plan.wakeAtMs
    )
      throw Error("proof-wake-approval-window-too-short");
    const script = `do shell script ${JSON.stringify(authorization.command)} with administrator privileges without altering line endings`;
    const result = spawnSync("/usr/bin/osascript", ["-e", script], {
      encoding: "utf8",
      timeout: AUTHORIZATION_TIMEOUT_MS,
      maxBuffer: 8192,
    });
    const pidText = (result.stdout ?? "").trim();
    const cleanupPid = /^[1-9][0-9]{0,8}$/.test(pidText) ? Number(pidText) : null;
    const errorNumber = (result.stderr ?? "").match(/\((-?\d{1,6})\)\s*$/)?.[1];
    const outcome =
      result.error && "code" in result.error && result.error.code === "ETIMEDOUT"
        ? "proof-wake-authorization-timeout"
        : result.error || result.status !== 0
          ? "proof-wake-authorization-failed"
          : pidText === "window"
            ? "proof-wake-approval-window-missed"
            : pidText === "schedule"
              ? "proof-wake-schedule-refused"
              : "proof-wake-authorization-returned";
    writeFileSync(
      join(plan.directory, "wake-authorization-result.json"),
      `${canonicalJson({ outcome, status: result.status, signal: result.signal, errorNumber: errorNumber ? Number(errorNumber) : null, cleanupPid })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    if (outcome !== "proof-wake-authorization-returned") throw Error(outcome);
    if (cleanupPid === null || !cleanupProcess(plan, cleanupPid))
      throw Error("proof-wake-cleanup-unverified");
    if (plan.wakeAtMs - Date.now() < (MIN_WAKE_LEAD_SECONDS - 5) * 1000)
      throw Error("proof-wake-preparation-too-late");
    const after = pmset(["-g", "sched"]);
    if (
      !ownWake(plan, after) ||
      scheduleWithoutOwn(plan, after) !== scheduleWithoutOwn(plan, schedule) ||
      pmset(["-g", "custom"]) !== policy
    )
      throw Error("proof-wake-readback-mismatch");
    writeFileSync(
      join(plan.directory, "wake-prepared.json"),
      `${canonicalJson({ proofId: plan.proofId, approvalExpiresAtMs: plan.approvalExpiresAtMs, wakeAtMs: plan.wakeAtMs, baselineSha256: proofHash(canonicalJson(baseline)), cleanupPid, cleanupAtMs: authorization.cleanupAtMs, authorizationSha256: proofHash(authorization.command) })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    prepared = true;
    return { prepared: true, proofId: plan.proofId, wakeAtMs: plan.wakeAtMs };
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
export function verifiedProofWake(plan: WakeRequest): boolean {
  const { flag } = wakeAuthorization(plan),
    preparedFile = join(plan.directory, "wake-prepared.json"),
    baselineFile = join(plan.directory, "power-baseline.json");
  if (![flag, preparedFile, baselineFile].every(existsSync)) return false;
  const prepared = object(readPrivateJson(preparedFile)),
    baseline = object(readPrivateJson(baselineFile)),
    schedule = pmset(["-g", "sched"]);
  return (
    wakePreparationMatches(plan, prepared, baseline) &&
    readFileSync(flag, "utf8") === `${plan.proofId}\n` &&
    ownWake(plan, schedule) &&
    scheduleWithoutOwn(plan, schedule) === scheduleWithoutOwn(plan, baseline.schedule) &&
    baseline.policy === pmset(["-g", "custom"]) &&
    cleanupProcess(plan, integer(prepared.cleanupPid))
  );
}
export async function proofHostProbe(plan: PowerPlan, primary: boolean): Promise<unknown> {
  const session = execFileSync("/usr/sbin/ioreg", ["-n", "Root", "-d1"], {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  const protectedWork = await protectedReady(plan);
  return {
    proofId: plan.proof.proofId,
    observedAtMs: Date.now(),
    loggedIn: session.includes('"kCGSessionLoginDoneKey"=Yes'),
    screenLocked: session.includes('"CGSSessionScreenIsLocked"=Yes'),
    appsClosed: ["ChatGPT", "Codex", "Claude", "claude", "codex"].every(appAbsent),
    protectedIdle: protectedWork.protectedIdle === true,
    ac: pmset(["-g", "batt"]).includes("'AC Power'"),
    wakeReady: !primary || verifiedProofWake(plan),
  };
}
interface ScheduledWakeEvidence {
  wakeAtMs: number;
  foreignSchedule: string;
}

const competingWakeMarginMs = 120_000;
const wakeTypes = /^(wake|poweron|wakeorpoweron|wakepoweron)$/;
const nonWakeTypes = /^(sleep|shutdown)$/;
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function competingWake(schedule: string, wakeAtMs: number, offset: string): boolean {
  const offsetMs =
    (offset[0] === "-" ? -1 : 1) *
    (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4))) *
    60_000;
  const localWake = wakeAtMs + offsetMs;
  const day = new Date(localWake);
  return schedule.split("\n").some((row) => {
    const line = row.trim();
    if (
      !line ||
      /^(?:Repeating power events:|Scheduled power events:|No scheduled events\.)$/.test(line)
    )
      return false;
    const timed =
      /^\[(?:event|\d+)\]\s+(\w+) at (\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d:\d\d)(.*)$/.exec(line);
    if (timed) {
      const [, kind, month, date, year, time, details = ""] = timed;
      if (nonWakeTypes.test(kind ?? "")) return false;
      const civil = `${year}-${month}-${date}T${time}`;
      const at = Date.parse(civil + offset);
      const suffix = /^(?: by '[^']*')?(?: leeway secs: (\d+))?(?: User visible: true)?$/.exec(
        details,
      );
      return (
        !wakeTypes.test(kind ?? "") ||
        !Number.isFinite(at) ||
        new Date(at + offsetMs).toISOString().slice(0, 19) !== civil ||
        !suffix ||
        Math.abs(at - wakeAtMs) <= competingWakeMarginMs + Number(suffix[1] ?? 0) * 1000
      );
    }
    const repeat = /^(\w+) at (\d{1,2}):([0-5]\d)(AM|PM) (.+)$/.exec(line);
    if (!repeat) return true;
    const [, kind, hours, minutes, period, days] = repeat;
    if (nonWakeTypes.test(kind ?? "")) return false;
    if (!wakeTypes.test(kind ?? "") || Number(hours) > 12) return true;
    const hour = (Number(hours) % 12) + (period === "PM" ? 12 : 0);
    return [-1, 0, 1].some((shift) => {
      const at = Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate() + shift,
        hour,
        Number(minutes),
      );
      if (Math.abs(at - localWake) > competingWakeMarginMs) return false;
      const weekday = new Date(at).getUTCDay();
      if (days === "weekdays only") return weekday >= 1 && weekday <= 5;
      if (days === "weekends only") return weekday === 0 || weekday === 6;
      return !weekdays.some((name) => name === days) || weekdays[weekday] === days;
    });
  });
}

export function sleepEvents(log: string, afterMs: number, scheduled?: ScheduledWakeEvidence) {
  const rows = log.split("\n").flatMap((line, index) => {
    const m =
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})\s+(Sleep|Wake|Assertions)\s+(.+)$/.exec(
        line,
      );
    if (!m) return [];
    const offset = `${m[3]?.slice(0, 3)}:${m[3]?.slice(3)}`;
    const at = Date.parse(`${m[1]}T${m[2]}${offset}`);
    return at >= afterMs - 1000 ? [{ type: m[4], at, detail: m[5] ?? "", index, offset }] : [];
  });
  const [sleep, ...otherSleeps] = rows.filter((row) => row.type === "Sleep");
  const [wake, ...otherWakes] = rows.filter((row) => row.type === "Wake");
  if (!sleep || !wake || otherSleeps.length || otherWakes.length || wake.at <= sleep.at)
    throw Error("proof-os-sleep-evidence-missing");
  const reason = /due to (.{1,120}?)(?: Using |$)/.exec(wake.detail)?.[1]?.trim();
  if (!reason) throw Error("proof-wake-reason-mismatch");
  const observed = { sleepAtMs: sleep.at, wakeAtMs: wake.at, wakeReason: reason };
  if (/(?:RTC|Alarm)/i.test(reason)) return observed;
  if (reason !== "HID Activity" || !scheduled) throw Error("proof-wake-reason-mismatch");
  if (sleep.at >= scheduled.wakeAtMs || wake.at < scheduled.wakeAtMs)
    throw Error("proof-wake-time-mismatch");
  // powerd's scheduled-wake callout declares user activity to bring the display up.
  const [assertion, ...otherAssertions] = rows.filter(
    (row) =>
      row.type === "Assertions" &&
      /^PID \d+\(powerd\) Created UserIsActive "com\.apple\.powermanagement\.wakeschedule"(?:\s|$)/.test(
        row.detail,
      ) &&
      row.at >= scheduled.wakeAtMs &&
      row.at <= scheduled.wakeAtMs + 5_000,
  );
  if (otherAssertions.length) throw Error("proof-scheduled-wake-assertion-ambiguous");
  if (
    !assertion ||
    assertion.index >= wake.index ||
    wake.at < assertion.at ||
    wake.at - assertion.at > 2000
  )
    throw Error("proof-scheduled-wake-assertion-missing");
  if (competingWake(scheduled.foreignSchedule, scheduled.wakeAtMs, wake.offset))
    throw Error("proof-wake-ownership-ambiguous");
  return { ...observed, schedulerAssertionAtMs: assertion.at };
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
  const log = pmset(["-g", "log"], 16 * 1024 * 1024);
  let observed;
  try {
    observed = sleepEvents(log, started, {
      wakeAtMs: plan.wakeAtMs,
      foreignSchedule: scheduleWithoutOwn(plan, baseline.schedule),
    });
  } catch (error) {
    if (error instanceof Error && /^proof-[a-z-]+$/.test(error.message)) {
      writeFileSync(
        join(plan.directory, "wake-evidence-held.json"),
        `${canonicalJson({ code: error.message })}\n`,
        { flag: "wx", mode: 0o600 },
      );
    }
    throw error;
  }
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
  if (scheduleWithoutOwn(plan, baseline.schedule) !== scheduleWithoutOwn(plan, remaining))
    throw Error("proof-schedule-baseline-changed");
  writeFileSync(join(plan.directory, "sleep-result.json"), `${canonicalJson(result)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return result;
}

/** Stop-only cancellation also works before a worker has been launched. */
export async function cancelProofWake(plan: WakeRequest): Promise<unknown> {
  const authorization = wakeAuthorization(plan);
  if (existsSync(authorization.flag)) unlinkSync(authorization.flag);
  const end = Date.now() + 10_000;
  while ((pmset(["-g", "sched"]).includes(owner(plan)) || !cleanupGone(plan)) && Date.now() < end)
    await delay(250);
  const remaining = pmset(["-g", "sched"]);
  if (remaining.includes(owner(plan)) || !cleanupGone(plan))
    throw Error("proof-wake-cleanup-unverified");
  const baselineFile = join(plan.directory, "power-baseline.json");
  if (existsSync(baselineFile)) {
    const baseline = object(readPrivateJson(baselineFile));
    if (baseline.policy !== pmset(["-g", "custom"])) throw Error("proof-power-policy-drift");
    if (scheduleWithoutOwn(plan, baseline.schedule) !== scheduleWithoutOwn(plan, remaining))
      throw Error("proof-schedule-baseline-changed");
  }
  return { proofId: plan.proofId, cancelled: true, wakeEntryRemoved: true };
}
