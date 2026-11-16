import type { Dispatcher } from "./dispatcher.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";
import type { DispatchDisposition, Provider } from "./types.js";
import type { SupervisedCanaryHold, SupervisedEnvironment } from "./supervised-types.js";

/**
 * Correspondence duty (contract v1 with the 15 November amendments, HelpDesk #6141/#6144).
 * A separate plan kind: the advisory subscription canary stays byte-identical for qualification.
 */

export const CORRESPONDENCE_PACKET_MAX_BYTES = 32768;
export const CORRESPONDENCE_TEXT_MAX_BYTES = 8000;
export const CORRESPONDENCE_MAX_TURNS = 40;
export const CORRESPONDENCE_MAX_WINDOW_MS = 5400000;
export const CORRESPONDENCE_REQUEST_TIMEOUT_MS = 120000;

export type CorrespondenceReason =
  | "execution-request"
  | "missing-context"
  | "sensitive-content"
  | "unsupported-request";

/** Built by LocalHelp. Core parses it only to read `best_effort`; it never reads HelpDesk itself. */
export interface CorrespondencePacket {
  kind: "correspondence-packet";
  version: 1;
  duty: { device_id: string; session_id: string };
  request: {
    message_id: string;
    thread_id: string;
    sequence: number;
    subject: string;
    sender: { device_id: string; session_id: string | null };
    body: string;
  };
  thread: Array<{
    message_id: string;
    sequence: number;
    sender: { device_id: string; session_id: string | null };
    body: string;
    truncated: boolean;
  }>;
  omitted: { earlier_messages: number; truncated_bodies: number };
  context_round: { used: number; limit: 3 };
  best_effort: boolean;
}

/** Model output. Every property required; unused ones are null. */
export interface CorrespondenceAnswer {
  packetDigest: string;
  decision: "reply" | "escalate";
  reason: CorrespondenceReason | null;
  text: string;
  needs: string | null;
  gaps: string | null;
}

/**
 * Accepted only when: packetDigest === task.inputDigest; reply ⇒ reason and needs null;
 * escalate ⇒ reason non-null; needs non-null iff reason is "missing-context";
 * packet.best_effort ⇒ reason !== "missing-context"; text ≤ 8000 bytes.
 */
export interface RelayedCorrespondenceProposal {
  attribution: "device-relayed-output";
  source: "supervised-native" | "deterministic-emulator";
  verifiedWork: false;
  correspondence: Omit<CorrespondenceAnswer, "packetDigest">;
}

export interface CorrespondenceBinding {
  alias: string;
  revision: string;
  deviceId: string;
  provider: Provider;
  profileRevision: string;
  /** Core mints a new native session UUID per dispatch and journals it before the native process starts. */
  sessionPolicy: "fresh-per-dispatch";
  cwd: string;
  /** e.g. ["helpdesk:thread:*"] or explicit thread resources. */
  resources: string[];
}

export interface CorrespondencePlan {
  schemaVersion: 1;
  kind: "correspondence";
  revision: string;
  windowId: string;
  deviceId: string;
  /** One or two; at most one per provider. A revoked provider (codex today) is refused. */
  profiles: SubscriptionCanaryProfile[];
  bindings: CorrespondenceBinding[];
  limits: {
    /** 1–40, one budget for the whole window across all bindings. */
    topLevelTurns: number;
    /** ≤ 5,400,000. The approval's expiresAtMs − startsAtMs must equal this exactly. */
    windowMs: number;
    requestTimeoutMs: 120000;
  };
  /** Claude-only: no codexHostFileReadRiskAccepted key, and environment.CODEX_HOME is null. */
  supervision: { kind: "owner-attended"; codexHostFileReadRiskAccepted?: true };
  environment: SupervisedEnvironment;
  declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"];
}

export interface PreparedCorrespondencePlan {
  mode: "correspondence-prepared";
  plan: CorrespondencePlan;
  planDigest: string;
  liveEligible: false;
}

export interface CorrespondenceRuntimeApproval {
  kind: "owner-approved-correspondence-window";
  planDigest: string;
  windowId: string;
  deviceId: string;
  invocationStateFile: string;
  startsAtMs: number;
  expiresAtMs: number;
  ownerNativeApprovalRef: string;
}

/**
 * Dispatch request: as DispatchRequest, with workflow "correspondence", task.input the packet JSON
 * (≤ 32768 UTF-8 bytes) and task.inputDigest its SHA-256 hex. Grants use operation "native-fresh".
 */
export interface CorrespondenceDispatcher extends Omit<Dispatcher, "agentProposal"> {
  dispatch(request: unknown, options?: { signal?: AbortSignal }): Promise<DispatchDisposition>;
  /** Undefined when the turn completed without an accepted proposal (shape, digest or rule failure). */
  agentProposal(deliveryId: string): RelayedCorrespondenceProposal | undefined;
}

export type CorrespondenceOpen =
  | { kind: "held"; planDigest: string; holds: SupervisedCanaryHold[] }
  | { kind: "ready"; planDigest: string; dispatcher: CorrespondenceDispatcher };

export interface CorrespondenceOptions {
  prepared: PreparedCorrespondencePlan;
  stateFile: string;
  runtimeApprovalFile: string;
  deviceId: string;
}
