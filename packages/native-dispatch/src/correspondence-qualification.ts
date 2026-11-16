import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  CLAUDE_CORRESPONDENCE_QUALIFIED,
  CORRESPONDENCE_TRACE_DIRECTORY,
  deepFreeze,
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

function frozenCopy(
  entries: readonly QualifiedClaudeCorrespondence[],
): readonly QualifiedClaudeCorrespondence[] {
  return deepFreeze(
    entries.map((e) => ({
      nativeVersion: String(e.nativeVersion),
      model: String(e.model),
      binarySHA256: String(e.binarySHA256),
      traceSHA256: String(e.traceSHA256),
      trace: String(e.trace),
    })),
  );
}
/** The gate reads only this frozen internal copy, taken when the module loads. */
let active = frozenCopy(CLAUDE_CORRESPONDENCE_QUALIFIED);

/**
 * TEST ONLY. Replaces the active allowlist, and returns a function that restores the shipped one.
 * The package's main entry does not export this; only the `@core/native-dispatch/testing` subpath
 * does, so production code that imports the main entry cannot reach it.
 */
export function replaceCorrespondenceAllowlistForTesting(
  entries: readonly QualifiedClaudeCorrespondence[],
): () => void {
  active = frozenCopy(entries);
  return () => {
    active = frozenCopy(CLAUDE_CORRESPONDENCE_QUALIFIED);
  };
}

/** Claude versions a correspondence plan, dispatcher and duty window may use: the allowlist's. */
export function qualifiedCorrespondenceVersions(): string[] {
  return active.map((e) => e.nativeVersion);
}
/** A well-formed Claude version, the only kind a qualification plan may name. */
export function isClaudeVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(value);
}

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
  expected: { model: string; nativeVersion: string; binarySHA256: string },
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

/**
 * Correspondence gate for one pinned profile. It needs an allowlist entry with this exact version,
 * binary SHA-256 and model, whose embedded trace matches the entry's trace SHA-256, records the same
 * binary, and replays as accepted through the real frame checker with the profile's model and
 * version (so a trace copied to another version is refused). The binary's own reported version is
 * checked separately by checkNativeProfile. Anything else is `native-profile-unqualified`.
 */
export function checkCorrespondenceQualification(
  profile: Pick<SubscriptionCanaryProfile, "provider" | "nativeVersion" | "binarySHA256" | "model">,
  allowlist: readonly QualifiedClaudeCorrespondence[] = active,
): void {
  const entry = allowlist.find(
    (e) =>
      e.nativeVersion === profile.nativeVersion &&
      e.binarySHA256 === profile.binarySHA256 &&
      e.model === profile.model,
  );
  if (
    profile.provider !== "claude-code" ||
    !entry ||
    sha256(entry.trace) !== entry.traceSHA256 ||
    checkCorrespondenceTraceBytes(entry.trace, {
      model: profile.model,
      nativeVersion: profile.nativeVersion,
      binarySHA256: profile.binarySHA256,
    }) !== undefined
  )
    throw Error("native-profile-unqualified");
}
