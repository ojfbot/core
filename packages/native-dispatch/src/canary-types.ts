import type { Dispatcher } from "./dispatcher.js";
import type { DispatchDisposition, DispatchRequest, Provider } from "./types.js";

export interface SubscriptionCanaryProfile {
  provider: Provider;
  revision: string;
  binaryRealPath: string;
  binarySHA256: string;
  nativeVersion: string;
  model: string;
  effort: "low";
  authMode: "existing-subscription";
  customizationPolicy: "none";
}

export interface SubscriptionCanaryBinding {
  alias: string;
  revision: string;
  deviceId: string;
  provider: Provider;
  profileRevision: string;
  nativeSessionId: string;
  sessionPolicy: "initial-fixed" | "existing-fixed";
  cwd: string;
  resources: string[];
}

export interface SubscriptionCanaryPlan {
  schemaVersion: 1;
  revision: string;
  windowId: string;
  deviceId: string;
  fixture: { utf8: string; sha256: string };
  profiles: [SubscriptionCanaryProfile, SubscriptionCanaryProfile];
  bindings: [SubscriptionCanaryBinding, SubscriptionCanaryBinding];
  limits: { topLevelTurns: 2; windowMs: 1800000; requestTimeoutMs: 120000 };
  declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"];
}

export interface CanaryRuntimeApproval {
  kind: "owner-approved-subscription-canary";
  planDigest: string;
  windowId: string;
  deviceId: string;
  startsAtMs: number;
  expiresAtMs: number;
  ownerNativeApprovalRef: string;
}

export type CanaryHold =
  | "runtime-approval-missing"
  | "runtime-approval-invalid"
  | "window-not-active"
  | "binary-pin-mismatch"
  | "codex-no-tools-unsupported"
  | "claude-managed-customization-unqualified";

export interface PreparedSubscriptionCanary {
  mode: "prepared-disabled";
  planDigest: string;
  plan: SubscriptionCanaryPlan;
  liveEligible: false;
  holds: CanaryHold[];
}

export interface CanaryQualification {
  dispatch(
    request: DispatchRequest,
    options?: { signal?: AbortSignal },
  ): Promise<DispatchDisposition>;
  lookup: Dispatcher["lookup"];
  agentProposal: Dispatcher["agentProposal"];
  status: Dispatcher["status"];
  close: Dispatcher["close"];
}
