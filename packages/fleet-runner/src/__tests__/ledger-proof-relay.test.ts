import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canonicalJson } from "../jobs.js";
import { parseLedgerProof, proofHash } from "../ledger-proof.js";
import { postProofRelay, readProofRelay, type ProofRelay } from "../ledger-proof-relay.js";
const command = vi.hoisted(() => vi.fn());
vi.mock("../ledger-proof-command.js", async (original) => ({
  ...(await original<typeof import("../ledger-proof-command.js")>()),
  runProofCommand: command,
}));
let relay: ProofRelay, dir: string;
const proof = parseLedgerProof({
  schemaVersion: 1,
  proofId: "12345678-1234-4234-8234-123456789abc",
  startsAtMs: 1000,
  endsAtMs: 9000,
  approvalExpiresAtMs: 10000,
  code: "a".repeat(40),
  fixtureSha256: "b".repeat(64),
  timeZone: "UTC",
  primary: "cg307-primary-12345678",
  fallback: "cg307-fallback-12345678",
  capability: "cg307-ledger-12345678",
});
const id = "12345678-1234-4234-8234-123456789abc";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "proof-relay-"));
  relay = {
    proof,
    adapter: {
      program: process.execPath,
      args: ["/installed/adapter.mjs"],
      sha256: "c".repeat(64),
      files: {},
    },
    environment: {},
    device: "primary",
    primaryDevice: "primary",
    fallbackDevice: "fallback",
    session: "ledger-proof",
    thread: id,
    stream: id,
    directory: dir,
    startAfter: 100,
  };
});
afterEach(() => {
  vi.clearAllMocks();
  rmSync(dir, { recursive: true, force: true });
});
function message(report: unknown, writer = "primary") {
  const body = canonicalJson({
    schemaVersion: 1,
    proofId: proof.proofId,
    planSha256: proofHash(canonicalJson(proof)),
    report,
  });
  return {
    thread_id: id,
    message_id: id,
    sequence: 101,
    writer,
    sender: { device_id: writer, session_id: relay.session },
    recipients: [
      { device_id: "primary", session_id: relay.session },
      { device_id: "fallback", session_id: relay.session },
    ],
    body,
    body_bytes: Buffer.byteLength(body),
    body_sha256: proofHash(body),
  };
}
it("persists exactly the same command envelope across ambiguous writes and verifies the accepted journal readback", async () => {
  let saved: unknown;
  let first = true;
  command.mockImplementation(async (cmd) => {
    if (cmd.args.includes("POST")) {
      const file = cmd.args[cmd.args.indexOf("--body-file") + 1];
      const envelope = JSON.parse(readFileSync(file, "utf8"));
      if (!saved) saved = envelope;
      else expect(envelope).toEqual(saved);
      if (first) {
        first = false;
        throw Error("lost response");
      }
      return { accepted: true, thread_id: id, stream_id: id, sequence: 101, message_id: id };
    }
    return { stream_id: id, messages: [message({ state: "HELD", reason: "no-eligible-worker" })] };
  });
  const input = {
    proofId: id,
    commandId: id,
    body: { state: "HELD", reason: "no-eligible-worker" },
  };
  await expect(postProofRelay(relay, input)).rejects.toThrow("lost response");
  expect(await postProofRelay(relay, input)).toEqual({
    accepted: true,
    commandId: id,
    sequence: 101,
    readbackVerified: true,
  });
  await expect(postProofRelay(relay, { ...input, body: { state: "PASS" } })).rejects.toThrow(
    "proof-relay-command-conflict",
  );
});
it("rejects forged origin, altered bytes and another service lineage without calling delivery verified", async () => {
  command
    .mockResolvedValueOnce({
      accepted: true,
      thread_id: id,
      stream_id: id,
      sequence: 101,
      message_id: id,
    })
    .mockResolvedValueOnce({ stream_id: id, messages: [message({ state: "HELD" }, "fallback")] });
  await expect(
    postProofRelay(relay, { proofId: id, commandId: id, body: { state: "HELD" } }),
  ).rejects.toThrow("proof-relay-readback-mismatch");
  const m = message({ state: "READY", role: "primary" });
  m.body += "changed";
  command.mockResolvedValue({ stream_id: id, messages: [m], next_after: 101, has_more: false });
  await expect(readProofRelay(relay, "ready")).rejects.toThrow("proof-relay-body-mismatch");
  command.mockResolvedValue({ stream_id: "another-lineage", messages: [], next_after: 102 });
  await expect(readProofRelay(relay, "ready")).rejects.toThrow("proof-relay-lineage-mismatch");
});
it("recovers its consumed cursor and accepts readiness only from each bound role", async () => {
  command.mockResolvedValue({
    stream_id: id,
    messages: [
      message({ state: "READY", role: "primary", observedAtMs: 1234, idleRestartVerified: true }),
      message({ state: "READY", role: "fallback", observedAtMs: 1235 }, "fallback"),
    ],
    next_after: 102,
    has_more: false,
  });
  expect(await readProofRelay(relay, "ready")).toMatchObject({
    primaryReady: true,
    fallbackReady: true,
    primaryIdleRestartVerified: true,
    observedAtMs: 1234,
  });
  command.mockResolvedValue({ stream_id: id, messages: [], next_after: 102, has_more: false });
  expect(await readProofRelay(relay, "ready")).toMatchObject({
    primaryReady: true,
    fallbackReady: true,
  });
  expect(command.mock.calls.at(-1)![0].args.join(" ")).toContain("after=102");
});
