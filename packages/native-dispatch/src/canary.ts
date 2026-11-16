import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute } from "node:path";
import {
  digest,
  object,
  parseDispatchRequest,
  isIdentifier,
  isModelSelector,
} from "./admission.js";
import { ADVISORY_OUTPUT_SCHEMA } from "./advisory.js";
import { openDispatcher } from "./dispatcher.js";
import { createAdvisoryQualificationTransport } from "./native.js";
import type { QualificationScenario } from "./native.js";
import type {
  SubscriptionCanaryPlan,
  SubscriptionCanaryProfile,
  SubscriptionCanaryBinding,
  PreparedSubscriptionCanary,
  CanaryHold,
  CanaryQualification,
} from "./canary-types.js";

export const SUBSCRIPTION_CANARY_FIXTURE =
  "Rewrite this operator update in at most two clear sentences, preserving all three distinct observations: The receiver imported the handoff durably. The native turn completed. A separate signed agent reply was received. Do not claim that these observations verify the requested work succeeded.\n";
export const SUBSCRIPTION_CANARY_FIXTURE_SHA256 =
  "d17f721f53033a64b6d7a495c8b2522a784000903329375f79028abb4dbb9b99";

function str(v: unknown): string {
  if (typeof v !== "string" || !v || v.length > 512 || v.includes("\0"))
    throw Error("invalid-canary-plan");
  return v;
}
function identifier(v: unknown): string {
  if (!isIdentifier(v)) throw Error("invalid-canary-plan");
  return v;
}
function path(v: unknown): string {
  const s = str(v);
  if (!isAbsolute(s)) throw Error("invalid-canary-plan");
  return s;
}
function sha(v: unknown): string {
  const s = str(v);
  if (!/^[a-f0-9]{64}$/.test(s)) throw Error("invalid-canary-plan");
  return s;
}
export function profile(v: unknown): SubscriptionCanaryProfile {
  if (
    !object(v) ||
    (v.provider !== "codex" && v.provider !== "claude-code") ||
    v.effort !== "low" ||
    v.authMode !== "existing-subscription" ||
    v.customizationPolicy !== "none" ||
    !isModelSelector(v.model)
  )
    throw Error("invalid-canary-profile");
  const version = str(v.nativeVersion);
  if (
    !(v.provider === "codex" ? ["0.165.0-alpha.1.2", "0.164.0"] : ["2.1.286", "2.1.308"]).includes(
      version,
    )
  )
    throw Error("unqualified-profile");
  return {
    provider: v.provider,
    revision: identifier(v.revision),
    binaryRealPath: path(v.binaryRealPath),
    binarySHA256: sha(v.binarySHA256),
    nativeVersion: version,
    model: v.model,
    effort: "low",
    authMode: "existing-subscription",
    customizationPolicy: "none",
  };
}
function binding(v: unknown): SubscriptionCanaryBinding {
  if (
    !object(v) ||
    (v.provider !== "codex" && v.provider !== "claude-code") ||
    (v.sessionPolicy !== "initial-fixed" && v.sessionPolicy !== "existing-fixed") ||
    (v.provider === "codex" && v.sessionPolicy !== "existing-fixed") ||
    !Array.isArray(v.resources) ||
    !v.resources.length ||
    v.resources.length > 64
  )
    throw Error("invalid-canary-binding");
  const session = str(v.nativeSessionId);
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(session))
    throw Error("invalid-canary-binding");
  return {
    alias: identifier(v.alias),
    revision: identifier(v.revision),
    deviceId: identifier(v.deviceId),
    provider: v.provider,
    profileRevision: identifier(v.profileRevision),
    nativeSessionId: session,
    sessionPolicy: v.sessionPolicy,
    cwd: path(v.cwd),
    resources: v.resources.map(str),
  };
}

/** Owner configuration is parsed here; no peer message supplies this plan. */
export function prepareSubscriptionCanary(value: unknown): PreparedSubscriptionCanary {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !object(value.fixture) ||
    value.fixture.utf8 !== SUBSCRIPTION_CANARY_FIXTURE ||
    value.fixture.sha256 !== SUBSCRIPTION_CANARY_FIXTURE_SHA256 ||
    digest(value.fixture.utf8) !== value.fixture.sha256 ||
    !Array.isArray(value.profiles) ||
    value.profiles.length !== 2 ||
    !Array.isArray(value.bindings) ||
    value.bindings.length !== 2 ||
    !object(value.limits) ||
    value.limits.topLevelTurns !== 2 ||
    value.limits.windowMs !== 1800000 ||
    value.limits.requestTimeoutMs !== 120000 ||
    !Array.isArray(value.declaredUnproved) ||
    value.declaredUnproved.join(",") !== "dollars,outputTokens,providerInternalRequests"
  )
    throw Error("invalid-canary-plan");
  const [p, q] = value.profiles.map(profile),
    [a, b] = value.bindings.map(binding);
  if (
    !p ||
    !q ||
    !a ||
    !b ||
    p.provider === q.provider ||
    p.revision === q.revision ||
    a.alias === b.alias ||
    a.nativeSessionId === b.nativeSessionId ||
    a.provider === b.provider
  )
    throw Error("ambiguous-canary-plan");
  const deviceId = identifier(value.deviceId);
  for (const item of [a, b]) {
    if (
      item.deviceId !== deviceId ||
      ![p, q].some((x) => x.provider === item.provider && x.revision === item.profileRevision)
    )
      throw Error("canary-binding-mismatch");
  }
  const plan: SubscriptionCanaryPlan = {
    schemaVersion: 1,
    revision: identifier(value.revision),
    windowId: identifier(value.windowId),
    deviceId,
    fixture: { utf8: value.fixture.utf8, sha256: value.fixture.sha256 },
    profiles: [p, q],
    bindings: [a, b],
    limits: { topLevelTurns: 2, windowMs: 1800000, requestTimeoutMs: 120000 },
    declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
  };
  return {
    mode: "prepared-disabled",
    plan,
    planDigest: digest(JSON.stringify(plan)),
    liveEligible: false,
    holds: [
      "runtime-approval-missing",
      "codex-no-tools-unsupported",
      "claude-managed-customization-unqualified",
    ],
  };
}

function frozen(prepared: PreparedSubscriptionCanary): PreparedSubscriptionCanary {
  const result = prepareSubscriptionCanary(prepared.plan);
  if (result.planDigest !== prepared.planDigest) throw Error("canary-plan-changed");
  return result;
}

export function canaryGrantRevision(prepared: PreparedSubscriptionCanary, alias: string): string {
  const result = frozen(prepared);
  if (!result.plan.bindings.some((b) => b.alias === alias)) throw Error("unassigned");
  return digest(JSON.stringify([result.planDigest, alias]));
}

/** No production launcher exists in this preparation slice. Even a valid approval stays held. */
export function openApprovedSubscriptionCanary(options: {
  prepared: PreparedSubscriptionCanary;
  runtimeApprovalFile: string;
  now?: () => number;
}): { kind: "held"; planDigest: string; holds: CanaryHold[] } {
  const prepared = frozen(options.prepared);
  const holds: CanaryHold[] = [
    "codex-no-tools-unsupported",
    "claude-managed-customization-unqualified",
  ];
  try {
    if (!isAbsolute(options.runtimeApprovalFile)) throw Error("invalid-runtime-approval");
    const file = lstatSync(options.runtimeApprovalFile),
      parent = lstatSync(dirname(options.runtimeApprovalFile));
    const uid = process.getuid?.();
    if (
      !file.isFile() ||
      file.isSymbolicLink() ||
      file.mode & 0o077 ||
      uid === undefined ||
      file.uid !== uid ||
      !parent.isDirectory() ||
      parent.mode & 0o077 ||
      parent.uid !== uid ||
      file.size > 8192
    )
      throw Error("invalid-runtime-approval");
    const approval: unknown = JSON.parse(readFileSync(options.runtimeApprovalFile, "utf8"));
    if (
      !object(approval) ||
      approval.kind !== "owner-approved-subscription-canary" ||
      approval.planDigest !== prepared.planDigest ||
      approval.windowId !== prepared.plan.windowId ||
      approval.deviceId !== prepared.plan.deviceId ||
      typeof approval.startsAtMs !== "number" ||
      typeof approval.expiresAtMs !== "number" ||
      !Number.isSafeInteger(approval.startsAtMs) ||
      !Number.isSafeInteger(approval.expiresAtMs) ||
      approval.expiresAtMs - approval.startsAtMs !== 1800000
    )
      throw Error("invalid-runtime-approval");
    str(approval.ownerNativeApprovalRef);
    const now = (options.now ?? Date.now)();
    if (now < approval.startsAtMs || now >= approval.expiresAtMs) holds.push("window-not-active");
    for (const p of prepared.plan.profiles) {
      try {
        const file = lstatSync(p.binaryRealPath);
        if (
          !file.isFile() ||
          file.isSymbolicLink() ||
          realpathSync(p.binaryRealPath) !== p.binaryRealPath ||
          shaBytes(readFileSync(p.binaryRealPath)) !== p.binarySHA256
        )
          holds.push("binary-pin-mismatch");
      } catch {
        holds.push("binary-pin-mismatch");
      }
    }
  } catch (error) {
    holds.push(
      object(error) && error.code === "ENOENT"
        ? "runtime-approval-missing"
        : "runtime-approval-invalid",
    );
  }
  return { kind: "held", planDigest: prepared.planDigest, holds: [...new Set(holds)] };
}

const shaBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** A reviewable command candidate, not an execution capability or a qualified profile. */
export function subscriptionCanaryCommand(prepared: PreparedSubscriptionCanary, alias: string) {
  const { plan } = frozen(prepared),
    b = plan.bindings.find((x) => x.alias === alias);
  if (!b) throw Error("unassigned");
  const p = plan.profiles.find((x) => x.revision === b.profileRevision);
  if (!p) throw Error("canary-binding-mismatch");
  if (b.provider === "codex")
    return { kind: "unsupported" as const, reason: "codex-no-tools-unsupported" as const };
  return {
    kind: "candidate-only" as const,
    binary: p.binaryRealPath,
    args: [
      "--print",
      b.sessionPolicy === "initial-fixed" ? "--session-id" : "--resume",
      b.nativeSessionId,
      "--model",
      p.model,
      "--effort",
      "low",
      "--output-format",
      "stream-json",
      "--verbose",
      "--safe-mode",
      "--setting-sources",
      "",
      "--tools",
      "",
      "--disallowedTools",
      "mcp__*",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--disable-slash-commands",
      "--permission-mode",
      "dontAsk",
      "--max-turns",
      "1",
      "--json-schema",
      JSON.stringify(ADVISORY_OUTPUT_SCHEMA),
    ],
  };
}

/** Reuses the existing journal/controller engine with builtin deterministic children only. */
export function openCanaryQualification(options: {
  prepared: PreparedSubscriptionCanary;
  stateFile: string;
  startsAtMs: number;
  now?: () => number;
  scenario?: QualificationScenario;
}): CanaryQualification {
  const { plan, planDigest } = frozen(options.prepared);
  if (!Number.isSafeInteger(options.startsAtMs)) throw Error("invalid-canary-window");
  const dispatcher = openDispatcher({
    stateFile: options.stateFile,
    profiles: plan.profiles.map((p) => ({
      revision: p.revision,
      provider: p.provider,
      model: p.model,
      nativeVersion: p.nativeVersion,
    })),
    bindings: plan.bindings.map((b) => ({ ...b, held: false })),
    grants: plan.bindings.map((b) => ({
      charterId: plan.windowId,
      revision: digest(JSON.stringify([planDigest, b.alias])),
      bindingAlias: b.alias,
      operation: "native-resume",
      workflow: "advisory-review",
      mode: "mechanical",
      resources: b.resources,
      validFromMs: options.startsAtMs,
      expiresAtMs: options.startsAtMs + 1800000,
      maxInvocations: 1,
      budgetScope: `subscription-canary:${plan.windowId}:${plan.deviceId}`,
      scopeMaxInvocations: 2,
      held: false,
    })),
    transport: createAdvisoryQualificationTransport(plan.fixture, {
      ...(options.scenario ? { scenario: options.scenario } : {}),
      initialClaudeSession: plan.bindings.some(
        (b) => b.provider === "claude-code" && b.sessionPolicy === "initial-fixed",
      ),
    }),
    ...(options.now ? { now: options.now } : {}),
  });
  return {
    ...dispatcher,
    dispatch: async (input, settings) => {
      let request: ReturnType<typeof parseDispatchRequest>;
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
  };
}
