import type { SubscriptionCanaryPlan } from "./canary-types.js";
import type { Dispatcher } from "./dispatcher.js";

export interface SupervisedEnvironment {
  HOME: string;
  CODEX_HOME: string | null;
  TMPDIR: string | null;
}
export interface SupervisedSubscriptionCanaryPlan extends SubscriptionCanaryPlan {
  supervision: { kind: "owner-attended"; codexHostFileReadRiskAccepted: true };
  environment: SupervisedEnvironment;
}
export interface PreparedSupervisedCanary {
  mode: "supervised-prepared";
  plan: SupervisedSubscriptionCanaryPlan;
  planDigest: string;
  liveEligible: false;
}
export type SupervisedCanaryHold =
  | "runtime-approval-missing"
  | "runtime-approval-invalid"
  | "window-not-active"
  | "device-mismatch"
  | "environment-mismatch"
  | "unsafe-local-state"
  | "acl-unqualified"
  | "binary-pin-mismatch"
  | "native-profile-unqualified";
export type SupervisedCanaryOpen =
  | { kind: "held"; planDigest: string; holds: SupervisedCanaryHold[] }
  | { kind: "ready"; planDigest: string; dispatcher: Dispatcher };
export interface SupervisedCanaryOptions {
  prepared: PreparedSupervisedCanary;
  stateFile: string;
  runtimeApprovalFile: string;
  deviceId: string;
}
