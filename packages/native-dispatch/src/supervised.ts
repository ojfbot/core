import { createHash } from "node:crypto";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { digest, isIdentifier, object, parseDispatchRequest } from "./admission.js";
import { prepareSubscriptionCanary } from "./canary.js";
import { openSupervisedDispatcher } from "./dispatcher.js";
import {
  checkBinary,
  checkNativeProfile,
  checkNativeEnvironment,
  checkPrivateDirectory,
  nativeEnvironment,
  readPrivateFile,
} from "./supervised-files.js";
import { createSupervisedTransport } from "./supervised-native.js";
import type {
  PreparedSupervisedCanary,
  SupervisedCanaryHold,
  SupervisedCanaryOpen,
  SupervisedCanaryOptions,
} from "./supervised-types.js";

function environmentPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    value.includes("\0") ||
    !isAbsolute(value)
  )
    throw Error("invalid-supervised-plan");
  return value;
}

export function prepareSupervisedSubscriptionCanary(value: unknown): PreparedSupervisedCanary {
  if (
    !object(value) ||
    !object(value.supervision) ||
    value.supervision.kind !== "owner-attended" ||
    value.supervision.codexHostFileReadRiskAccepted !== true ||
    !object(value.environment) ||
    Object.keys(value.environment).length !== 3 ||
    Object.keys(value.environment).some((key) => !["HOME", "CODEX_HOME", "TMPDIR"].includes(key))
  )
    throw Error("invalid-supervised-plan");
  const base = prepareSubscriptionCanary(value);
  const plan = {
    ...base.plan,
    supervision: { kind: "owner-attended" as const, codexHostFileReadRiskAccepted: true as const },
    environment: {
      HOME: environmentPath(value.environment.HOME),
      CODEX_HOME:
        value.environment.CODEX_HOME === null
          ? null
          : environmentPath(value.environment.CODEX_HOME),
      TMPDIR: value.environment.TMPDIR === null ? null : environmentPath(value.environment.TMPDIR),
    },
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
  "environment-mismatch",
  "unsafe-local-state",
  "acl-unqualified",
  "binary-pin-mismatch",
  "native-profile-unqualified",
];

/** Only this local owner-window boundary can construct the built-in real transport. */
export function openSupervisedSubscriptionCanary(
  options: SupervisedCanaryOptions,
): SupervisedCanaryOpen {
  const { prepared: input, stateFile, runtimeApprovalFile, deviceId } = options;
  const prepared = prepareSupervisedSubscriptionCanary(input.plan);
  if (prepared.planDigest !== input.planDigest || input.mode !== "supervised-prepared")
    throw Error("canary-plan-changed");
  const { plan, planDigest } = prepared;
  const environment = nativeEnvironment(plan.environment);
  function readApproval(expectedDigest?: string) {
    if (!existsSync(runtimeApprovalFile)) throw Error("runtime-approval-missing");
    const bytes = readPrivateFile(runtimeApprovalFile, 8192);
    const currentDigest = createHash("sha256").update(bytes).digest("hex");
    if (expectedDigest !== undefined && expectedDigest !== currentDigest)
      throw Error("runtime-approval-invalid");
    const approval: unknown = JSON.parse(bytes.toString("utf8"));
    if (
      !isAbsolute(stateFile) ||
      join(realpathSync(dirname(stateFile)), basename(stateFile)) !== stateFile ||
      !object(approval) ||
      approval.kind !== "owner-approved-supervised-canary" ||
      approval.planDigest !== planDigest ||
      approval.windowId !== plan.windowId ||
      approval.deviceId !== plan.deviceId ||
      approval.invocationStateFile !== stateFile ||
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
    const now = Date.now();
    if (now < approval.startsAtMs || now >= approval.expiresAtMs) throw Error("window-not-active");
    return {
      startsAtMs: approval.startsAtMs,
      expiresAtMs: approval.expiresAtMs,
      digest: currentDigest,
    };
  }
  function inspect(
    expectedDigest?: string,
  ):
    | { kind: "held"; hold: SupervisedCanaryHold }
    | { kind: "approved"; startsAtMs: number; expiresAtMs: number; digest: string } {
    try {
      if (!isIdentifier(deviceId) || plan.deviceId !== deviceId) throw Error("device-mismatch");
      checkNativeEnvironment(environment);
      const approval = readApproval(expectedDigest);
      checkPrivateDirectory(dirname(stateFile));
      if (existsSync(stateFile)) readPrivateFile(stateFile, 16777216);
      for (const b of plan.bindings) {
        checkPrivateDirectory(b.cwd);
        if (readdirSync(b.cwd).length !== 0) throw Error("unsafe-local-state");
      }
      for (const p of plan.profiles) {
        checkBinary(p);
        checkNativeProfile(p, environment);
      }
      const final = readApproval(approval.digest);
      checkNativeEnvironment(environment);
      return { kind: "approved", ...final };
    } catch (error) {
      const code = error instanceof Error ? holdCodes.find((c) => c === error.message) : undefined;
      return { kind: "held", hold: code ?? "runtime-approval-invalid" };
    }
  }
  const approval = inspect();
  if (approval.kind === "held") return { kind: "held", planDigest, holds: [approval.hold] };
  const transport = createSupervisedTransport(
    prepared,
    dirname(stateFile),
    approval.expiresAtMs,
    environment,
    () => {
      readApproval(approval.digest);
      checkNativeEnvironment(environment);
    },
  );
  const dispatcher = openSupervisedDispatcher({
    stateFile,
    now: () => Date.now(),
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
      const result = inspect(approval.digest);
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
