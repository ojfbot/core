import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  CORRESPONDENCE_ANY_THREAD,
  digest,
  isIdentifier,
  isThreadResource,
  object,
  parseDispatchRequest,
} from "./admission.js";
import { profile as parseProfile } from "./canary.js";
import { openCorrespondenceDispatcher } from "./dispatcher.js";
import {
  createCorrespondenceEmulator,
  createCorrespondenceTransport,
} from "./correspondence-native.js";
import type { CorrespondenceEmulatorScript } from "./correspondence-native.js";
import { serializeCorrespondenceTrace, traceFromFrames } from "./correspondence-frames.js";
import type { CorrespondenceTurnRefusal } from "./correspondence-frames.js";
import { parseCorrespondencePacket } from "./correspondence-protocol.js";
import {
  CORRESPONDENCE_QUALIFICATION_PACKET,
  CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
  checkCorrespondenceQualification,
  checkCorrespondenceTraceBytes,
} from "./correspondence-qualification.js";
import {
  CORRESPONDENCE_MAX_TURNS,
  CORRESPONDENCE_MAX_WINDOW_MS,
  CORRESPONDENCE_REQUEST_TIMEOUT_MS,
} from "./correspondence-types.js";
import type {
  CorrespondenceBinding,
  CorrespondenceDispatcher,
  CorrespondenceOpen,
  CorrespondenceOptions,
  CorrespondencePlan,
  PreparedCorrespondencePlan,
  RelayedCorrespondenceProposal,
} from "./correspondence-types.js";
import {
  checkBinary,
  checkNativeEnvironment,
  checkNativeProfile,
  checkPinnedTemporaryDirectory,
  checkPrivateDirectory,
  nativeEnvironment,
  readPrivateFile,
} from "./supervised-files.js";
import type { SupervisedCanaryHold } from "./supervised-types.js";
import type { DispatchDisposition, DispatchGrant, Provider } from "./types.js";

/** Providers whose subscription qualification is revoked (Core 0.3.4). No plan may bind them. */
const REVOKED_PROVIDERS: Provider[] = ["codex"];
/** Placeholder held by the binding; the dispatcher mints the real session ID per dispatch. */
const FRESH_SESSION_PLACEHOLDER = "fresh-per-dispatch";
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

function fail(code = "invalid-correspondence-plan"): never {
  throw Error(code);
}
function str(v: unknown): string {
  if (typeof v !== "string" || !v || v.length > 512 || v.includes("\0")) fail();
  return v;
}
function identifier(v: unknown): string {
  if (!isIdentifier(v)) fail();
  return v;
}
function absolute(v: unknown): string {
  const s = str(v);
  if (!isAbsolute(s)) fail();
  return s;
}
function exact(v: Record<string, unknown>, keys: string): boolean {
  return Object.keys(v).sort().join(",") === keys;
}

function binding(v: unknown, deviceId: string): CorrespondenceBinding {
  if (!object(v)) fail();
  if (REVOKED_PROVIDERS.includes(v.provider as Provider)) fail("revoked-provider");
  if (
    !exact(v, "alias,cwd,deviceId,profileRevision,provider,resources,revision,sessionPolicy") ||
    v.provider !== "claude-code" ||
    v.sessionPolicy !== "fresh-per-dispatch" ||
    !Array.isArray(v.resources) ||
    !v.resources.length ||
    v.resources.length > 64 ||
    identifier(v.deviceId) !== deviceId
  )
    fail();
  return {
    alias: identifier(v.alias),
    revision: identifier(v.revision),
    deviceId,
    provider: v.provider,
    profileRevision: identifier(v.profileRevision),
    sessionPolicy: "fresh-per-dispatch",
    cwd: absolute(v.cwd),
    // Explicit thread resources, or exactly the one wildcard `helpdesk:thread:*`.
    resources: v.resources.map((r) =>
      r === CORRESPONDENCE_ANY_THREAD || isThreadResource(r) ? r : fail(),
    ),
  };
}

/** Owner configuration is parsed here; no peer message supplies this plan. */
export function prepareCorrespondencePlan(value: unknown): PreparedCorrespondencePlan {
  if (
    !object(value) ||
    !exact(
      value,
      "bindings,declaredUnproved,deviceId,environment,kind,limits,profiles,revision,schemaVersion,supervision,windowId",
    ) ||
    value.schemaVersion !== 1 ||
    value.kind !== "correspondence" ||
    !Array.isArray(value.profiles) ||
    !Array.isArray(value.bindings)
  )
    fail();
  for (const item of [...value.profiles, ...value.bindings])
    if (object(item) && REVOKED_PROVIDERS.includes(item.provider as Provider))
      fail("revoked-provider");
  if (
    value.profiles.length < 1 ||
    value.profiles.length > 2 ||
    value.bindings.length !== value.profiles.length
  )
    fail();
  const deviceId = identifier(value.deviceId);
  let profiles;
  try {
    profiles = value.profiles.map(parseProfile);
  } catch (error) {
    if (error instanceof Error && error.message === "unqualified-profile") throw error;
    fail();
  }
  const bindings = value.bindings.map((b) => binding(b, deviceId));
  const providers = new Set(profiles.map((p) => p.provider));
  if (
    providers.size !== profiles.length ||
    new Set(profiles.map((p) => p.revision)).size !== profiles.length ||
    new Set(bindings.map((b) => b.alias)).size !== bindings.length ||
    new Set(bindings.map((b) => b.provider)).size !== bindings.length ||
    !bindings.every((b) =>
      profiles.some((p) => p.provider === b.provider && p.revision === b.profileRevision),
    )
  )
    fail("ambiguous-correspondence-plan");
  const { limits, supervision, environment } = value;
  if (
    !object(limits) ||
    !exact(limits, "requestTimeoutMs,topLevelTurns,windowMs") ||
    !Number.isSafeInteger(limits.topLevelTurns) ||
    (limits.topLevelTurns as number) < 1 ||
    (limits.topLevelTurns as number) > CORRESPONDENCE_MAX_TURNS ||
    !Number.isSafeInteger(limits.windowMs) ||
    (limits.windowMs as number) < 60000 ||
    (limits.windowMs as number) > CORRESPONDENCE_MAX_WINDOW_MS ||
    limits.requestTimeoutMs !== CORRESPONDENCE_REQUEST_TIMEOUT_MS ||
    // Claude-only: the Codex host-file risk acceptance must be absent.
    !object(supervision) ||
    !exact(supervision, "kind") ||
    supervision.kind !== "owner-attended" ||
    !object(environment) ||
    !exact(environment, "CODEX_HOME,HOME,TMPDIR") ||
    environment.CODEX_HOME !== null ||
    !(environment.TMPDIR === null || typeof environment.TMPDIR === "string") ||
    !Array.isArray(value.declaredUnproved) ||
    value.declaredUnproved.join(",") !== "dollars,outputTokens,providerInternalRequests"
  )
    fail();
  const plan: CorrespondencePlan = {
    schemaVersion: 1,
    kind: "correspondence",
    revision: identifier(value.revision),
    windowId: identifier(value.windowId),
    deviceId,
    profiles,
    bindings,
    limits: {
      topLevelTurns: limits.topLevelTurns as number,
      windowMs: limits.windowMs as number,
      requestTimeoutMs: CORRESPONDENCE_REQUEST_TIMEOUT_MS,
    },
    supervision: { kind: "owner-attended" },
    environment: {
      HOME: absolute(environment.HOME),
      CODEX_HOME: null,
      TMPDIR: environment.TMPDIR === null ? null : absolute(environment.TMPDIR),
    },
    declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
  };
  return {
    mode: "correspondence-prepared",
    plan,
    planDigest: digest(JSON.stringify(plan)),
    liveEligible: false,
  };
}

function frozen(input: PreparedCorrespondencePlan): PreparedCorrespondencePlan {
  const prepared = prepareCorrespondencePlan(input.plan);
  if (prepared.planDigest !== input.planDigest || input.mode !== "correspondence-prepared")
    throw Error("correspondence-plan-changed");
  return prepared;
}

function grants(
  prepared: PreparedCorrespondencePlan,
  mode: DispatchGrant["mode"],
  validFromMs: number,
  expiresAtMs: number,
): DispatchGrant[] {
  const { plan } = prepared;
  return plan.bindings.map(
    (b): DispatchGrant => ({
      charterId: plan.windowId,
      revision: correspondenceGrantRevision(prepared, b.alias),
      bindingAlias: b.alias,
      operation: "native-fresh",
      workflow: "correspondence",
      mode,
      resources: b.resources,
      validFromMs,
      expiresAtMs,
      maxInvocations: plan.limits.topLevelTurns,
      // One budget for the whole window, across every binding.
      budgetScope: `correspondence:${plan.windowId}:${plan.deviceId}`,
      scopeMaxInvocations: plan.limits.topLevelTurns,
      held: false,
    }),
  );
}

/** The grant revision a dispatch request must name for this binding. */
export function correspondenceGrantRevision(
  prepared: PreparedCorrespondencePlan,
  alias: string,
): string {
  const result = frozen(prepared);
  if (!result.plan.bindings.some((b) => b.alias === alias)) throw Error("unassigned");
  return digest(JSON.stringify(["correspondence", result.planDigest, alias]));
}

function dutyBindings(prepared: PreparedCorrespondencePlan) {
  return prepared.plan.bindings.map((b) => ({
    alias: b.alias,
    revision: b.revision,
    deviceId: b.deviceId,
    provider: b.provider,
    nativeSessionId: FRESH_SESSION_PLACEHOLDER,
    sessionPolicy: "fresh-per-dispatch" as const,
    cwd: b.cwd,
    profileRevision: b.profileRevision,
    resources: b.resources,
    held: false,
  }));
}

function wrap(
  dispatcher: ReturnType<typeof openCorrespondenceDispatcher<RelayedCorrespondenceProposal>>,
): CorrespondenceDispatcher {
  return {
    ...dispatcher,
    dispatch: async (input, settings) => {
      let request;
      try {
        request = parseDispatchRequest(input);
      } catch {
        return { kind: "refused", reason: "invalid-request" };
      }
      if (
        request.workflow !== "correspondence" ||
        ![request.streamId, request.eventId, request.messageId, request.threadId].every((s) =>
          UUID.test(s),
        )
      )
        return { kind: "refused", reason: "invalid-request" };
      return dispatcher.dispatch(request, settings);
    },
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

/** Correspondence compares HOME and CODEX_HOME with the controller; TMPDIR is pinned by the plan. */
const CORRESPONDENCE_COMPARED = ["HOME", "CODEX_HOME"] as const;

/**
 * The two ways a live window opens. "duty" is every listener window. "qualification" exists only
 * for qualifyClaudeCorrespondence: it skips the version-has-trace gate and admits nothing but the
 * fixed qualification packet, once.
 */
type WindowMode =
  | { kind: "duty" }
  | { kind: "qualification"; recordFrame: (frame: unknown) => void };

function openWindow(options: CorrespondenceOptions, mode: WindowMode) {
  const { stateFile, runtimeApprovalFile, deviceId } = options;
  const prepared = frozen(options.prepared);
  const { plan, planDigest } = prepared;
  const environment = nativeEnvironment(plan.environment);
  const checkEnvironment = () => {
    checkNativeEnvironment(environment, CORRESPONDENCE_COMPARED);
    checkPinnedTemporaryDirectory(plan.environment.TMPDIR);
  };
  function readApproval(expectedDigest?: string) {
    if (!existsSync(runtimeApprovalFile)) throw Error("runtime-approval-missing");
    const bytes = readPrivateFile(runtimeApprovalFile, 8192);
    const currentDigest = createHash("sha256").update(bytes).digest("hex");
    if (expectedDigest !== undefined && expectedDigest !== currentDigest)
      throw Error("runtime-approval-invalid");
    let approval: unknown;
    try {
      approval = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw Error("runtime-approval-invalid");
    }
    if (
      !isAbsolute(stateFile) ||
      join(realpathSync(dirname(stateFile)), basename(stateFile)) !== stateFile ||
      !object(approval) ||
      !exact(
        approval,
        "deviceId,expiresAtMs,invocationStateFile,kind,ownerNativeApprovalRef,planDigest,startsAtMs,windowId",
      ) ||
      approval.kind !== "owner-approved-correspondence-window" ||
      approval.planDigest !== planDigest ||
      approval.windowId !== plan.windowId ||
      approval.deviceId !== plan.deviceId ||
      approval.invocationStateFile !== stateFile ||
      typeof approval.startsAtMs !== "number" ||
      typeof approval.expiresAtMs !== "number" ||
      !Number.isSafeInteger(approval.startsAtMs) ||
      !Number.isSafeInteger(approval.expiresAtMs) ||
      approval.expiresAtMs - approval.startsAtMs !== plan.limits.windowMs ||
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
      checkEnvironment();
      const approval = readApproval(expectedDigest);
      checkPrivateDirectory(dirname(stateFile));
      if (existsSync(stateFile)) readPrivateFile(stateFile, 16777216);
      for (const b of plan.bindings) {
        checkPrivateDirectory(b.cwd);
        if (readdirSync(b.cwd).length !== 0) throw Error("unsafe-local-state");
      }
      for (const p of plan.profiles) {
        checkBinary(p);
        // QUALIFICATION BYPASS. A duty window requires an allowlisted version with a committed,
        // replayable trace. Only a qualification run skips it, to record that trace; it admits
        // nothing but the fixed CORRESPONDENCE_QUALIFICATION_PACKET, for one turn.
        if (mode.kind !== "qualification") checkCorrespondenceQualification(p);
        checkNativeProfile(p, environment, CORRESPONDENCE_COMPARED);
      }
      const final = readApproval(approval.digest);
      checkEnvironment();
      return { kind: "approved", ...final };
    } catch (error) {
      const code = error instanceof Error ? holdCodes.find((c) => c === error.message) : undefined;
      return { kind: "held", hold: code ?? "runtime-approval-invalid" };
    }
  }
  const approval = inspect();
  if (approval.kind === "held")
    return { kind: "held" as const, planDigest, holds: [approval.hold] };
  const transport = createCorrespondenceTransport(
    prepared,
    approval.expiresAtMs,
    environment,
    () => {
      readApproval(approval.digest);
      checkEnvironment();
    },
    mode.kind === "qualification" ? mode.recordFrame : undefined,
  );
  const qualificationThread = parseCorrespondencePacket(CORRESPONDENCE_QUALIFICATION_PACKET).request
    .thread_id;
  const only = (resources: string[]) =>
    mode.kind === "qualification" ? [`helpdesk:thread:${qualificationThread}`] : resources;
  const dispatcher = openCorrespondenceDispatcher<RelayedCorrespondenceProposal>({
    stateFile,
    now: () => Date.now(),
    profiles: plan.profiles,
    bindings: dutyBindings(prepared).map((b) => ({ ...b, resources: only(b.resources) })),
    grants: grants(prepared, "supervised", approval.startsAtMs, approval.expiresAtMs).map((g) => ({
      ...g,
      resources: only(g.resources),
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
  return { kind: "ready" as const, planDigest, dispatcher: wrap(dispatcher) };
}

/** Only this local owner-window boundary can construct the built-in real correspondence transport. */
export function openCorrespondenceWindow(options: CorrespondenceOptions): CorrespondenceOpen {
  return openWindow(options, { kind: "duty" });
}

export type CorrespondenceQualification =
  | { kind: "held"; planDigest: string; holds: SupervisedCanaryHold[] }
  | { kind: "not-run"; planDigest: string; disposition: DispatchDisposition }
  | {
      kind: "ran";
      planDigest: string;
      nativeVersion: string;
      disposition: DispatchDisposition;
      /** The live checker's refusal, as journaled, if any. */
      turnRefusal: CorrespondenceTurnRefusal | undefined;
      /** The committed-form trace, its SHA-256, and the verdict of replaying it. */
      traceText: string;
      traceSHA256: string;
      replayRefusal: string | undefined;
      proposal: RelayedCorrespondenceProposal | undefined;
      /** "accepted" only for a completed turn with a proposal, no refusal, and a trace that replays. */
      verdict: "accepted" | { refused: string };
    };

/**
 * Records one real correspondence turn on the fixed qualification packet, through the same window
 * path, transport and frame checker as duty. It reads the owner's approval and never writes one;
 * the approval's own journal holds the turn and its budget. Returns the cut-down trace, for the
 * owner to commit with an allowlist entry if `replayRefusal` is undefined.
 */
export async function qualifyClaudeCorrespondence(options: {
  prepared: PreparedCorrespondencePlan;
  runtimeApprovalFile: string;
  deviceId: string;
}): Promise<CorrespondenceQualification> {
  const prepared = frozen(options.prepared);
  const { planDigest, plan } = prepared;
  const held = (hold: SupervisedCanaryHold) => ({
    kind: "held" as const,
    planDigest,
    holds: [hold],
  });
  if (!existsSync(options.runtimeApprovalFile)) return held("runtime-approval-missing");
  let stateFile: unknown;
  try {
    stateFile = JSON.parse(
      readPrivateFile(options.runtimeApprovalFile, 8192).toString("utf8"),
    ).invocationStateFile;
  } catch {
    return held("runtime-approval-invalid");
  }
  if (typeof stateFile !== "string" || !isAbsolute(stateFile))
    return held("runtime-approval-invalid");
  const frames: unknown[] = [];
  const opened = openWindow(
    {
      prepared,
      stateFile,
      runtimeApprovalFile: options.runtimeApprovalFile,
      deviceId: options.deviceId,
    },
    { kind: "qualification", recordFrame: (frame) => frames.push(frame) },
  );
  if (opened.kind === "held") return opened;
  const binding = plan.bindings[0],
    profile = plan.profiles.find((p) => p.revision === binding.profileRevision);
  if (!profile) throw Error("invalid-correspondence-plan");
  const packet = parseCorrespondencePacket(CORRESPONDENCE_QUALIFICATION_PACKET);
  const deliveryId = `qualification-${Date.now()}`;
  const request = {
    deliveryId,
    streamId: randomUUID(),
    eventId: randomUUID(),
    messageId: packet.request.message_id,
    threadId: packet.request.thread_id,
    sequence: packet.request.sequence,
    recipient: binding.alias,
    bindingRevision: binding.revision,
    charterId: plan.windowId,
    grantRevision: correspondenceGrantRevision(prepared, binding.alias),
    profileRevision: binding.profileRevision,
    workflow: "correspondence",
    resources: [`helpdesk:thread:${packet.request.thread_id}`],
    task: {
      input: CORRESPONDENCE_QUALIFICATION_PACKET,
      inputDigest: CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
    },
  };
  const dispatcher = opened.dispatcher;
  try {
    // Exactly one turn: this is the only dispatch this dispatcher ever receives.
    const disposition = await dispatcher.dispatch(request);
    if (frames.length === 0 && disposition.kind !== "observed" && disposition.kind !== "unknown")
      return { kind: "not-run", planDigest, disposition };
    const traceText = serializeCorrespondenceTrace(traceFromFrames(frames));
    const turnRefusal = dispatcher.turnRefusal(deliveryId),
      replayRefusal = checkCorrespondenceTraceBytes(traceText),
      proposal = dispatcher.agentProposal(deliveryId);
    const refused =
      turnRefusal ??
      replayRefusal ??
      (disposition.kind !== "observed" || disposition.outcome !== "completed"
        ? `turn-${disposition.kind === "observed" ? disposition.outcome : disposition.kind}`
        : proposal === undefined
          ? "invalid-agent-proposal"
          : undefined);
    return {
      kind: "ran",
      planDigest,
      nativeVersion: profile.nativeVersion,
      disposition,
      turnRefusal,
      traceText,
      traceSHA256: createHash("sha256").update(traceText).digest("hex"),
      replayRefusal,
      proposal,
      verdict: refused === undefined ? "accepted" : { refused },
    };
  } finally {
    dispatcher.close();
  }
}

/**
 * Offline proof: the same admission, journal, budget and proposal checks, driven by a scripted fake
 * model. No approval file, binary or provider is involved, and status reports realProviderCalls 0.
 */
export function openCorrespondenceEmulation(options: {
  prepared: PreparedCorrespondencePlan;
  stateFile: string;
  script: CorrespondenceEmulatorScript;
  now?: () => number;
  startsAtMs?: number;
}): { planDigest: string; dispatcher: CorrespondenceDispatcher; invocations: () => number } {
  const prepared = frozen(options.prepared);
  const now = options.now ?? Date.now;
  const startsAtMs = options.startsAtMs ?? now();
  const emulator = createCorrespondenceEmulator(options.script);
  const dispatcher = openCorrespondenceDispatcher<RelayedCorrespondenceProposal>({
    stateFile: options.stateFile,
    now,
    profiles: prepared.plan.profiles,
    bindings: dutyBindings(prepared),
    grants: grants(prepared, "mechanical", startsAtMs, startsAtMs + prepared.plan.limits.windowMs),
    transport: emulator.transport,
  });
  return {
    planDigest: prepared.planDigest,
    dispatcher: wrap(dispatcher),
    invocations: emulator.invocations,
  };
}
