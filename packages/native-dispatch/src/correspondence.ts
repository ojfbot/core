import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, lstatSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import type { DatabaseSync as Database } from "node:sqlite";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  CORRESPONDENCE_ANY_THREAD,
  digest,
  isIdentifier,
  isModelSelector,
  isThreadResource,
  object,
  parseDispatchRequest,
} from "./admission.js";
import { openCorrespondenceDispatcher } from "./dispatcher.js";
import {
  createCorrespondenceEmulator,
  createCorrespondenceFrameEmulator,
  createCorrespondenceTransport,
} from "./correspondence-native.js";
import type {
  CorrespondenceEmulatorScript,
  CorrespondenceFrameScript,
} from "./correspondence-native.js";
import type { QualifiedClaudeCorrespondence } from "./correspondence-allowlist.js";
import { serializeCorrespondenceTrace, traceFromFrames } from "./correspondence-frames.js";
import type { CorrespondenceTurnRefusal } from "./correspondence-frames.js";
import { parseCorrespondencePacket } from "./correspondence-protocol.js";
import {
  CORRESPONDENCE_QUALIFICATION_PACKET,
  CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
  checkCorrespondenceQualification,
  checkCorrespondenceTraceBytes,
  isClaudeVersion,
  qualifiedCorrespondenceVersions,
} from "./correspondence-qualification.js";
import {
  CORRESPONDENCE_MAX_TURNS,
  CORRESPONDENCE_MAX_WINDOW_MS,
  CORRESPONDENCE_REQUEST_TIMEOUT_MS,
} from "./correspondence-types.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";
import type {
  CorrespondenceBinding,
  CorrespondenceDispatcher,
  CorrespondenceHold,
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
import type { DispatchDisposition, DispatchGrant, Provider } from "./types.js";

/** Providers whose subscription qualification is revoked (Core 0.3.4). No plan may bind them. */
const REVOKED_PROVIDERS: Provider[] = ["codex"];
/** Placeholder held by the binding; the dispatcher mints the real session ID per dispatch. */
const FRESH_SESSION_PLACEHOLDER = "fresh-per-dispatch";
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
// Vite 5 rewrites node:sqlite, so load the builtin directly, as the dispatcher does.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};

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

/**
 * A Claude profile, for correspondence. Its version must be allowed by the correspondence allowlist
 * (duty) or only well formed (qualification), never by the advisory canary's fixed list.
 */
function correspondenceProfile(
  v: unknown,
  allowed: (version: string) => boolean,
): SubscriptionCanaryProfile {
  if (
    !object(v) ||
    !exact(
      v,
      "authMode,binaryRealPath,binarySHA256,customizationPolicy,effort,model,nativeVersion,provider,revision",
    ) ||
    v.provider !== "claude-code" ||
    v.effort !== "low" ||
    v.authMode !== "existing-subscription" ||
    v.customizationPolicy !== "none" ||
    !isModelSelector(v.model) ||
    typeof v.binarySHA256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.binarySHA256)
  )
    fail();
  if (!isClaudeVersion(v.nativeVersion) || !allowed(v.nativeVersion)) fail("unqualified-profile");
  return {
    provider: "claude-code",
    revision: identifier(v.revision),
    binaryRealPath: absolute(v.binaryRealPath),
    binarySHA256: v.binarySHA256,
    nativeVersion: v.nativeVersion,
    model: v.model,
    effort: "low",
    authMode: "existing-subscription",
    customizationPolicy: "none",
  };
}

/**
 * Owner configuration is parsed here; no peer message supplies this plan. Its Claude version must
 * be in CLAUDE_CORRESPONDENCE_QUALIFIED; otherwise `unqualified-profile`.
 */
export function prepareCorrespondencePlan(value: unknown): PreparedCorrespondencePlan {
  return prepare(value, "correspondence-prepared");
}

/**
 * The same plan, prepared only for qualifyClaudeCorrespondence: its Claude version may be one the
 * allowlist does not list yet (the version being qualified). It cannot open a duty window.
 */
export function prepareCorrespondenceQualificationPlan(value: unknown): PreparedCorrespondencePlan {
  return prepare(value, "correspondence-qualification-prepared");
}

/**
 * EMULATION ONLY. The same plan, for openCorrespondenceEmulation: no real binary runs, so its
 * Claude version need not be allowlisted. It cannot open a live window or a qualification run,
 * and an emulation journal is marked `emulated`.
 */
export function prepareCorrespondenceEmulationPlan(value: unknown): PreparedCorrespondencePlan {
  return prepare(value, "correspondence-emulation-prepared");
}

function prepare(
  value: unknown,
  mode: PreparedCorrespondencePlan["mode"],
): PreparedCorrespondencePlan {
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
  const listed = qualifiedCorrespondenceVersions();
  const profiles = value.profiles.map((p) =>
    correspondenceProfile(p, (v) =>
      // Qualification and emulation skip the allowlist; a duty plan needs a listed version.
      mode === "correspondence-prepared" ? listed.includes(v) : true,
    ),
  );
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
    mode,
    plan,
    planDigest: digest(JSON.stringify(plan)),
    liveEligible: false,
  };
}

function frozen(
  input: PreparedCorrespondencePlan,
  mode: PreparedCorrespondencePlan["mode"] = "correspondence-prepared",
): PreparedCorrespondencePlan {
  if (input.mode !== mode) throw Error("correspondence-plan-changed");
  const prepared = prepare(input.plan, mode);
  if (prepared.planDigest !== input.planDigest) throw Error("correspondence-plan-changed");
  return prepared;
}

function grants(
  prepared: PreparedCorrespondencePlan,
  mode: DispatchGrant["mode"],
  validFromMs: number,
  expiresAtMs: number,
): DispatchGrant[] {
  const { plan } = prepared;
  if (prepared.mode === "correspondence-qualification-prepared")
    // A qualification journal has a budget of exactly one turn.
    return plan.bindings.map(
      (b): DispatchGrant => ({
        charterId: plan.windowId,
        revision: qualificationGrantRevision(prepared, b.alias),
        bindingAlias: b.alias,
        operation: "native-fresh",
        workflow: "correspondence",
        mode,
        resources: b.resources,
        validFromMs,
        expiresAtMs,
        maxInvocations: 1,
        budgetScope: `correspondence-qualification:${plan.windowId}:${plan.deviceId}`,
        scopeMaxInvocations: 1,
        held: false,
      }),
    );
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
  // Duty and emulation plans share grant revisions; a qualification plan has its own.
  const result = frozen(
    prepared,
    prepared.mode === "correspondence-emulation-prepared"
      ? "correspondence-emulation-prepared"
      : "correspondence-prepared",
  );
  if (!result.plan.bindings.some((b) => b.alias === alias)) throw Error("unassigned");
  return digest(JSON.stringify(["correspondence", result.planDigest, alias]));
}
function qualificationGrantRevision(prepared: PreparedCorrespondencePlan, alias: string): string {
  return digest(JSON.stringify(["correspondence-qualification", prepared.planDigest, alias]));
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

const holdCodes: CorrespondenceHold[] = [
  "journal-source-mismatch",
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

/** A qualification approval's window: 1 to 30 minutes, for its one turn. */
const CORRESPONDENCE_QUALIFICATION_MAX_WINDOW_MS = 1800000;
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
  const qualification = mode.kind === "qualification";
  const prepared = frozen(
    options.prepared,
    qualification ? "correspondence-qualification-prepared" : "correspondence-prepared",
  );
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
      // A duty approval never authorises qualification, nor the reverse.
      approval.kind !==
        (qualification
          ? "owner-approved-correspondence-qualification"
          : "owner-approved-correspondence-window") ||
      approval.planDigest !== planDigest ||
      approval.windowId !== plan.windowId ||
      approval.deviceId !== plan.deviceId ||
      approval.invocationStateFile !== stateFile ||
      typeof approval.startsAtMs !== "number" ||
      typeof approval.expiresAtMs !== "number" ||
      !Number.isSafeInteger(approval.startsAtMs) ||
      !Number.isSafeInteger(approval.expiresAtMs) ||
      !(qualification
        ? approval.expiresAtMs - approval.startsAtMs >= 60000 &&
          approval.expiresAtMs - approval.startsAtMs <= CORRESPONDENCE_QUALIFICATION_MAX_WINDOW_MS
        : approval.expiresAtMs - approval.startsAtMs === plan.limits.windowMs) ||
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
    | { kind: "held"; hold: CorrespondenceHold }
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
  const listed = qualifiedCorrespondenceVersions();
  const only = (resources: string[]) =>
    mode.kind === "qualification" ? [`helpdesk:thread:${qualificationThread}`] : resources;
  let dispatcher;
  try {
    dispatcher = openCorrespondenceDispatcher<RelayedCorrespondenceProposal>({
      stateFile,
      now: () => Date.now(),
      profiles: plan.profiles,
      bindings: dutyBindings(prepared).map((b) => ({ ...b, resources: only(b.resources) })),
      grants: grants(prepared, "supervised", approval.startsAtMs, approval.expiresAtMs).map(
        (g) => ({ ...g, resources: only(g.resources) }),
      ),
      transport,
      beforeInvoke: () => {
        const result = inspect(approval.digest);
        return result.kind === "held"
          ? result.hold === "window-not-active"
            ? "expired"
            : "held"
          : undefined;
      },
      qualification,
      // Duty: the allowlist's versions only. Qualification: also the version being qualified.
      claudeVersions: qualification
        ? [...listed, ...plan.profiles.map((p) => p.nativeVersion)]
        : listed,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "journal-source-mismatch")
      return { kind: "held" as const, planDigest, holds: ["journal-source-mismatch" as const] };
    throw error;
  }
  return { kind: "ready" as const, planDigest, dispatcher: wrap(dispatcher) };
}

/** Only this local owner-window boundary can construct the built-in real correspondence transport. */
export function openCorrespondenceWindow(options: CorrespondenceOptions): CorrespondenceOpen {
  return openWindow(options, { kind: "duty" });
}

export type CorrespondenceQualification =
  | { kind: "held"; planDigest: string; holds: CorrespondenceHold[] }
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
      allowlistEntry: QualifiedClaudeCorrespondence | undefined;
    };

/** Writes a trace only to the path the operator names: a new file, mode 0600. */
export function writeCorrespondenceTrace(path: string, traceText: string): void {
  if (!isAbsolute(path)) throw Error("invalid-trace-path");
  writeFileSync(path, traceText, { flag: "wx", mode: 0o600 });
}

/**
 * EMULATION ONLY. The qualification path offline: the same request, dispatcher, frame checker,
 * trace cut, hash and replay as qualifyClaudeCorrespondence, but the turn's frames come from
 * `frames` instead of a Claude process. It needs no approval, binary, managed-policy check or HOME,
 * and its journal is marked `emulated`, so it cannot open a live or qualification journal, and its
 * trace proves nothing about a real Claude version.
 */
export async function qualifyClaudeCorrespondenceEmulation(options: {
  /** From prepareCorrespondenceQualificationPlan. */
  prepared: PreparedCorrespondencePlan;
  stateFile: string;
  frames: CorrespondenceFrameScript;
  now?: () => number;
}): Promise<CorrespondenceQualification> {
  const prepared = frozen(options.prepared, "correspondence-qualification-prepared");
  const now = options.now ?? Date.now;
  const startsAtMs = now();
  const recorded: unknown[] = [];
  const emulator = createCorrespondenceFrameEmulator(options.frames, (f) => recorded.push(f));
  const thread = parseCorrespondencePacket(CORRESPONDENCE_QUALIFICATION_PACKET).request.thread_id;
  const only = [`helpdesk:thread:${thread}`];
  const dispatcher = openCorrespondenceDispatcher<RelayedCorrespondenceProposal>({
    stateFile: options.stateFile,
    now,
    profiles: prepared.plan.profiles,
    bindings: dutyBindings(prepared).map((b) => ({ ...b, resources: only })),
    grants: grants(
      prepared,
      "mechanical",
      startsAtMs,
      startsAtMs + prepared.plan.limits.windowMs,
    ).map((g) => ({ ...g, resources: only })),
    transport: emulator.transport,
    claudeVersions: prepared.plan.profiles.map((p) => p.nativeVersion),
  });
  return runQualificationTurn(prepared, wrap(dispatcher), recorded);
}

/**
 * Records one real correspondence turn on the fixed qualification packet, through the same window
 * path, transport and frame checker as duty. It needs the owner's qualification approval
 * (`owner-approved-correspondence-qualification`) and never writes one. That approval names its own
 * journal, separate from every duty journal, with a budget of exactly one turn. Returns the cut-down
 * trace, for the owner to commit with an allowlist entry when the verdict is "accepted".
 */
export async function qualifyClaudeCorrespondence(options: {
  /** From prepareCorrespondenceQualificationPlan. */
  prepared: PreparedCorrespondencePlan;
  runtimeApprovalFile: string;
  deviceId: string;
}): Promise<CorrespondenceQualification> {
  const prepared = frozen(options.prepared, "correspondence-qualification-prepared");
  const { planDigest } = prepared;
  const held = (hold: CorrespondenceHold) => ({
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
  return runQualificationTurn(prepared, opened.dispatcher, frames);
}

/** The one qualification turn, shared by the real and the emulated run. */
async function runQualificationTurn(
  prepared: PreparedCorrespondencePlan,
  dispatcher: CorrespondenceDispatcher,
  frames: unknown[],
): Promise<CorrespondenceQualification> {
  const { planDigest, plan } = prepared;
  const binding = plan.bindings[0],
    profile = plan.profiles.find((p) => p.revision === binding.profileRevision);
  if (!profile) throw Error("invalid-correspondence-plan");
  const packet = parseCorrespondencePacket(CORRESPONDENCE_QUALIFICATION_PACKET);
  const deliveryId = `qualification-${randomUUID()}`;
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
    grantRevision: qualificationGrantRevision(prepared, binding.alias),
    profileRevision: binding.profileRevision,
    workflow: "correspondence",
    resources: [`helpdesk:thread:${packet.request.thread_id}`],
    task: {
      input: CORRESPONDENCE_QUALIFICATION_PACKET,
      inputDigest: CORRESPONDENCE_QUALIFICATION_PACKET_SHA256,
    },
  };
  try {
    // Exactly one turn: this is the only dispatch this dispatcher ever receives.
    const disposition = await dispatcher.dispatch(request);
    // Refused or busy: no turn started (budget spent, another turn unresolved, or a hold).
    if (disposition.kind === "refused" || disposition.kind === "busy")
      return { kind: "not-run", planDigest, disposition };
    const turnRefusal = dispatcher.turnRefusal(deliveryId),
      proposal = dispatcher.agentProposal(deliveryId);
    // The answer is copied into the trace only after the live checker accepted the turn and
    // parseCorrespondenceAnswer accepted the proposal. Otherwise only names, counts and types.
    const result = frames.find((f) => object(f) && f.type === "result") as
      | Record<string, unknown>
      | undefined;
    const accepted =
      turnRefusal === undefined &&
      proposal !== undefined &&
      disposition.kind === "observed" &&
      disposition.outcome === "completed";
    const traceText = serializeCorrespondenceTrace(
      traceFromFrames(frames, {
        binarySHA256: profile.binarySHA256,
        ...(accepted ? { acceptedAnswer: result?.structured_output } : {}),
      }),
    );
    const replayRefusal = checkCorrespondenceTraceBytes(traceText, {
      model: profile.model,
      nativeVersion: profile.nativeVersion,
      binarySHA256: profile.binarySHA256,
    });
    const refused =
      turnRefusal ??
      replayRefusal ??
      (disposition.kind !== "observed" || disposition.outcome !== "completed"
        ? `turn-${disposition.kind === "observed" ? disposition.outcome : disposition.kind}`
        : proposal === undefined
          ? "invalid-agent-proposal"
          : undefined);
    const traceSHA256 = createHash("sha256").update(traceText).digest("hex");
    return {
      kind: "ran",
      planDigest,
      nativeVersion: profile.nativeVersion,
      disposition,
      turnRefusal,
      traceText,
      traceSHA256,
      replayRefusal,
      proposal,
      verdict: refused === undefined ? "accepted" : { refused },
      // The allowlist entry to add, with the trace embedded, once the trace file is committed.
      allowlistEntry:
        refused === undefined
          ? {
              nativeVersion: profile.nativeVersion,
              model: profile.model,
              binarySHA256: profile.binarySHA256,
              traceSHA256,
              trace: traceText,
            }
          : undefined,
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
  // A duty plan, or one from prepareCorrespondenceEmulationPlan (no allowlisted version needed).
  const prepared = frozen(
    options.prepared,
    options.prepared.mode === "correspondence-emulation-prepared"
      ? "correspondence-emulation-prepared"
      : "correspondence-prepared",
  );
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
    // No binary runs: the plan's own versions, checked well formed when it was prepared.
    claudeVersions: prepared.plan.profiles.map((p) => p.nativeVersion),
  });
  return {
    planDigest: prepared.planDigest,
    dispatcher: wrap(dispatcher),
    invocations: emulator.invocations,
  };
}

/** What reviewCorrespondenceJournal reports. */
export interface CorrespondenceJournalReview {
  source: "live" | "emulated" | "qualification" | "unmarked";
  reservations: number;
  /** Turns that are not observed: they hold the journal's controller. */
  unresolved: Array<{
    deliveryId: string;
    dispatchId: string;
    nativeSessionId: string;
    state: "dispatching" | "unknown";
    admittedAtMs: number;
    refusal: string | null;
    processGroup: number | null;
  }>;
}

/**
 * Read-only review of any correspondence journal, including 0.4.0 journals with no source marker
 * and qualification journals. It needs no plan, approval or qualified version, never writes, and
 * fails with `dispatcher-already-open` while a listener holds the journal. Use it to decide whether
 * to keep a journal as evidence and start a new one, or to reconcile it in an active window.
 */
export function reviewCorrespondenceJournal(stateFile: string): CorrespondenceJournalReview {
  if (!isAbsolute(stateFile)) throw Error("invalid-state-path");
  const info = lstatSync(stateFile);
  if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077)
    throw Error("unsafe-state-file");
  let db: Database;
  try {
    db = new DatabaseSync(stateFile, { readOnly: true });
    db.exec("PRAGMA busy_timeout=0");
  } catch {
    throw Error("dispatcher-already-open");
  }
  try {
    let tables: Set<unknown>;
    try {
      tables = new Set(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()
          .map((r) => r.name),
      );
    } catch (error) {
      if (object(error) && (error.errcode === 5 || error.errcode === 6))
        throw Error("dispatcher-already-open");
      throw error;
    }
    const marked = tables.has("journal_source")
      ? db.prepare("SELECT source FROM journal_source").get()?.source
      : undefined;
    const source =
      marked === "live" || marked === "emulated" || marked === "qualification"
        ? marked
        : "unmarked";
    if (!tables.has("invocations")) return { source, reservations: 0, unresolved: [] };
    const refusals = tables.has("turn_refusals");
    const rows = db
      .prepare(
        refusals
          ? `SELECT i.*, r.reason AS refusal, r.process_group AS process_group FROM invocations i
             LEFT JOIN turn_refusals r USING(dispatch_id) WHERE i.state!='observed'
             ORDER BY i.admitted_at`
          : "SELECT *, NULL AS refusal, NULL AS process_group FROM invocations WHERE state!='observed' ORDER BY admitted_at",
      )
      .all();
    const total = db.prepare("SELECT count(*) AS n FROM invocations").get()?.n;
    return {
      source,
      reservations: typeof total === "number" ? total : 0,
      unresolved: rows.map((r) => ({
        deliveryId: String(r.delivery_id),
        dispatchId: String(r.dispatch_id),
        nativeSessionId: String(r.native_session),
        state: r.state === "dispatching" ? "dispatching" : "unknown",
        admittedAtMs: Number(r.admitted_at),
        refusal: typeof r.refusal === "string" ? r.refusal : null,
        processGroup: typeof r.process_group === "number" ? r.process_group : null,
      })),
    };
  } finally {
    db.close();
  }
}
