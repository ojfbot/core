import { createRequire } from "node:module";
import type { DatabaseSync as Database } from "node:sqlite";
import { parseStoredDisposition, validateStandingJournal } from "./standing-journal.js";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { digest, isIdentifier, object, parseDispatchRequest } from "./admission.js";
import { openCorrespondenceDispatcher } from "./dispatcher.js";
import type { StandingEnginePolicy } from "./dispatcher.js";
import {
  prepareCorrespondencePlan,
  prepareCorrespondenceEmulationPlan,
  prepareCorrespondenceQualificationPlan,
  runQualificationTurn,
} from "./correspondence.js";
import {
  createCorrespondenceEmulator,
  createCorrespondenceTransport,
  createCorrespondenceFrameEmulator,
} from "./correspondence-native.js";
import type {
  CorrespondenceEmulatorScript,
  CorrespondenceFrameScript,
} from "./correspondence-native.js";
import {
  CORRESPONDENCE_QUALIFICATION_PACKET,
  checkCorrespondenceQualification,
  correspondenceBuiltins,
  qualifiedCorrespondenceVersions,
} from "./correspondence-qualification.js";
import { parseCorrespondencePacket } from "./correspondence-protocol.js";
import {
  checkBinary,
  checkNativeEnvironment,
  checkNativeProfile,
  checkPinnedTemporaryDirectory,
  checkPrivateDirectory,
  nativeEnvironment,
  readPrivateFile,
} from "./supervised-files.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";
import type { SupervisedEnvironment } from "./supervised-types.js";
import type {
  CorrespondenceBinding,
  CorrespondenceDispatcher,
  PreparedCorrespondencePlan,
  RelayedCorrespondenceProposal,
  CorrespondenceHold,
} from "./correspondence-types.js";
import type {
  DispatchDisposition,
  DispatchGrant,
  DispatchRequest,
  RefusalReason,
} from "./types.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof Database;
};

/** Local owner configuration. Packet sender fields are claims, not authentication evidence. */
export interface StandingCorrespondencePolicy {
  schemaVersion: 1;
  kind: "standing-correspondence-policy";
  revision: string;
  lineageId: string;
  deviceId: string;
  profiles: SubscriptionCanaryProfile[];
  bindings: CorrespondenceBinding[];
  origins: Array<{ deviceId: string; sessionId: string | null }>;
  capabilities: Array<"correspondence" | "listener-status">;
  environment: SupervisedEnvironment;
  sourceRevision: string;
  limits: { hourlyTurns: number; dailyTurns: number; requestTimeoutMs: 120000 };
}
export interface PreparedStandingCorrespondencePolicy {
  mode:
    | "standing-correspondence-prepared"
    | "standing-emulation-prepared"
    | "standing-qualification-prepared";
  policy: StandingCorrespondencePolicy;
  policyDigest: string;
  liveEligible: false;
}
export interface StandingCorrespondenceApproval {
  kind: "owner-approved-standing-correspondence";
  purpose: "duty" | "qualification";
  grantId: string;
  policyDigest: string;
  lineageId: string;
  deviceId: string;
  invocationStateFile: string;
  startsAtMs: number;
  expiresAtMs: number;
  ownerNativeApprovalRef: string;
  revocationFile: string;
  revocationDigest: string;
}
export interface StandingCorrespondenceOptions {
  prepared: PreparedStandingCorrespondencePolicy;
  stateFile: string;
  runtimeApprovalFile: string;
  deviceId: string;
}
export interface StandingCorrespondenceDispatcher extends CorrespondenceDispatcher {
  /** Caller obtains this identity from the authenticated journal writer, never packet text. */
  dispatch(
    request: unknown,
    options?: {
      signal?: AbortSignal;
      authenticatedOrigin?: { deviceId: string; sessionId: string | null };
    },
  ): ReturnType<CorrespondenceDispatcher["dispatch"]>;
}
export type StandingCorrespondenceHold =
  | CorrespondenceHold
  | RefusalReason
  | "standing-budget-missing"
  | "standing-budget-corrupt"
  | "standing-budget-policy-mismatch"
  | "dispatcher-already-open"
  | "invalid-state-path";
export type StandingCorrespondenceOpen =
  | { kind: "held"; policyDigest: string; holds: StandingCorrespondenceHold[] }
  | { kind: "ready"; policyDigest: string; dispatcher: StandingCorrespondenceDispatcher };

function holdCode(
  error: unknown,
  fallback: StandingCorrespondenceHold,
): StandingCorrespondenceHold {
  const known: StandingCorrespondenceHold[] = [
    "standing-budget-missing",
    "standing-budget-corrupt",
    "standing-budget-policy-mismatch",
    "dispatcher-already-open",
    "invalid-state-path",
    "runtime-approval-invalid",
    "standing-policy-missing",
    "standing-policy-changed",
    "standing-policy-revoked",
    "not-yet-valid",
    "expired",
    "device-mismatch",
    "environment-mismatch",
    "unsafe-local-state",
    "acl-unqualified",
    "binary-pin-mismatch",
    "native-profile-unqualified",
    "journal-source-mismatch",
    "invalid-request",
    "delivery-conflict",
  ];
  return error instanceof Error && known.includes(error.message as StandingCorrespondenceHold)
    ? (error.message as StandingCorrespondenceHold)
    : fallback;
}

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ADDRESS = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const exact = (v: Record<string, unknown>, keys: string) =>
  Object.keys(v).sort().join(",") === keys;
function fail(): never {
  throw Error("invalid-standing-policy");
}
function prepare(value: unknown, mode: PreparedStandingCorrespondencePolicy["mode"]) {
  if (
    ![
      "standing-correspondence-prepared",
      "standing-emulation-prepared",
      "standing-qualification-prepared",
    ].includes(mode)
  )
    fail();
  if (
    !object(value) ||
    !exact(
      value,
      "bindings,capabilities,deviceId,environment,kind,limits,lineageId,origins,profiles,revision,schemaVersion,sourceRevision",
    ) ||
    value.schemaVersion !== 1 ||
    value.kind !== "standing-correspondence-policy" ||
    ![value.revision, value.lineageId, value.deviceId].every(isIdentifier) ||
    typeof value.sourceRevision !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.sourceRevision) ||
    !Array.isArray(value.profiles) ||
    value.profiles.length !== 1 ||
    !Array.isArray(value.bindings) ||
    value.bindings.length < 1 ||
    value.bindings.length > 32 ||
    !Array.isArray(value.origins) ||
    !value.origins.length ||
    value.origins.length > 64 ||
    !Array.isArray(value.capabilities) ||
    !value.capabilities.length ||
    new Set(value.capabilities).size !== value.capabilities.length ||
    value.capabilities.some((c) => c !== "correspondence" && c !== "listener-status") ||
    !object(value.limits) ||
    !exact(value.limits, "dailyTurns,hourlyTurns,requestTimeoutMs") ||
    !Number.isSafeInteger(value.limits.hourlyTurns) ||
    Number(value.limits.hourlyTurns) < 1 ||
    !Number.isSafeInteger(value.limits.dailyTurns) ||
    Number(value.limits.dailyTurns) < Number(value.limits.hourlyTurns) ||
    value.limits.requestTimeoutMs !== 120000
  )
    fail();
  const nativePrepare =
    mode === "standing-correspondence-prepared"
      ? prepareCorrespondencePlan
      : mode === "standing-qualification-prepared"
        ? prepareCorrespondenceQualificationPlan
        : prepareCorrespondenceEmulationPlan;
  const natives = value.bindings.map((binding) => {
    if (
      !object(binding) ||
      typeof binding.alias !== "string" ||
      !ADDRESS.test(binding.alias) ||
      !Array.isArray(binding.resources) ||
      !binding.resources.length ||
      binding.resources.some(
        (r) =>
          typeof r !== "string" ||
          !r.startsWith("helpdesk:thread:") ||
          !UUID.test(r.slice("helpdesk:thread:".length)),
      )
    )
      fail();
    return nativePrepare({
      schemaVersion: 1,
      kind: "correspondence",
      revision: value.revision,
      windowId: value.lineageId,
      deviceId: value.deviceId,
      profiles: value.profiles,
      bindings: [binding],
      limits: { topLevelTurns: 40, windowMs: 5400000, requestTimeoutMs: 120000 },
      supervision: { kind: "owner-attended" },
      environment: value.environment,
      declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
    });
  });
  if (new Set(natives.map((n) => n.plan.bindings[0].alias)).size !== natives.length) fail();
  const origins = value.origins.map((o) => {
    if (
      !object(o) ||
      !exact(o, "deviceId,sessionId") ||
      !isIdentifier(o.deviceId) ||
      !(o.sessionId === null || (typeof o.sessionId === "string" && ADDRESS.test(o.sessionId)))
    )
      fail();
    return { deviceId: o.deviceId, sessionId: o.sessionId as string | null };
  });
  if (new Set(origins.map((o) => JSON.stringify(o))).size !== origins.length) fail();
  const policy: StandingCorrespondencePolicy = {
    schemaVersion: 1,
    kind: "standing-correspondence-policy",
    revision: value.revision as string,
    lineageId: value.lineageId as string,
    deviceId: value.deviceId as string,
    profiles: natives[0].plan.profiles,
    bindings: natives.flatMap((n) => n.plan.bindings),
    origins,
    capabilities: [...value.capabilities] as StandingCorrespondencePolicy["capabilities"],
    environment: natives[0].plan.environment,
    sourceRevision: value.sourceRevision,
    limits: {
      hourlyTurns: Number(value.limits.hourlyTurns),
      dailyTurns: Number(value.limits.dailyTurns),
      requestTimeoutMs: 120000,
    },
  };
  return {
    mode,
    policy,
    policyDigest: digest(JSON.stringify(policy)),
    liveEligible: false as const,
  };
}
export const prepareStandingCorrespondencePolicy = (
  value: unknown,
): PreparedStandingCorrespondencePolicy => prepare(value, "standing-correspondence-prepared");
export const prepareStandingCorrespondenceEmulationPolicy = (
  value: unknown,
): PreparedStandingCorrespondencePolicy => prepare(value, "standing-emulation-prepared");
export const prepareStandingCorrespondenceQualificationPolicy = (
  value: unknown,
): PreparedStandingCorrespondencePolicy => prepare(value, "standing-qualification-prepared");
function freeze(prepared: PreparedStandingCorrespondencePolicy) {
  const next = prepare(prepared.policy, prepared.mode);
  if (next.policyDigest !== prepared.policyDigest) throw Error("standing-policy-changed");
  return next;
}
function nativePlan(prepared: PreparedStandingCorrespondencePolicy): PreparedCorrespondencePlan {
  const p = prepared.policy;
  return {
    mode:
      prepared.mode === "standing-qualification-prepared"
        ? "correspondence-qualification-prepared"
        : prepared.mode === "standing-emulation-prepared"
          ? "correspondence-emulation-prepared"
          : "correspondence-prepared",
    planDigest: prepared.policyDigest,
    liveEligible: false,
    plan: {
      schemaVersion: 1,
      kind: "correspondence",
      revision: p.revision,
      windowId: p.lineageId,
      deviceId: p.deviceId,
      profiles: p.profiles,
      bindings: p.bindings,
      limits: { topLevelTurns: 40, windowMs: 5400000, requestTimeoutMs: 120000 },
      supervision: { kind: "owner-attended" },
      environment: p.environment,
      declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
    },
  };
}
export function standingCorrespondenceGrantRevision(
  prepared: PreparedStandingCorrespondencePolicy,
  alias: string,
): string {
  const p = freeze(prepared);
  if (!p.policy.bindings.some((b) => b.alias === alias)) throw Error("unassigned");
  return digest(JSON.stringify(["standing-correspondence", p.policyDigest, alias]));
}
function enginePolicy(
  prepared: PreparedStandingCorrespondencePolicy,
  source: "live" | "emulated",
): StandingEnginePolicy {
  const p = prepared.policy;
  return {
    source,
    authorityId: "bootstrap",
    budget: {
      deviceId: p.deviceId,
      lineageId: p.lineageId,
      hourlyLimit: p.limits.hourlyTurns,
      dailyLimit: p.limits.dailyTurns,
    },
    identity(request) {
      const packet = parseCorrespondencePacket(request.task.input);
      // Alias/revision renewal cannot re-run the same received message/context round.
      const effectId = digest(
        JSON.stringify([
          p.lineageId,
          request.streamId,
          request.messageId,
          packet.context_round.used,
        ]),
      );
      const { duty: _duty, ...content } = packet;
      return {
        effectId,
        payloadDigest: digest(
          JSON.stringify([request.streamId, request.eventId, request.sequence, content]),
        ),
      };
    },
  };
}
function config(
  prepared: PreparedStandingCorrespondencePolicy,
  approval: StandingCorrespondenceApproval,
  mode: "mechanical" | "supervised",
) {
  const p = prepared.policy;
  const qualification = approval.purpose === "qualification";
  const thread = parseCorrespondencePacket(CORRESPONDENCE_QUALIFICATION_PACKET).request.thread_id;
  const only = (resources: string[]) => (qualification ? [`helpdesk:thread:${thread}`] : resources);
  return {
    profiles: p.profiles,
    bindings: p.bindings.map((b) => ({
      ...b,
      resources: only(b.resources),
      nativeSessionId: "fresh-per-dispatch",
      held: false,
    })),
    grants: p.bindings.map(
      (b): DispatchGrant => ({
        charterId: qualification ? approval.grantId : p.lineageId,
        revision: standingCorrespondenceGrantRevision(prepared, b.alias),
        bindingAlias: b.alias,
        operation: "native-fresh",
        workflow: "correspondence",
        mode,
        resources: only(b.resources),
        validFromMs: approval.startsAtMs,
        expiresAtMs: approval.expiresAtMs,
        maxInvocations: qualification ? 1 : Number.MAX_SAFE_INTEGER,
        budgetScope: qualification
          ? `standing-qualification:${p.lineageId}:${approval.grantId}`
          : `standing:${p.lineageId}`,
        scopeMaxInvocations: qualification ? 1 : Number.MAX_SAFE_INTEGER,
        held: false,
      }),
    ),
  };
}
/** Explicit, empty-journal bootstrap. Never migrate an existing journal or erase unknown effects.
 * Authorize first bootstrap only before this slice's first native effect. Every subsequent slice
 * qualification/proof/duty call uses this same per-host lineage and path; never bootstrap a new path
 * to replace missing usage. Separately closed finite charters are not imported or reconciled here.
 * This is a slice quota, not a provider billing quota. Bootstrap grants no runtime authority.
 */
export function initializeStandingCorrespondenceJournal(options: {
  prepared: PreparedStandingCorrespondencePolicy;
  stateFile: string;
  source: "live" | "emulated";
}): void {
  const prepared = freeze(options.prepared);
  if (!isAbsolute(options.stateFile) || !["live", "emulated"].includes(options.source))
    throw Error("invalid-state-path");
  checkPrivateDirectory(dirname(options.stateFile));
  if (
    join(realpathSync(dirname(options.stateFile)), basename(options.stateFile)) !==
    options.stateFile
  )
    throw Error("unsafe-local-state");
  const emulator = createCorrespondenceEmulator(() => ({ kind: "hang" }));
  const p = prepared.policy;
  const approval = {
    purpose: "duty",
    startsAtMs: 0,
    expiresAtMs: 1,
  } as StandingCorrespondenceApproval;
  const dispatcher = openCorrespondenceDispatcher({
    stateFile: options.stateFile,
    ...config(prepared, approval, "mechanical"),
    transport: emulator.transport,
    claudeVersions: p.profiles.map((x) => x.nativeVersion),
    standing: { ...enginePolicy(prepared, options.source), bootstrap: true },
  });
  dispatcher.close();
}
/** Validate authority as data. The local caller, not a peer packet, chooses this file. */
export function parseStandingCorrespondenceApproval(
  value: unknown,
  prepared: PreparedStandingCorrespondencePolicy,
  stateFile: string,
  purpose: "duty" | "qualification",
): StandingCorrespondenceApproval {
  const p = prepared.policy;
  if (
    !object(value) ||
    !exact(
      value,
      "deviceId,expiresAtMs,grantId,invocationStateFile,kind,lineageId,ownerNativeApprovalRef,policyDigest,purpose,revocationDigest,revocationFile,startsAtMs",
    ) ||
    value.kind !== "owner-approved-standing-correspondence" ||
    value.purpose !== purpose ||
    !isIdentifier(value.grantId) ||
    value.policyDigest !== prepared.policyDigest ||
    value.lineageId !== p.lineageId ||
    value.deviceId !== p.deviceId ||
    value.invocationStateFile !== stateFile ||
    !isAbsolute(stateFile) ||
    !Number.isSafeInteger(value.startsAtMs) ||
    Number(value.startsAtMs) < 0 ||
    !Number.isSafeInteger(value.expiresAtMs) ||
    Number(value.expiresAtMs) <= Number(value.startsAtMs) ||
    Number(value.expiresAtMs) - Number(value.startsAtMs) >
      (purpose === "qualification" ? 1800000 : 86400000) ||
    typeof value.ownerNativeApprovalRef !== "string" ||
    !value.ownerNativeApprovalRef ||
    value.ownerNativeApprovalRef.length > 512 ||
    typeof value.revocationFile !== "string" ||
    !isAbsolute(value.revocationFile) ||
    !hash(value.revocationDigest)
  )
    throw Error("runtime-approval-invalid");
  return { ...value } as unknown as StandingCorrespondenceApproval;
}
/** Open only an existing private standing journal; never create tables, paths or allowance. */
function withStandingJournal<T>(
  prepared: PreparedStandingCorrespondencePolicy,
  stateFile: string,
  source: "live" | "emulated",
  readOnly: boolean,
  work: (db: Database) => T,
): T {
  if (!isAbsolute(stateFile)) throw Error("invalid-state-path");
  checkPrivateDirectory(dirname(stateFile));
  if (!existsSync(stateFile)) throw Error("standing-budget-missing");
  if (join(realpathSync(dirname(stateFile)), basename(stateFile)) !== stateFile)
    throw Error("unsafe-local-state");
  readPrivateFile(stateFile, 16777216);
  const db = new DatabaseSync(stateFile, { readOnly });
  try {
    db.exec("PRAGMA busy_timeout=0");
    if (!readOnly) {
      db.exec("PRAGMA synchronous=FULL");
      if (process.platform === "darwin")
        db.exec("PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON");
    }
    db.exec(readOnly ? "BEGIN" : "BEGIN EXCLUSIVE");
    validateStandingJournal(
      db,
      enginePolicy(prepared, source).budget,
      source === "live" ? "standing-live" : "standing-emulated",
    );
    const result = work(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (object(error) && (error.errcode === 5 || error.errcode === 6))
      throw Error("dispatcher-already-open");
    throw error;
  } finally {
    db.close();
  }
}

export type StandingCorrespondenceRecovery =
  | { kind: "recorded"; disposition: DispatchDisposition; proposal?: RelayedCorrespondenceProposal }
  | { kind: "missing" }
  | { kind: "held"; holds: StandingCorrespondenceHold[] };

/** Read committed evidence after authority closes. No approval, transport, controller or writes. */
export function readStandingCorrespondenceRecovery(options: {
  prepared: PreparedStandingCorrespondencePolicy;
  stateFile: string;
  deviceId: string;
  deliveryId: string;
  inputDigest: string;
}): StandingCorrespondenceRecovery {
  try {
    const prepared = freeze(options.prepared);
    if (options.deviceId !== prepared.policy.deviceId) throw Error("device-mismatch");
    if (!isIdentifier(options.deliveryId) || !hash(options.inputDigest))
      throw Error("invalid-request");
    const source = prepared.mode === "standing-emulation-prepared" ? "emulated" : "live";
    return withStandingJournal(prepared, options.stateFile, source, true, (db) => {
      const input = db
        .prepare("SELECT * FROM standing_inputs WHERE delivery_id=?")
        .get(options.deliveryId);
      if (!input) return { kind: "missing" };
      if (input.input_digest !== options.inputDigest) throw Error("delivery-conflict");
      const row = db
        .prepare("SELECT * FROM invocations WHERE dispatch_id=?")
        .get(String(input.dispatch_id));
      const disposition = parseStoredDisposition(row);
      const saved = db
        .prepare("SELECT proposal FROM advisory_proposals WHERE dispatch_id=?")
        .get(String(input.dispatch_id));
      let proposal: RelayedCorrespondenceProposal | undefined;
      if (saved) {
        if (
          disposition.kind !== "observed" ||
          disposition.outcome !== "completed" ||
          typeof saved.proposal !== "string"
        )
          throw Error("standing-budget-corrupt");
        const value: unknown = JSON.parse(saved.proposal);
        if (
          !object(value) ||
          !exact(value, "attribution,correspondence,source,verifiedWork") ||
          value.attribution !== "device-relayed-output" ||
          value.verifiedWork !== false ||
          value.source !== (source === "live" ? "supervised-native" : "deterministic-emulator") ||
          !object(value.correspondence)
        )
          throw Error("standing-budget-corrupt");
        const answer = value.correspondence;
        const bounded = (v: unknown, points: number, bytes: number) =>
          typeof v === "string" &&
          [...v].length <= points &&
          Buffer.byteLength(v) <= bytes &&
          !v.includes("\0");
        if (
          !exact(answer, "decision,gaps,needs,reason,text") ||
          !bounded(answer.text, 4000, 8000) ||
          answer.text === "" ||
          !(answer.needs === null || bounded(answer.needs, 1000, 4000)) ||
          !(answer.gaps === null || bounded(answer.gaps, 2000, 8000)) ||
          (answer.decision !== "reply" && answer.decision !== "escalate") ||
          !(
            answer.reason === null ||
            [
              "execution-request",
              "missing-context",
              "sensitive-content",
              "unsupported-request",
            ].includes(String(answer.reason))
          ) ||
          (answer.decision === "reply" && (answer.reason !== null || answer.needs !== null)) ||
          (answer.decision === "escalate" && (answer.reason === null || answer.gaps !== null)) ||
          (answer.reason === "missing-context") !== (answer.needs !== null) ||
          (answer.reason === "missing-context" && answer.needs === "")
        )
          throw Error("standing-budget-corrupt");
        proposal = value as unknown as RelayedCorrespondenceProposal;
      }
      return { kind: "recorded", disposition, ...(proposal ? { proposal } : {}) };
    });
  } catch (error) {
    return { kind: "held", holds: [holdCode(error, "standing-budget-corrupt")] };
  }
}

function open(
  options: StandingCorrespondenceOptions,
  emulation?: {
    script?: CorrespondenceEmulatorScript;
    frames?: CorrespondenceFrameScript;
    now?: () => number;
  },
  recordFrame?: (frame: unknown) => void,
): StandingCorrespondenceOpen & {
  invocations?: () => number;
  qualificationGrant?: { charterId: string; grantRevision: string };
} {
  const prepared = freeze(options.prepared),
    p = prepared.policy;
  const qualification = prepared.mode === "standing-qualification-prepared";
  if (!emulation && prepared.mode === "standing-emulation-prepared") throw Error("live-not-armed");
  const now = emulation?.now ?? Date.now;
  const environment = nativeEnvironment(p.environment);
  let expectedApproval: string | undefined;
  function authority() {
    if (!existsSync(options.runtimeApprovalFile)) throw Error("standing-policy-missing");
    const bytes = readPrivateFile(options.runtimeApprovalFile, 16384).toString("utf8");
    if (expectedApproval && digest(bytes) !== expectedApproval)
      throw Error("standing-policy-changed");
    const approval = parseStandingCorrespondenceApproval(
      JSON.parse(bytes),
      prepared,
      options.stateFile,
      qualification ? "qualification" : "duty",
    );
    if (options.deviceId !== p.deviceId) throw Error("device-mismatch");
    if (now() < approval.startsAtMs) throw Error("not-yet-valid");
    if (now() >= approval.expiresAtMs) throw Error("expired");
    const revocationBytes = readPrivateFile(approval.revocationFile, 4096).toString("utf8");
    const revocation: unknown = JSON.parse(revocationBytes);
    if (
      !object(revocation) ||
      !exact(revocation, "deviceId,lineageId,revoked,schemaVersion") ||
      revocation.schemaVersion !== 1 ||
      revocation.lineageId !== p.lineageId ||
      revocation.deviceId !== p.deviceId ||
      typeof revocation.revoked !== "boolean"
    )
      throw Error("standing-policy-changed");
    if (revocation.revoked) throw Error("standing-policy-revoked");
    if (digest(revocationBytes) !== approval.revocationDigest)
      throw Error("standing-policy-changed");
    expectedApproval = digest(bytes);
    return approval;
  }
  function nativeChecks() {
    if (emulation) return;
    checkNativeEnvironment(environment, ["HOME", "CODEX_HOME"]);
    checkPinnedTemporaryDirectory(p.environment.TMPDIR);
    for (const b of p.bindings) {
      checkPrivateDirectory(b.cwd);
      if (readdirSync(b.cwd).length) throw Error("unsafe-local-state");
    }
    for (const profile of p.profiles) {
      checkBinary(profile);
      if (!qualification) checkCorrespondenceQualification(profile);
      checkNativeProfile(profile, environment, ["HOME", "CODEX_HOME"]);
    }
  }
  function inspect(admission = false): RefusalReason | undefined {
    try {
      authority();
      if (admission) {
        nativeChecks();
        authority();
      }
      return undefined;
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      return (
        [
          "expired",
          "not-yet-valid",
          "standing-policy-missing",
          "standing-policy-changed",
          "standing-policy-revoked",
        ] as string[]
      ).includes(code)
        ? (code as RefusalReason)
        : "standing-policy-changed";
    }
  }
  let approval: StandingCorrespondenceApproval | undefined;
  try {
    if (options.deviceId !== p.deviceId) throw Error("device-mismatch");
    const initialHold = withStandingJournal(
      prepared,
      options.stateFile,
      emulation ? "emulated" : "live",
      false,
      (db) => {
        const prior = db
          .prepare("SELECT authority_id FROM standing_authorities WHERE path=?")
          .get(options.runtimeApprovalFile);
        const close = (id: unknown, reason: string) => {
          if (typeof id === "string")
            db.prepare("INSERT OR IGNORE INTO standing_closed_grants VALUES(?,?)").run(id, reason);
        };
        let bytes: string;
        try {
          bytes = readPrivateFile(options.runtimeApprovalFile, 16384).toString("utf8");
        } catch {
          close(prior?.authority_id, "standing-policy-missing");
          return "standing-policy-missing" as const;
        }
        expectedApproval = digest(bytes);
        if (prior && prior.authority_id !== expectedApproval)
          close(prior.authority_id, "standing-policy-changed");
        db.prepare(
          "INSERT INTO standing_authorities VALUES(?,?) ON CONFLICT(path) DO UPDATE SET authority_id=excluded.authority_id",
        ).run(options.runtimeApprovalFile, expectedApproval);
        const closed = db
          .prepare("SELECT reason FROM standing_closed_grants WHERE authority_id=?")
          .get(expectedApproval);
        if (closed) return closed.reason as StandingCorrespondenceHold;
        try {
          approval = authority();
          nativeChecks();
          authority();
          return undefined;
        } catch (error) {
          const code = holdCode(error, "runtime-approval-invalid");
          if (
            [
              "expired",
              "standing-policy-missing",
              "standing-policy-changed",
              "standing-policy-revoked",
              "runtime-approval-invalid",
              "unsafe-local-state",
            ].includes(code)
          )
            close(
              expectedApproval,
              ["runtime-approval-invalid", "unsafe-local-state"].includes(code)
                ? "standing-policy-changed"
                : code,
            );
          return code;
        }
      },
    );
    if (initialHold)
      return { kind: "held", policyDigest: prepared.policyDigest, holds: [initialHold] };
    if (!approval) throw Error("runtime-approval-invalid");
  } catch (error) {
    return {
      kind: "held",
      policyDigest: prepared.policyDigest,
      holds: [holdCode(error, "standing-budget-corrupt")],
    };
  }
  const native = nativePlan(prepared);
  const emulator = emulation?.frames
    ? createCorrespondenceFrameEmulator(emulation.frames, recordFrame)
    : emulation
      ? createCorrespondenceEmulator(emulation.script!)
      : undefined;
  const transport =
    emulator?.transport ??
    createCorrespondenceTransport(
      native,
      approval.expiresAtMs,
      environment,
      () => {
        const hold = engine?.checkStandingAuthority?.();
        if (hold) throw Error(hold);
        checkNativeEnvironment(environment, ["HOME", "CODEX_HOME"]);
        checkPinnedTemporaryDirectory(p.environment.TMPDIR);
        const finalHold = engine?.checkStandingAuthority?.();
        if (finalHold) throw Error(finalHold);
      },
      recordFrame,
      qualification
        ? undefined
        : (profile) => correspondenceBuiltins(profile) ?? { agents: [], plugins: [] },
    );
  let engine: ReturnType<typeof openCorrespondenceDispatcher<RelayedCorrespondenceProposal>>;
  try {
    engine = openCorrespondenceDispatcher<RelayedCorrespondenceProposal>({
      stateFile: options.stateFile,
      now,
      ...config(prepared, approval, emulation ? "mechanical" : "supervised"),
      transport,
      beforeInvoke: () => inspect(true),
      standing: {
        ...enginePolicy(prepared, emulation ? "emulated" : "live"),
        authorityId: expectedApproval!,
        checkActiveAuthority: inspect,
      },
      claudeVersions:
        emulation || qualification
          ? p.profiles.map((x) => x.nativeVersion)
          : qualifiedCorrespondenceVersions(),
    });
  } catch (error) {
    return {
      kind: "held",
      policyDigest: prepared.policyDigest,
      holds: [holdCode(error, "standing-budget-corrupt")],
    };
  }
  const dispatcher: StandingCorrespondenceDispatcher = {
    ...engine,
    dispatch: async (input, settings) => {
      let request: DispatchRequest;
      try {
        request = parseDispatchRequest(input);
      } catch {
        return { kind: "refused", reason: "invalid-request" };
      }
      if (
        request.workflow !== "correspondence" ||
        ![request.streamId, request.eventId, request.messageId, request.threadId].every((v) =>
          UUID.test(v),
        )
      )
        return { kind: "refused", reason: "invalid-request" };
      // Recovery is read-only; revoked/expired grants must not hide earlier accepted evidence.
      if (!engine.lookup(request.deliveryId) && !qualification) {
        const packet = parseCorrespondencePacket(request.task.input);
        // LocalHelp MUST compare these claims to the authenticated journal writer before calling Core.
        // This comparison enforces the allowlist; it cannot authenticate a caller-supplied packet.
        const origin = settings?.authenticatedOrigin;
        if (
          !origin ||
          origin.deviceId !== packet.request.sender.device_id ||
          origin.sessionId !== packet.request.sender.session_id ||
          !p.origins.some((o) => o.deviceId === origin.deviceId && o.sessionId === origin.sessionId)
        )
          return { kind: "refused", reason: "standing-origin-denied" };
        if (
          packet.duty.device_id !== p.deviceId ||
          packet.duty.session_id !== request.recipient ||
          !ADDRESS.test(request.recipient)
        )
          return { kind: "refused", reason: "invalid-request" };
        const capability = packet.local_status ? "listener-status" : "correspondence";
        if (!p.capabilities.includes(capability))
          return { kind: "refused", reason: "resource-denied" };
        if (
          packet.local_status &&
          (now() - packet.local_status.observedAtMs < 0 ||
            now() - packet.local_status.observedAtMs > 60000)
        )
          return { kind: "refused", reason: "invalid-request" };
      }
      const abort = new AbortController();
      const stop = () => {
        try {
          if (engine.checkStandingAuthority?.()) abort.abort();
        } catch {
          abort.abort();
        }
      };
      const timer = setInterval(stop, 250);
      timer.unref();
      try {
        return await engine.dispatch(request, {
          signal: settings?.signal
            ? AbortSignal.any([settings.signal, abort.signal])
            : abort.signal,
        });
      } finally {
        clearInterval(timer);
      }
    },
  };
  return {
    kind: "ready",
    policyDigest: prepared.policyDigest,
    dispatcher,
    ...(qualification
      ? {
          qualificationGrant: {
            charterId: approval.grantId,
            grantRevision: standingCorrespondenceGrantRevision(prepared, p.bindings[0].alias),
          },
        }
      : {}),
    ...(emulator && "invocations" in emulator ? { invocations: emulator.invocations } : {}),
  };
}
export const openStandingCorrespondence = (
  options: StandingCorrespondenceOptions,
): StandingCorrespondenceOpen => {
  if (options.prepared.mode !== "standing-correspondence-prepared") throw Error("live-not-armed");
  return open(options);
};
export const openStandingCorrespondenceEmulation = (
  options: StandingCorrespondenceOptions & {
    script: CorrespondenceEmulatorScript;
    now?: () => number;
  },
) => open(options, options);
/** The same host journal/controller and rolling allowance as standing duty; its own one-turn grant. */
export async function qualifyStandingClaudeCorrespondence(options: StandingCorrespondenceOptions) {
  if (options.prepared.mode !== "standing-qualification-prepared") throw Error("live-not-armed");
  const frames: unknown[] = [];
  const opened = open(options, undefined, (frame) => frames.push(frame));
  if (opened.kind === "held") return opened;
  const prepared = freeze(options.prepared);
  return runQualificationTurn(
    nativePlan(prepared),
    opened.dispatcher,
    frames,
    "recorded",
    opened.qualificationGrant!,
  );
}
export async function qualifyStandingClaudeCorrespondenceEmulation(
  options: StandingCorrespondenceOptions & {
    frames: CorrespondenceFrameScript;
    now?: () => number;
  },
) {
  if (options.prepared.mode !== "standing-qualification-prepared") throw Error("live-not-armed");
  const frames: unknown[] = [];
  const opened = open(options, options, (frame) => frames.push(frame));
  if (opened.kind === "held") return opened;
  const prepared = freeze(options.prepared);
  return runQualificationTurn(
    nativePlan(prepared),
    opened.dispatcher,
    frames,
    "emulated",
    opened.qualificationGrant!,
  );
}
