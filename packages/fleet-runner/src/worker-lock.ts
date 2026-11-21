import { randomUUID } from "node:crypto";
import {
  closeSync,
  linkSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

/**
 * A local lock file owned by one live process. It is used for a worker identity (a second client
 * for the same identity is refused) and for a shared resource slot (one job holds the GPU).
 * Creation is atomic. A lock whose owner has died is taken over under a short-lived guard file.
 */
export interface Lock {
  release(): void;
}

interface Holder {
  raw: string;
  pid?: number;
  token?: string;
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

function read(file: string): Holder | undefined {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value !== null &&
      typeof value === "object" &&
      Number.isSafeInteger((value as { pid?: unknown }).pid) &&
      typeof (value as { token?: unknown }).token === "string"
    )
      return {
        raw,
        pid: (value as { pid: number }).pid,
        token: (value as { token: string }).token,
      };
  } catch {
    /* An unreadable lock has no live owner. */
  }
  return { raw };
}

const owned = (holder: Holder) => holder.pid !== undefined && alive(holder.pid);

/** True while a live process holds this lock. */
export function lockHeld(file: string): boolean {
  const holder = read(file);
  return holder !== undefined && owned(holder);
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

/** Take the lock, or return undefined when a live process holds it. Never waits. */
export function acquireLock(file: string): Lock | undefined {
  const token = randomUUID();
  const temp = `${file}.${token}.tmp`;
  writeFileSync(temp, JSON.stringify({ pid: process.pid, token }), { flag: "wx", mode: 0o600 });
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
