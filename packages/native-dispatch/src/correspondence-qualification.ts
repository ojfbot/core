import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import {
  CLAUDE_CORRESPONDENCE_QUALIFIED,
  CORRESPONDENCE_TRACE_DIRECTORY,
} from "./correspondence-allowlist.js";
import type { QualifiedClaudeCorrespondence } from "./correspondence-allowlist.js";
import { replayCorrespondenceTrace } from "./correspondence-frames.js";
import { parseCorrespondenceAnswer, parseCorrespondencePacket } from "./correspondence-protocol.js";
import type { CorrespondencePacket } from "./correspondence-types.js";
import type { DispatchRequest } from "./types.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";

const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

export { CLAUDE_CORRESPONDENCE_QUALIFIED, CORRESPONDENCE_TRACE_DIRECTORY };
export type { QualifiedClaudeCorrespondence };

/** Claude versions a correspondence plan, dispatcher and duty window may use: the allowlist's. */
export function qualifiedCorrespondenceVersions(): string[] {
  return CLAUDE_CORRESPONDENCE_QUALIFIED.map((e) => e.nativeVersion);
}
/** A well-formed Claude version, the only kind a qualification plan may name. */
export function isClaudeVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(value);
}
const TRACE_MAX_BYTES = 1048576;

export function correspondenceTracePath(
  nativeVersion: string,
  directory = CORRESPONDENCE_TRACE_DIRECTORY,
): string {
  if (!isClaudeVersion(nativeVersion)) throw Error("native-profile-unqualified");
  return join(directory, `${nativeVersion}.trace.json`);
}

/**
 * The fixed, built-in qualification packet. It holds no HelpDesk data. Qualification runs exactly
 * one turn on these bytes, and a committed trace must answer this packet.
 */
export const CORRESPONDENCE_QUALIFICATION_PACKET = JSON.stringify({
  kind: "correspondence-packet",
  version: 1,
  duty: { device_id: "qualification", session_id: "qualification-duty" },
  request: {
    message_id: "00000000-0000-4000-8000-00000000a001",
    thread_id: "00000000-0000-4000-8000-00000000a000",
    sequence: 1,
    subject: "Correspondence qualification",
    sender: { device_id: "qualification", session_id: null },
    body: "This is a fixed qualification packet. Reply with one short sentence confirming that you received it.",
  },
  thread: [],
  omitted: { earlier_messages: 0, truncated_bodies: 0 },
  context_round: { used: 0, limit: 3 },
  best_effort: false,
});
export const CORRESPONDENCE_QUALIFICATION_PACKET_SHA256 = sha256(
  CORRESPONDENCE_QUALIFICATION_PACKET,
);

/** The packet-only request shape parseCorrespondenceAnswer needs for the fixed packet. */
function qualificationRequest(): { request: DispatchRequest; packet: CorrespondencePacket } {
  const packet = parseCorrespondencePacket(CORRESPONDENCE_QUALIFICATION_PACKET);
  return {
    packet,
    request: {
      workflow: "correspondence",
      task: {
        input: CORRESPONDENCE_QUALIFICATION_PACKET,
        inputDigest: CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
      },
    } as DispatchRequest,
  };
}

/**
 * Replays trace bytes against the pinned model and version, and checks the answer against the fixed
 * packet. Returns the refusal, if any.
 */
export function checkCorrespondenceTraceBytes(
  bytes: Buffer | string,
  expected: { model: string; nativeVersion: string },
): string | undefined {
  let trace: unknown;
  try {
    trace = JSON.parse(bytes.toString());
  } catch {
    return "invalid-frame";
  }
  const verdict = replayCorrespondenceTrace(trace, expected);
  if (verdict.kind === "refused") return verdict.reason;
  if (verdict.kind === "failed") return "result-error";
  const { request, packet } = qualificationRequest();
  try {
    parseCorrespondenceAnswer(verdict.structuredOutput, request, packet);
  } catch {
    return "invalid-agent-proposal";
  }
  return undefined;
}

function readTrace(path: string): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.size > TRACE_MAX_BYTES) throw Error("native-profile-unqualified");
    const bytes = Buffer.alloc(s.size);
    let size = 0,
      n = 0;
    while (size < s.size && (n = readSync(fd, bytes, size, s.size - size, null)) > 0) size += n;
    return bytes.subarray(0, size);
  } finally {
    closeSync(fd);
  }
}

/**
 * Correspondence gate for one pinned profile: an allowlist entry for this exact version and binary,
 * and a committed trace whose bytes match the pinned trace SHA-256 and which replays as accepted
 * through the real frame checker with the profile's model and version. The binary's own reported
 * version is checked separately by checkNativeProfile. Anything else is
 * `native-profile-unqualified`.
 */
export function checkCorrespondenceQualification(
  profile: Pick<SubscriptionCanaryProfile, "provider" | "nativeVersion" | "binarySHA256" | "model">,
  allowlist: readonly QualifiedClaudeCorrespondence[] = CLAUDE_CORRESPONDENCE_QUALIFIED,
  directory = CORRESPONDENCE_TRACE_DIRECTORY,
): void {
  const entry = allowlist.find(
    (e) => e.nativeVersion === profile.nativeVersion && e.binarySHA256 === profile.binarySHA256,
  );
  if (profile.provider !== "claude-code" || !entry) throw Error("native-profile-unqualified");
  let bytes: Buffer;
  try {
    bytes = readTrace(correspondenceTracePath(entry.nativeVersion, directory));
  } catch {
    throw Error("native-profile-unqualified");
  }
  // The trace's init must report this exact version (= entry = plan profile) and the plan's model.
  if (
    sha256(bytes) !== entry.traceSHA256 ||
    checkCorrespondenceTraceBytes(bytes, {
      model: profile.model,
      nativeVersion: profile.nativeVersion,
    }) !== undefined
  )
    throw Error("native-profile-unqualified");
}
