import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson } from "./jobs.js";
import {
  exact,
  integer,
  object,
  privatePath,
  proofHash,
  string,
  type LedgerProof,
} from "./ledger-proof.js";
import { parseProofCommand, runProofCommand, type ProofCommand } from "./ledger-proof-command.js";
import { ProofJournal } from "./ledger-proof-state.js";

export interface ProofRelay {
  proof: LedgerProof;
  adapter: ProofCommand;
  environment: Record<string, string>;
  thread: string;
  stream: string;
  device: string;
  session: string;
  primaryDevice: string;
  fallbackDevice: string;
  directory: string;
  startAfter: number;
}
export function parseProofRelay(value: unknown, proof: LedgerProof): ProofRelay {
  const r = exact(value, [
    "adapter",
    "environment",
    "thread",
    "stream",
    "device",
    "session",
    "primaryDevice",
    "fallbackDevice",
    "directory",
    "startAfter",
  ]);
  const env = object(r.environment),
    environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (
      ![
        "HELPDESK_URL",
        "HELPDESK_DEVICE_WRITER",
        "HELPDESK_DEVICE_KEY",
        "NODE_EXTRA_CA_CERTS",
      ].includes(key)
    )
      throw Error("proof-relay-environment-refused");
    environment[key] = string(value);
  }
  const device = string(r.device, /^[a-z0-9][a-z0-9_-]{0,63}$/);
  if (
    environment.HELPDESK_DEVICE_WRITER !== device ||
    !environment.HELPDESK_URL?.startsWith("https://")
  )
    throw Error("proof-relay-identity-mismatch");
  return {
    proof,
    adapter: parseProofCommand(r.adapter),
    environment,
    thread: string(r.thread, /^[a-f0-9-]{36}$/),
    stream: string(r.stream, /^[a-f0-9-]{36}$/),
    device,
    session: string(r.session, /^[a-z0-9][a-z0-9_-]{2,31}$/),
    primaryDevice: string(r.primaryDevice),
    fallbackDevice: string(r.fallbackDevice),
    directory: privatePath(r.directory),
    startAfter: integer(r.startAfter),
  };
}
async function request(
  relay: ProofRelay,
  method: "GET" | "POST",
  path: string,
  file?: string,
): Promise<unknown> {
  return runProofCommand(
    {
      ...relay.adapter,
      args: [
        ...relay.adapter.args,
        "request",
        method,
        path,
        ...(file ? ["--body-file", file, "--content-type", "application/json"] : []),
      ],
    },
    {},
    undefined,
    30_000,
    relay.environment,
  );
}
function messageBody(
  relay: ProofRelay,
  value: unknown,
): { message: Record<string, unknown>; body: Record<string, unknown> } | null {
  const message = object(value);
  if (
    message.thread_id !== relay.thread ||
    ![relay.primaryDevice, relay.fallbackDevice].includes(String(message.writer))
  )
    return null;
  const sender = object(message.sender);
  if (sender.device_id !== message.writer || sender.session_id !== relay.session) return null;
  const body = string(message.body);
  if (
    Buffer.byteLength(body) > 8192 ||
    Buffer.byteLength(body) !== message.body_bytes ||
    proofHash(body) !== message.body_sha256
  )
    throw Error("proof-relay-body-mismatch");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  const row = object(parsed);
  if (
    row.schemaVersion !== 1 ||
    row.proofId !== relay.proof.proofId ||
    row.planSha256 !== proofHash(canonicalJson(relay.proof))
  )
    return null;
  if (
    !Array.isArray(message.recipients) ||
    !message.recipients.some((recipient) => {
      const r = object(recipient);
      return r.device_id === relay.device && r.session_id === relay.session;
    })
  )
    return null;
  return { message, body: object(row.report) };
}
export async function postProofRelay(relay: ProofRelay, input: unknown): Promise<unknown> {
  const row = exact(input, ["proofId", "commandId", "body"]);
  if (row.proofId !== relay.proof.proofId) throw Error("proof-relay-proof-mismatch");
  const id = string(row.commandId, /^[a-f0-9-]{36}$/),
    report = object(row.body);
  const allowed = new Set([
    "proofId",
    "state",
    "role",
    "observedAtMs",
    "idleRestartVerified",
    "code",
    "fixtureSha256",
    "key",
    "fence",
    "facts",
    "kind",
    "reason",
    "owner",
    "nextAction",
    "resultSha256",
    "runtimeModelCalls",
    "runnerCode",
    "runnerVersion",
  ]);
  if (Object.keys(report).some((key) => !allowed.has(key))) throw Error("proof-relay-body-refused");
  const body = canonicalJson({
    schemaVersion: 1,
    proofId: relay.proof.proofId,
    planSha256: proofHash(canonicalJson(relay.proof)),
    report,
  });
  if (Buffer.byteLength(body) > 8192) throw Error("proof-relay-body-refused");
  const envelope = {
    command_id: id,
    session_id: relay.session,
    recipients: [...new Set([relay.primaryDevice, relay.fallbackDevice])].map((device_id) => ({
      device_id,
      session_id: relay.session,
    })),
    body,
  };
  const file = join(relay.directory, `post-${id}.json`),
    encoded = `${canonicalJson(envelope)}\n`;
  if (existsSync(file)) {
    if (readFileSync(file, "utf8") !== encoded) throw Error("proof-relay-command-conflict");
  } else writeFileSync(file, encoded, { flag: "wx", mode: 0o600 });
  const receipt = object(
    await request(relay, "POST", `/helpdesk/api/threads/${relay.thread}/messages`, file),
  );
  if (
    receipt.accepted !== true ||
    receipt.thread_id !== relay.thread ||
    receipt.stream_id !== relay.stream
  )
    throw Error("proof-relay-send-unverified");
  const sequence = integer(receipt.sequence),
    messageId = string(receipt.message_id);
  const page = object(
    await request(
      relay,
      "GET",
      `/helpdesk/api/threads/${relay.thread}?after=${sequence - 1}&limit=1`,
    ),
  );
  if (page.stream_id !== relay.stream || !Array.isArray(page.messages))
    throw Error("proof-relay-lineage-mismatch");
  const found = page.messages.find((value) => object(value).sequence === sequence);
  if (!found) throw Error("proof-relay-readback-missing");
  const verified = messageBody(relay, found);
  if (
    !verified ||
    verified.message.message_id !== messageId ||
    verified.message.writer !== relay.device ||
    verified.message.body !== body
  )
    throw Error("proof-relay-readback-mismatch");
  return { accepted: true, commandId: id, sequence, readbackVerified: true };
}
export async function readProofRelay(
  relay: ProofRelay,
  phase: "ready" | "fault",
): Promise<unknown> {
  const state = join(relay.directory, "relay.sqlite");
  const journal = new ProofJournal(
    state,
    { thread: relay.thread, stream: relay.stream, proof: relay.proof },
    !existsSync(state),
  );
  try {
    for (let pageCount = 0; pageCount < 20; pageCount++) {
      const after = journal.get("cursor") ?? relay.startAfter;
      const page = object(
        await request(
          relay,
          "GET",
          `/helpdesk/api/threads/${relay.thread}?after=${integer(after)}&limit=10`,
        ),
      );
      if (page.stream_id !== relay.stream || !Array.isArray(page.messages))
        throw Error("proof-relay-lineage-mismatch");
      for (const value of page.messages) {
        const verified = messageBody(relay, value);
        if (!verified) continue;
        const { message, body } = verified;
        if (body.state === "READY") {
          if (body.role === "primary" && message.writer === relay.primaryDevice)
            journal.put("primary-ready", { ...body, sequence: message.sequence });
          if (body.role === "fallback" && message.writer === relay.fallbackDevice)
            journal.put("fallback-ready", { ...body, sequence: message.sequence });
        }
        if (body.state === "stale-rejected" && message.writer === relay.primaryDevice)
          journal.put("fault", object(body.facts));
      }
      journal.put("cursor", integer(page.next_after));
      if (page.has_more !== true) break;
      if (pageCount === 19) throw Error("proof-relay-backlog-held");
    }
    const base = {
      proofId: relay.proof.proofId,
      authenticatedReadback: true,
      lineageVerified: true,
    };
    if (phase === "fault")
      return {
        ...base,
        ...(journal.get("fault") ? object(journal.get("fault")) : { pending: true }),
      };
    const primary = journal.get("primary-ready"),
      fallback = journal.get("fallback-ready");
    return {
      ...base,
      primaryReady: !!primary,
      fallbackReady: !!fallback,
      primaryIdleRestartVerified: primary ? object(primary).idleRestartVerified === true : false,
      observedAtMs:
        primary && fallback
          ? Math.min(integer(object(primary).observedAtMs), integer(object(fallback).observedAtMs))
          : 0,
    };
  } finally {
    journal.close();
  }
}
