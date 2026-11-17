import { createHash } from "node:crypto";

/** The only local lookup admitted by an unattended status window. No paths or peer text. */
export interface ListenerStatusSnapshot {
  source: "listener-status";
  observedAtMs: number;
  deviceVersion: string;
  coreVersion: string;
  mode: "basic" | "correspondence";
  pending: number;
  unknown: number;
  queuedReplies: number;
}

export interface ListenerStatusContext extends ListenerStatusSnapshot {
  sha256: string;
}

export function listenerStatusContext(snapshot: ListenerStatusSnapshot): ListenerStatusContext {
  const bytes = JSON.stringify([
    snapshot.source,
    snapshot.observedAtMs,
    snapshot.deviceVersion,
    snapshot.coreVersion,
    snapshot.mode,
    snapshot.pending,
    snapshot.unknown,
    snapshot.queuedReplies,
  ]);
  return { ...snapshot, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export function parseListenerStatusContext(value: unknown): ListenerStatusContext {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "coreVersion,deviceVersion,mode,observedAtMs,pending,queuedReplies,sha256,source,unknown" ||
    !("source" in value) ||
    value.source !== "listener-status" ||
    !("observedAtMs" in value) ||
    !count(value.observedAtMs) ||
    !("deviceVersion" in value) ||
    !version(value.deviceVersion) ||
    !("coreVersion" in value) ||
    !version(value.coreVersion) ||
    !("mode" in value) ||
    (value.mode !== "basic" && value.mode !== "correspondence") ||
    !("pending" in value) ||
    !count(value.pending) ||
    !("unknown" in value) ||
    !count(value.unknown) ||
    !("queuedReplies" in value) ||
    !count(value.queuedReplies) ||
    !("sha256" in value) ||
    typeof value.sha256 !== "string"
  )
    throw Error("invalid-local-status");
  const parsed = listenerStatusContext({
    source: value.source,
    observedAtMs: value.observedAtMs,
    deviceVersion: value.deviceVersion,
    coreVersion: value.coreVersion,
    mode: value.mode,
    pending: value.pending,
    unknown: value.unknown,
    queuedReplies: value.queuedReplies,
  });
  if (parsed.sha256 !== value.sha256) throw Error("invalid-local-status");
  return parsed;
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function version(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value);
}
