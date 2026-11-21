import { execFile } from "node:child_process";
import { lstatSync } from "node:fs";
import { isAbsolute } from "node:path";

/**
 * Local rules for when a worker may claim at all, and which kinds this host can honestly offer.
 * Everything here is decided from local settings and local facts. A job never influences it.
 */
export type PowerSource = "ac" | "battery" | "unknown";

export interface TimeWindow {
  /** 0 is Sunday. A window belongs to the day it starts on, even when it ends after midnight. */
  days: number[];
  startMinute: number;
  endMinute: number;
}

export interface PolicyException {
  allow: "outside-window" | "on-battery";
  untilMs: number;
}

export interface ClaimPolicy {
  /** IANA zone name. Window times are read in this zone, so daylight saving is handled by the clock. */
  timezone: string;
  power: "ac-only" | "any";
  windows: TimeWindow[];
  exceptions: PolicyException[];
  /** While this file exists another program is using the GPU. */
  gpuBusyFile?: string;
}

/** What a host must have for a kind to be offered. Checked against the real host, never a job. */
export interface KindRequirements {
  platform?: string;
  arch?: string;
  files?: string[];
}

export type ClaimReason =
  | "ok"
  | "power-battery"
  | "power-unknown"
  | "outside-window"
  | "exception-expired"
  | "policy-error"
  | "service-paused";

export type KindReason = "unsupported-platform" | "unsupported-arch" | "missing-file" | "gpu-busy";

export interface ClaimDecision {
  allowed: boolean;
  reason: ClaimReason;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WHEN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Strict time parsing. `Date.parse` quietly turns 2026-02-31 into 3 March and 24:00 into the next
 * day, which could stretch an exception, so each part is range-checked and the calendar date is
 * confirmed by round trip. Anything invalid throws.
 */
export function strictTime(value: unknown): number {
  const match = typeof value === "string" ? WHEN.exec(value) : null;
  if (!match) throw Error("invalid-claim-policy");
  const [year, month, day, hour, min, sec] = [1, 2, 3, 4, 5, 6].map((i) =>
    Number(match[i] ?? 0),
  ) as [number, number, number, number, number, number];
  const zoneHour = Number(match[9] ?? 0);
  const zoneMinute = Number(match[10] ?? 0);
  if (hour > 23 || min > 59 || sec > 59 || zoneHour > 23 || zoneMinute > 59)
    throw Error("invalid-claim-policy");
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw Error("invalid-claim-policy");
  const offset = (match[8] === "-" ? -1 : 1) * (zoneHour * 60 + zoneMinute) * 60_000;
  const fraction = match[7] ? Math.floor(Number(`0${match[7]}`) * 1000) : 0;
  return date.getTime() + ((hour * 60 + min) * 60 + sec) * 1000 + fraction - offset;
}

function minute(value: unknown): number {
  const match = typeof value === "string" ? CLOCK.exec(value) : null;
  if (!match) throw Error("invalid-claim-policy");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseClaimPolicy(value: unknown): ClaimPolicy {
  if (
    !record(value) ||
    !Object.keys(value).every((key) =>
      ["timezone", "power", "windows", "exceptions", "gpuBusyFile"].includes(key),
    ) ||
    typeof value.timezone !== "string" ||
    (value.power !== undefined && value.power !== "ac-only" && value.power !== "any")
  )
    throw Error("invalid-claim-policy");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.timezone });
  } catch {
    throw Error("invalid-claim-policy");
  }
  const rawWindows = value.windows ?? [];
  const rawExceptions = value.exceptions ?? [];
  if (
    !Array.isArray(rawWindows) ||
    rawWindows.length > 14 ||
    !Array.isArray(rawExceptions) ||
    rawExceptions.length > 8
  )
    throw Error("invalid-claim-policy");
  const windows = rawWindows.map((entry: unknown): TimeWindow => {
    if (
      !record(entry) ||
      !Array.isArray(entry.days) ||
      entry.days.length === 0 ||
      new Set(entry.days).size !== entry.days.length ||
      !entry.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
      throw Error("invalid-claim-policy");
    const startMinute = minute(entry.start);
    const endMinute = minute(entry.end);
    if (startMinute === endMinute) throw Error("invalid-claim-policy");
    return { days: [...(entry.days as number[])], startMinute, endMinute };
  });
  const exceptions = rawExceptions.map((entry: unknown): PolicyException => {
    if (
      !record(entry) ||
      (entry.allow !== "outside-window" && entry.allow !== "on-battery") ||
      typeof entry.until !== "string"
    )
      throw Error("invalid-claim-policy");
    return { allow: entry.allow, untilMs: strictTime(entry.until) };
  });
  if (
    value.gpuBusyFile !== undefined &&
    (typeof value.gpuBusyFile !== "string" ||
      !isAbsolute(value.gpuBusyFile) ||
      value.gpuBusyFile.includes("\0"))
  )
    throw Error("invalid-claim-policy");
  return {
    timezone: value.timezone,
    power: value.power === "any" ? "any" : "ac-only",
    windows,
    exceptions,
    ...(typeof value.gpuBusyFile === "string" ? { gpuBusyFile: value.gpuBusyFile } : {}),
  };
}

export function parseRequirements(value: unknown): KindRequirements {
  if (value === undefined) return {};
  if (
    !record(value) ||
    !Object.keys(value).every((key) => ["platform", "arch", "files"].includes(key)) ||
    (value.platform !== undefined && (typeof value.platform !== "string" || !value.platform)) ||
    (value.arch !== undefined && (typeof value.arch !== "string" || !value.arch)) ||
    (value.files !== undefined &&
      (!Array.isArray(value.files) ||
        value.files.length > 16 ||
        !value.files.every(
          (file): file is string =>
            typeof file === "string" && isAbsolute(file) && !file.includes("\0"),
        )))
  )
    throw Error("invalid-kind-requirements");
  return {
    ...(typeof value.platform === "string" ? { platform: value.platform } : {}),
    ...(typeof value.arch === "string" ? { arch: value.arch } : {}),
    ...(Array.isArray(value.files) ? { files: [...(value.files as string[])] } : {}),
  };
}

/** Day of week (0 is Sunday) and minute of day on the wall clock of `timezone` at that instant. */
export function localClock(nowMs: number, timezone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = Number(get("hour"));
  const min = Number(get("minute"));
  if (day < 0 || !Number.isInteger(hour) || !Number.isInteger(min)) throw Error("policy-clock");
  return { day, minute: hour * 60 + min };
}

function inWindow(windows: readonly TimeWindow[], clock: { day: number; minute: number }) {
  if (windows.length === 0) return true;
  return windows.some(({ days, startMinute, endMinute }) => {
    if (startMinute < endMinute)
      return days.includes(clock.day) && clock.minute >= startMinute && clock.minute < endMinute;
    // Crosses midnight: the evening part belongs to the start day, the morning part to the next.
    return (
      (days.includes(clock.day) && clock.minute >= startMinute) ||
      (days.includes((clock.day + 6) % 7) && clock.minute < endMinute)
    );
  });
}

/** May this worker claim anything right now? Battery or unknown power is refused unless excepted. */
export function decideClaim(policy: ClaimPolicy, power: PowerSource, nowMs: number): ClaimDecision {
  const live = (allow: PolicyException["allow"]) =>
    policy.exceptions.some((entry) => entry.allow === allow && entry.untilMs > nowMs);
  const lapsed = (allow: PolicyException["allow"]) =>
    policy.exceptions.some((entry) => entry.allow === allow && entry.untilMs <= nowMs);
  if (policy.power === "ac-only" && power !== "ac") {
    if (power === "unknown") return { allowed: false, reason: "power-unknown" };
    if (!live("on-battery"))
      return {
        allowed: false,
        reason: lapsed("on-battery") ? "exception-expired" : "power-battery",
      };
  }
  if (!inWindow(policy.windows, localClock(nowMs, policy.timezone)) && !live("outside-window"))
    return {
      allowed: false,
      reason: lapsed("outside-window") ? "exception-expired" : "outside-window",
    };
  return { allowed: true, reason: "ok" };
}

export interface HostFacts {
  platform: string;
  arch: string;
  fileExists(file: string): boolean;
  gpuBusy(): boolean;
}

/** Why this host cannot offer a kind right now, or undefined when it can. */
export function kindUnavailable(
  requires: KindRequirements,
  resource: string | undefined,
  host: HostFacts,
): KindReason | undefined {
  if (requires.platform !== undefined && requires.platform !== host.platform)
    return "unsupported-platform";
  if (requires.arch !== undefined && requires.arch !== host.arch) return "unsupported-arch";
  if (requires.files?.some((file) => !host.fileExists(file))) return "missing-file";
  if (resource === "gpu" && host.gpuBusy()) return "gpu-busy";
  return undefined;
}

/**
 * A busy marker counts as present when anything exists at its path, whatever it is, and also when
 * it cannot be examined for any reason other than being absent. Doubt means busy, never free.
 */
export function markerPresent(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
}

export function realHostFacts(policy: Pick<ClaimPolicy, "gpuBusyFile"> | undefined): HostFacts {
  const exists = (file: string) => {
    try {
      return lstatSync(file).isFile();
    } catch {
      return false;
    }
  };
  return {
    platform: process.platform,
    arch: process.arch,
    fileExists: exists,
    gpuBusy: () => (policy?.gpuBusyFile ? markerPresent(policy.gpuBusyFile) : false),
  };
}

/** Reads the power source from the macOS battery report. Anything else, or any failure, is unknown. */
export function parsePowerSource(report: string): PowerSource {
  if (/Now drawing from 'AC Power'/.test(report)) return "ac";
  if (/Now drawing from 'Battery Power'/.test(report)) return "battery";
  return "unknown";
}

export function readPowerSource(): Promise<PowerSource> {
  if (process.platform !== "darwin") return Promise.resolve("unknown");
  return new Promise((resolve) => {
    execFile(
      "/usr/bin/pmset",
      ["-g", "batt"],
      { encoding: "utf8", timeout: 5_000, maxBuffer: 64 * 1024 },
      (error, stdout) => resolve(error ? "unknown" : parsePowerSource(stdout)),
    );
  });
}
