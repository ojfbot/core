import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { replayCorrespondenceTrace } from "./correspondence-frames.js";
import { parseCorrespondenceAnswer, parseCorrespondencePacket } from "./correspondence-protocol.js";
import type { CorrespondencePacket } from "./correspondence-types.js";
import type { DispatchRequest } from "./types.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";

const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

/** One Claude Code version qualified for correspondence by a committed, replayable trace. */
export interface QualifiedClaudeCorrespondence {
  nativeVersion: string;
  /** SHA-256 of the pinned Claude binary, as the plan's profile pins it. */
  binarySHA256: string;
  /** SHA-256 of `qualification/claude/<nativeVersion>.trace.json`, as committed. */
  traceSHA256: string;
}

/**
 * The correspondence allowlist. A version is qualified only by an entry here AND its committed
 * trace. To add a version after recording its trace with `scripts/qualify-claude-correspondence.mjs`
 * and committing it, add one entry. No real trace exists yet, so 2.1.286 and 2.1.308 are refused.
 */
export const CLAUDE_CORRESPONDENCE_QUALIFIED: readonly QualifiedClaudeCorrespondence[] = [];

/** `qualification/claude/` in this package (beside `src/` and `dist/`). */
export const CORRESPONDENCE_TRACE_DIRECTORY = fileURLToPath(
  new URL("../qualification/claude/", import.meta.url),
);
const TRACE_MAX_BYTES = 1048576;

export function correspondenceTracePath(
  nativeVersion: string,
  directory = CORRESPONDENCE_TRACE_DIRECTORY,
): string {
  if (!/^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(nativeVersion)) throw Error("native-profile-unqualified");
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

/** Replays trace bytes and checks the answer against the fixed packet. Returns the refusal, if any. */
export function checkCorrespondenceTraceBytes(bytes: Buffer | string): string | undefined {
  let trace: unknown;
  try {
    trace = JSON.parse(bytes.toString());
  } catch {
    return "invalid-frame";
  }
  const verdict = replayCorrespondenceTrace(trace);
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
 * through the real frame checker. Anything else is `native-profile-unqualified`.
 */
export function checkCorrespondenceQualification(
  profile: Pick<SubscriptionCanaryProfile, "provider" | "nativeVersion" | "binarySHA256">,
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
  if (sha256(bytes) !== entry.traceSHA256 || checkCorrespondenceTraceBytes(bytes) !== undefined)
    throw Error("native-profile-unqualified");
}
