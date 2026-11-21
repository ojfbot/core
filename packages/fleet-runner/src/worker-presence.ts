import type { ClaimDecision, PowerSource } from "./claim-policy.js";
import {
  HANDLERS,
  safeStatusError,
  type ELIGIBILITY,
  type PHASES,
  type WorkerObservation,
} from "./status.js";

type Phase = (typeof PHASES)[number];
type Eligibility = (typeof ELIGIBILITY)[number];

export interface PresenceInput {
  /** The worker's own state word, as written to its status file. */
  state: string;
  claiming: ClaimDecision;
  power: PowerSource;
  /** Kinds currently offered for claiming. */
  kinds: readonly string[];
  /** Kind to reason code, for kinds held back. */
  unavailable: Readonly<Record<string, string>>;
  errorCode?: string;
}

function phase(state: string, claiming: ClaimDecision): Phase {
  switch (state) {
    case "starting":
      return "starting";
    case "working":
      return "running";
    case "paused":
      // Only an operator pause is "paused"; a local rule such as battery leaves the worker idle.
      return claiming.reason === "service-paused" ? "paused" : "idle";
    case "policy-error":
    case "request-error":
      return "request-error";
    default:
      return "idle"; // idle, completed, failed, lease-lost, released
  }
}

function eligibility(input: PresenceInput): Eligibility {
  switch (input.claiming.reason) {
    case "power-battery":
      return "battery";
    case "power-unknown":
      return "power-unknown";
    case "outside-window":
      return "outside-window";
    case "exception-expired":
      return input.power === "battery" ? "battery" : "outside-window";
    case "policy-error":
      return "policy-error";
    case "service-paused":
      return "operator-paused";
    case "ok":
      break;
  }
  if (input.state === "policy-error") return "policy-error";
  if (input.kinds.length > 0) return "eligible";
  const reasons = Object.values(input.unavailable);
  if (reasons.some((reason) => reason === "gpu-busy" || reason === "resource-busy"))
    return "resource-busy";
  if (reasons.includes("handler-pin-mismatch")) return "helper-changed";
  return "unsupported-worker";
}

/**
 * What this worker tells the service about itself. It uses the service's closed vocabulary, so it
 * carries no job, path, input or message text. Handlers outside that vocabulary are not listed.
 */
export function observationOf(input: PresenceInput): WorkerObservation {
  const code = phase(input.state, input.claiming);
  return {
    schemaVersion: 1,
    phase: code,
    eligibility: eligibility(input),
    handlers: HANDLERS.filter((handler) => input.kinds.includes(handler)),
    busy: input.state === "working",
    ...(code === "request-error"
      ? { errorCode: safeStatusError(input.errorCode) ? input.errorCode : "unexpected-error" }
      : {}),
  };
}
