import { existsSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { digest, isIdentifier, object, parseDispatchRequest } from "./admission.js";
import { prepareSubscriptionCanary } from "./canary.js";
import { openSupervisedDispatcher } from "./dispatcher.js";
import {
  checkBinary,
  checkNativeProfile,
  checkPrivateDirectory,
  readPrivateFile,
} from "./supervised-files.js";
import { createSupervisedTransport } from "./supervised-native.js";
import type {
  PreparedSupervisedCanary,
  SupervisedCanaryHold,
  SupervisedCanaryOpen,
  SupervisedCanaryOptions,
} from "./supervised-types.js";

export function prepareSupervisedSubscriptionCanary(value: unknown): PreparedSupervisedCanary {
  if (
    !object(value) ||
    !object(value.supervision) ||
    value.supervision.kind !== "owner-attended" ||
    value.supervision.codexHostFileReadRiskAccepted !== true
  )
    throw Error("invalid-supervised-plan");
  const base = prepareSubscriptionCanary(value);
  const plan = {
    ...base.plan,
    supervision: { kind: "owner-attended" as const, codexHostFileReadRiskAccepted: true as const },
  };
  return {
    mode: "supervised-prepared",
    liveEligible: false,
    plan,
    planDigest: digest(JSON.stringify(plan)),
  };
}

const holdCodes: SupervisedCanaryHold[] = [
  "runtime-approval-missing",
  "runtime-approval-invalid",
  "window-not-active",
  "device-mismatch",
  "unsafe-local-state",
  "acl-unqualified",
  "binary-pin-mismatch",
  "native-profile-unqualified",
];

/** Only this local owner-window boundary can construct the built-in real transport. */
export function openSupervisedSubscriptionCanary(
  options: SupervisedCanaryOptions,
): SupervisedCanaryOpen {
  const prepared = prepareSupervisedSubscriptionCanary(options.prepared.plan);
  if (
    prepared.planDigest !== options.prepared.planDigest ||
    options.prepared.mode !== "supervised-prepared"
  )
    throw Error("canary-plan-changed");
  const { plan, planDigest } = prepared,
    now = options.now ?? Date.now;
  function inspect():
    | { kind: "held"; hold: SupervisedCanaryHold }
    | { kind: "approved"; startsAtMs: number; expiresAtMs: number } {
    try {
      if (!isIdentifier(options.deviceId) || plan.deviceId !== options.deviceId)
        throw Error("device-mismatch");
      if (!existsSync(options.runtimeApprovalFile)) throw Error("runtime-approval-missing");
      const approval: unknown = JSON.parse(
        readPrivateFile(options.runtimeApprovalFile, 8192).toString("utf8"),
      );
      if (
        !object(approval) ||
        approval.kind !== "owner-approved-supervised-canary" ||
        approval.planDigest !== planDigest ||
        approval.windowId !== plan.windowId ||
        approval.deviceId !== plan.deviceId ||
        !Number.isSafeInteger(approval.startsAtMs) ||
        !Number.isSafeInteger(approval.expiresAtMs) ||
        typeof approval.startsAtMs !== "number" ||
        typeof approval.expiresAtMs !== "number" ||
        approval.expiresAtMs - approval.startsAtMs !== 1800000 ||
        typeof approval.ownerNativeApprovalRef !== "string" ||
        !approval.ownerNativeApprovalRef ||
        approval.ownerNativeApprovalRef.length > 512
      )
        throw Error("runtime-approval-invalid");
      if (now() < approval.startsAtMs || now() >= approval.expiresAtMs)
        throw Error("window-not-active");
      checkPrivateDirectory(dirname(options.stateFile));
      if (existsSync(options.stateFile)) readPrivateFile(options.stateFile, 16777216);
      for (const b of plan.bindings) {
        checkPrivateDirectory(b.cwd);
        if (readdirSync(b.cwd).length !== 0) throw Error("unsafe-local-state");
      }
      for (const p of plan.profiles) {
        checkBinary(p);
        checkNativeProfile(p);
      }
      if (now() >= approval.expiresAtMs) throw Error("window-not-active");
      return {
        kind: "approved",
        startsAtMs: approval.startsAtMs,
        expiresAtMs: approval.expiresAtMs,
      };
    } catch (error) {
      const code = error instanceof Error ? holdCodes.find((c) => c === error.message) : undefined;
      return { kind: "held", hold: code ?? "runtime-approval-invalid" };
    }
  }
  const approval = inspect();
  if (approval.kind === "held") return { kind: "held", planDigest, holds: [approval.hold] };
  const transport = createSupervisedTransport(
    prepared,
    dirname(options.stateFile),
    approval.expiresAtMs,
    now,
  );
  const dispatcher = openSupervisedDispatcher({
    stateFile: options.stateFile,
    now,
    profiles: plan.profiles,
    bindings: plan.bindings.map((b) => ({ ...b, held: false })),
    grants: plan.bindings.map((b) => ({
      charterId: plan.windowId,
      revision: digest(JSON.stringify([planDigest, b.alias])),
      bindingAlias: b.alias,
      operation: "native-resume",
      workflow: "advisory-review",
      mode: "supervised",
      resources: b.resources,
      validFromMs: approval.startsAtMs,
      expiresAtMs: approval.expiresAtMs,
      maxInvocations: 1,
      budgetScope: `subscription-canary:${plan.windowId}:${plan.deviceId}`,
      scopeMaxInvocations: 2,
      held: false,
    })),
    transport,
    beforeInvoke: () => {
      const result = inspect();
      return result.kind === "held"
        ? result.hold === "window-not-active"
          ? "expired"
          : "held"
        : undefined;
    },
  });
  return {
    kind: "ready",
    planDigest,
    dispatcher: {
      ...dispatcher,
      dispatch: async (input, settings) => {
        let request;
        try {
          request = parseDispatchRequest(input);
        } catch {
          return { kind: "refused", reason: "invalid-request" };
        }
        if (
          ![request.streamId, request.eventId, request.messageId, request.threadId].every((s) =>
            /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s),
          )
        )
          return { kind: "refused", reason: "invalid-request" };
        return dispatcher.dispatch(request, settings);
      },
    },
  };
}
