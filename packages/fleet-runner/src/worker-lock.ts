import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A local lock file owned by one live process. It is used for a worker identity (a second client
 * for the same identity is refused) and for a shared resource slot (one job holds the GPU).
 * Creation is atomic. A lock whose owner has died, or whose process id now belongs to a different
 * process, is taken over under a short-lived guard file.
 */
export interface Lock {
  release(): void;
}

/** A lock could not be examined or written. Carries a code only, never a path or message. */
export class LockUnavailableError extends Error {
  readonly code = "lock-unavailable";
  constructor() {
    super("lock-unavailable");
    this.name = "LockUnavailableError";
  }
}

interface Holder {
  raw: string;
  pid?: number;
  token?: string;
  start?: string;
}

const GUARD_STALE_MS = 30_000;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * An opaque stamp for when a process started (and, on Linux, in which boot). Two different processes
 * never share a stamp for the same process id, so it tells the owner of a lock from a stranger that
 * reuses its number after a crash or reboot. Undefined when it cannot be read.
 */
export function processStart(pid: number): string | undefined {
  try {
    if (process.platform === "linux") {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      const boot = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
      return fields[19] ? `${boot}:${fields[19]}` : undefined;
    }
    const out = execFileSync("/bin/ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2_000,
      env: { LC_ALL: "C", PATH: "/bin:/usr/bin" },
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

function read(file: string): Holder | undefined {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new LockUnavailableError();
  }
  try {
    const value = JSON.parse(raw) as { pid?: unknown; token?: unknown; start?: unknown } | null;
    if (value && Number.isSafeInteger(value.pid) && typeof value.token === "string")
      return {
        raw,
        pid: value.pid as number,
        token: value.token,
        ...(typeof value.start === "string" ? { start: value.start } : {}),
      };
  } catch {
    /* An unreadable lock has no live owner. */
  }
  return { raw };
}

/** Live means the process exists and, when we know when it started, it is still that same process. */
function owned(holder: Holder): boolean {
  if (holder.pid === undefined || !alive(holder.pid)) return false;
  if (holder.start === undefined) return true;
  const now = processStart(holder.pid);
  return now === undefined || now === holder.start; // Cannot tell: assume it is still the owner.
}

/** True while a live process holds this lock. A lock that cannot be examined counts as held. */
export function lockHeld(file: string): boolean {
  try {
    const holder = read(file);
    return holder !== undefined && owned(holder);
  } catch {
    return true;
  }
}

function removeStale(file: string, stale: Holder): boolean {
  const guard = `${file}.takeover`;
  try {
    closeSync(openSync(guard, "wx", 0o600));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    try {
      if (Date.now() - statSync(guard).mtimeMs > GUARD_STALE_MS) unlinkSync(guard);
    } catch {
      /* Someone else finished first. */
    }
    return false;
  }
  try {
    // Only the guard holder may remove, and only the very lock it judged to be dead.
    if (read(file)?.raw === stale.raw) unlinkSync(file);
    return true;
  } finally {
    unlinkSync(guard);
  }
}

/**
 * A real folder that only this user can write, created if missing. A link, a folder owned by
 * someone else or one that others can write is refused.
 */
export function lockDirectory(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const info = lstatSync(dir);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.mode & 0o022 ||
      (process.getuid !== undefined && info.uid !== process.getuid())
    )
      throw new Error("unsafe");
  } catch {
    throw new LockUnavailableError();
  }
}

/**
 * Take the lock, or return undefined when a live process holds it. Never waits. Any other failure,
 * such as an unreadable file or a folder that cannot be written, is a LockUnavailableError.
 */
export function acquireLock(file: string): Lock | undefined {
  try {
    return tryAcquire(file);
  } catch (error) {
    throw error instanceof LockUnavailableError ? error : new LockUnavailableError();
  }
}

function tryAcquire(file: string): Lock | undefined {
  const token = randomUUID();
  const temp = `${file}.${token}.tmp`;
  const start = processStart(process.pid);
  writeFileSync(temp, JSON.stringify({ pid: process.pid, token, ...(start ? { start } : {}) }), {
    flag: "wx",
    mode: 0o600,
  });
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        linkSync(temp, file);
        return {
          release() {
            try {
              if (read(file)?.token === token) unlinkSync(file);
            } catch {
              /* Already gone. */
            }
          },
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const holder = read(file);
      if (!holder) continue;
      if (owned(holder) || !removeStale(file, holder)) return undefined;
    }
    return undefined;
  } finally {
    try {
      unlinkSync(temp);
    } catch {
      /* Best effort. */
    }
  }
}

/**
 * Where this user's locks and slots live on this host unless settings say otherwise: one fixed folder
 * per user, so every config for the same worker finds the same lock whatever its own paths are.
 */
export const defaultLockRoot = (): string =>
  join(tmpdir(), `fleet-runner-${process.getuid?.() ?? "user"}`);

/** One lock per worker identity on a host, wherever its settings, token or status files are. */
export const identityLockPath = (root: string, worker: string): string =>
  join(root, `${worker}.identity.lock`);
