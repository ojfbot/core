import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  CLAUDE_CORRESPONDENCE_QUALIFIED,
  CORRESPONDENCE_TRACE_DIRECTORY,
  deepFreeze,
} from "./correspondence-allowlist.js";
import type { QualifiedClaudeCorrespondence } from "./correspondence-allowlist.js";
import {
  replayCorrespondenceTrace,
  replayEmulatedCorrespondenceTrace,
} from "./correspondence-frames.js";
import type { CorrespondenceBuiltins } from "./correspondence-frames.js";
import { parseCorrespondenceAnswer, parseCorrespondencePacket } from "./correspondence-protocol.js";
import type { CorrespondencePacket } from "./correspondence-types.js";
import type { DispatchRequest } from "./types.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";

const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

export { CLAUDE_CORRESPONDENCE_QUALIFIED, CORRESPONDENCE_TRACE_DIRECTORY };
export type { QualifiedClaudeCorrespondence };

/** A pinned name list, copied and sorted; anything but strings becomes a never-matching marker. */
function names(value: unknown): string[] {
  if (!Array.isArray(value)) return ["\u0000invalid"];
  const out: string[] = [];
  for (let i = 0; i < value.length; i++)
    out.push(typeof value[i] === "string" ? value[i] : "\u0000invalid");
  return out.sort();
}

function frozenCopy(
  entries: readonly QualifiedClaudeCorrespondence[],
): readonly QualifiedClaudeCorrespondence[] {
  const copies: QualifiedClaudeCorrespondence[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    copies.push({
      nativeVersion: String(e.nativeVersion),
      model: String(e.model),
      binarySHA256: String(e.binarySHA256),
      traceSHA256: String(e.traceSHA256),
      trace: String(e.trace),
      builtinAgents: names(e.builtinAgents),
      builtinPlugins: names(e.builtinPlugins),
    });
  }
  return deepFreeze(copies);
}
/** The gate reads only this frozen copy of the shipped allowlist, taken when the module loads. */
const SHIPPED = frozenCopy(CLAUDE_CORRESPONDENCE_QUALIFIED);
/** Versions for plan preparation: the shipped ones, or those the test-only hook installed. */
let preparationVersions: readonly string[] = Object.freeze(SHIPPED.map((e) => e.nativeVersion));

/**
 * TEST ONLY. Sets the Claude versions plan preparation accepts, from fixture entries, and returns
 * a function that restores the shipped ones. The package's main entry does not export this; only
 * the `@core/native-dispatch/testing` subpath does. It never touches the gate: the gate reads only
 * the frozen shipped allowlist, so a test can never make a live window accept a version.
 */
export function replaceCorrespondenceAllowlistForTesting(
  entries: readonly QualifiedClaudeCorrespondence[],
): () => void {
  // A plain index loop over a copy: the caller's own `map` or iterator is never called.
  const versions: string[] = [];
  const copy = Array.prototype.slice.call(entries) as unknown[];
  for (let i = 0; i < copy.length; i++)
    versions.push(String((copy[i] as { nativeVersion?: unknown } | null)?.nativeVersion));
  preparationVersions = Object.freeze(versions);
  return () => {
    preparationVersions = Object.freeze(SHIPPED.map((e) => e.nativeVersion));
  };
}

/** Claude versions a correspondence plan, dispatcher and duty window may use: the allowlist's. */
export function qualifiedCorrespondenceVersions(): string[] {
  return [...preparationVersions];
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
  expected: {
    model: string;
    nativeVersion: string;
    binarySHA256: string;
    builtins?: CorrespondenceBuiltins;
  },
): string | undefined {
  return checkTraceBytes(bytes, expected, replayCorrespondenceTrace);
}

/** EMULATION ONLY: the same check for an emulated trace. Nothing it accepts qualifies a version. */
export function checkEmulatedCorrespondenceTraceBytes(
  bytes: Buffer | string,
  expected: {
    model: string;
    nativeVersion: string;
    binarySHA256: string;
    builtins?: CorrespondenceBuiltins;
  },
): string | undefined {
  return checkTraceBytes(bytes, expected, replayEmulatedCorrespondenceTrace);
}

function checkTraceBytes(
  bytes: Buffer | string,
  expected: {
    model: string;
    nativeVersion: string;
    binarySHA256: string;
    builtins?: CorrespondenceBuiltins;
  },
  replay: typeof replayCorrespondenceTrace,
): string | undefined {
  let trace: unknown;
  try {
    trace = JSON.parse(bytes.toString());
  } catch {
    return "invalid-frame";
  }
  const verdict = replay(trace, expected);
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
/**
 * The pinned built-in agents and plugins of the shipped allowlist entry for this profile, or
 * undefined when it has none (the gate then refuses the profile anyway).
 */
export function correspondenceBuiltins(
  profile: Pick<SubscriptionCanaryProfile, "nativeVersion" | "binarySHA256" | "model">,
): CorrespondenceBuiltins | undefined {
  const entry = SHIPPED.find(
    (e) =>
      e.nativeVersion === profile.nativeVersion &&
      e.binarySHA256 === profile.binarySHA256 &&
      e.model === profile.model,
  );
  return entry ? { agents: entry.builtinAgents, plugins: entry.builtinPlugins } : undefined;
}

export function checkCorrespondenceQualification(
  profile: Pick<SubscriptionCanaryProfile, "provider" | "nativeVersion" | "binarySHA256" | "model">,
  allowlist: readonly QualifiedClaudeCorrespondence[] = SHIPPED,
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
    // The entry's pinned built-ins must be exactly the ones its trace recorded.
    checkCorrespondenceTraceBytes(entry.trace, {
      model: profile.model,
      nativeVersion: profile.nativeVersion,
      binarySHA256: profile.binarySHA256,
      builtins: { agents: names(entry.builtinAgents), plugins: names(entry.builtinPlugins) },
    }) !== undefined
  )
    throw Error("native-profile-unqualified");
}
