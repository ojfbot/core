export type Provider = "codex" | "claude-code";

export interface NativeProfile {
  revision: string;
  provider: Provider;
  nativeVersion: string;
  model: string;
}

export interface DutyBinding {
  alias: string;
  revision: string;
  deviceId: string;
  provider: Provider;
  nativeSessionId: string;
  cwd: string;
  profileRevision: string;
  resources: string[];
  held: boolean;
  /** "fresh-per-dispatch" (correspondence only): Core mints nativeSessionId per dispatch. */
  sessionPolicy?: "initial-fixed" | "existing-fixed" | "fresh-per-dispatch";
}

export type DutyWorkflow = "advisory-review" | "correspondence";

/** Owner-supplied configuration, never inferred from the signed peer message. */
export interface DispatchGrant {
  charterId: string;
  revision: string;
  bindingAlias: string;
  operation: "native-resume" | "native-fresh";
  workflow: DutyWorkflow;
  mode: "mechanical" | "supervised";
  resources: string[];
  validFromMs: number;
  expiresAtMs: number;
  maxInvocations: number;
  budgetScope: string;
  scopeMaxInvocations: number;
  held: boolean;
}

/** Only identifiers reach the native session. No message body, argv or executable is accepted. */
export interface DispatchRequest {
  deliveryId: string;
  streamId: string;
  eventId: string;
  messageId: string;
  threadId: string;
  sequence: number;
  recipient: string;
  bindingRevision: string;
  charterId: string;
  grantRevision: string;
  profileRevision: string;
  workflow: DutyWorkflow;
  resources: string[];
  task: { input: string; inputDigest: string };
}

export type RefusalReason =
  | "invalid-request"
  | "unassigned"
  | "binding-mismatch"
  | "profile-mismatch"
  | "grant-mismatch"
  | "held"
  | "not-yet-valid"
  | "expired"
  | "resource-denied"
  | "budget-exhausted"
  | "delivery-conflict"
  | "live-not-armed"
  | "standing-hourly-limit"
  | "standing-daily-limit"
  | "standing-clock-rollback"
  | "standing-effect-conflict"
  | "standing-origin-denied"
  | "standing-policy-revoked"
  | "standing-policy-changed"
  | "standing-policy-missing";

export type NativeOutcome =
  | "completed"
  | "failed"
  | "interrupted"
  | "approval-blocked"
  | "authentication-blocked";

export type DispatchDisposition =
  | { kind: "refused"; reason: RefusalReason }
  | { kind: "busy"; reason: "session-busy"; dispatchId: string }
  | {
      kind: "unknown";
      reason: "invocation-unresolved";
      dispatchId: string;
      nativeSessionId: string;
      nativeTurnId: string | null;
    }
  | {
      kind: "observed";
      dispatchId: string;
      nativeSessionId: string;
      nativeTurnId: string | null;
      outcome: NativeOutcome;
    };

export interface NativeEvidence {
  dispatchId: string;
  nativeSessionId: string;
  nativeTurnId: string | null;
  outcome: NativeOutcome;
}

export type DispatcherStatus = {
  schemaVersion: 1;
  active: number;
  unknown: number;
  reservations: number;
} & (
  | { mode: "mechanical"; realProviderCalls: 0 }
  | { mode: "supervised"; realProviderCalls: null }
);
