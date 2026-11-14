import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import type {
  DispatchGrant,
  DispatchRequest,
  DutyBinding,
  NativeProfile,
  RefusalReason,
} from "./types.js";

export interface DispatchConfiguration {
  bindings: DutyBinding[];
  grants: DispatchGrant[];
  profiles: NativeProfile[];
}

export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 512 && !value.includes("\0")
  );
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 64 && value.every(text);
}
export const digest = (input: string) => createHash("sha256").update(input).digest("hex");

export function parseDispatchRequest(value: unknown): DispatchRequest {
  if (!object(value)) throw Error("invalid-request");
  const {
    deliveryId,
    streamId,
    eventId,
    messageId,
    threadId,
    sequence,
    recipient,
    bindingRevision,
    charterId,
    grantRevision,
    profileRevision,
    workflow,
    resources,
    task,
  } = value;
  if (
    ![
      deliveryId,
      streamId,
      eventId,
      messageId,
      threadId,
      recipient,
      bindingRevision,
      charterId,
      grantRevision,
      profileRevision,
    ].every(text) ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    sequence < 0 ||
    workflow !== "advisory-review" ||
    !strings(resources) ||
    !object(task) ||
    typeof task.input !== "string" ||
    Buffer.byteLength(task.input) > 4096 ||
    typeof task.inputDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(task.inputDigest) ||
    digest(task.input) !== task.inputDigest
  )
    throw Error("invalid-request");
  // Prove each primitive at the boundary; Array.every cannot narrow separate bindings.
  if (
    !text(deliveryId) ||
    !text(streamId) ||
    !text(eventId) ||
    !text(messageId) ||
    !text(threadId) ||
    !text(recipient) ||
    !text(bindingRevision) ||
    !text(charterId) ||
    !text(grantRevision) ||
    !text(profileRevision)
  )
    throw Error("invalid-request");
  const pointer: unknown = JSON.parse(task.input);
  if (
    !object(pointer) ||
    Object.keys(pointer).sort().join(",") !==
      "bindingRevision,message_id,sequence,stream_id,thread_id" ||
    pointer.message_id !== messageId ||
    pointer.thread_id !== threadId ||
    pointer.sequence !== sequence ||
    pointer.stream_id !== streamId ||
    pointer.bindingRevision !== bindingRevision
  )
    throw Error("invalid-request");
  return {
    deliveryId,
    streamId,
    eventId,
    messageId,
    threadId,
    sequence,
    recipient,
    bindingRevision,
    charterId,
    grantRevision,
    profileRevision,
    workflow,
    resources: [...resources],
    task: { input: task.input, inputDigest: task.inputDigest },
  };
}

export function validateConfiguration(config: DispatchConfiguration): void {
  const aliases = new Set<string>(),
    revisions = new Set<string>(),
    grants = new Set<string>();
  for (const b of config.bindings) {
    if (
      !text(b.alias) ||
      aliases.has(b.alias) ||
      !text(b.revision) ||
      !text(b.deviceId) ||
      !["codex", "claude-code"].includes(b.provider) ||
      !text(b.nativeSessionId) ||
      !isAbsolute(b.cwd) ||
      b.cwd.includes("\0") ||
      !text(b.profileRevision) ||
      !strings(b.resources) ||
      typeof b.held !== "boolean"
    )
      throw Error("invalid-binding");
    aliases.add(b.alias);
  }
  for (const p of config.profiles) {
    if (
      !text(p.revision) ||
      revisions.has(p.revision) ||
      !text(p.model) ||
      !(
        p.provider === "codex"
          ? ["0.165.0-alpha.1.2", "0.164.0"]
          : p.provider === "claude-code"
            ? ["2.1.286", "2.1.308"]
            : []
      ).includes(p.nativeVersion)
    )
      throw Error("unqualified-profile");
    revisions.add(p.revision);
  }
  for (const g of config.grants) {
    const key = `${g.charterId}\0${g.revision}`;
    if (
      ![g.charterId, g.revision, g.bindingAlias, g.budgetScope].every(text) ||
      grants.has(key) ||
      g.operation !== "native-resume" ||
      g.workflow !== "advisory-review" ||
      g.mode !== "mechanical" ||
      !strings(g.resources) ||
      typeof g.held !== "boolean" ||
      !Number.isSafeInteger(g.validFromMs) ||
      !Number.isSafeInteger(g.expiresAtMs) ||
      g.expiresAtMs <= g.validFromMs ||
      !Number.isSafeInteger(g.maxInvocations) ||
      g.maxInvocations < 1 ||
      !Number.isSafeInteger(g.scopeMaxInvocations) ||
      g.scopeMaxInvocations < 1
    )
      throw Error("invalid-grant");
    grants.add(key);
  }
}

export type Admission =
  | { kind: "invoke"; binding: DutyBinding; grant: DispatchGrant; profile: NativeProfile }
  | { kind: "refused"; reason: RefusalReason };

export function decide(
  request: DispatchRequest,
  config: DispatchConfiguration,
  now: number,
): Admission {
  const binding = config.bindings.find((b) => b.alias === request.recipient);
  if (!binding) return { kind: "refused", reason: "unassigned" };
  if (binding.revision !== request.bindingRevision)
    return { kind: "refused", reason: "binding-mismatch" };
  const profile = config.profiles.find(
    (p) =>
      p.revision === request.profileRevision &&
      p.revision === binding.profileRevision &&
      p.provider === binding.provider,
  );
  if (!profile) return { kind: "refused", reason: "profile-mismatch" };
  const grant = config.grants.find(
    (g) =>
      g.charterId === request.charterId &&
      g.revision === request.grantRevision &&
      g.bindingAlias === binding.alias &&
      g.workflow === request.workflow,
  );
  if (!grant) return { kind: "refused", reason: "grant-mismatch" };
  if (grant.mode !== "mechanical") return { kind: "refused", reason: "live-not-armed" };
  if (binding.held || grant.held) return { kind: "refused", reason: "held" };
  if (now < grant.validFromMs) return { kind: "refused", reason: "not-yet-valid" };
  if (now >= grant.expiresAtMs) return { kind: "refused", reason: "expired" };
  if (request.resources.some((r) => !binding.resources.includes(r) || !grant.resources.includes(r)))
    return { kind: "refused", reason: "resource-denied" };
  return { kind: "invoke", binding, grant, profile };
}
