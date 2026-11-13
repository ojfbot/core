import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Operator-owned, read-only verification of the canonical accepted attempt. */
export function verifyAccepted(jobDb, outDir, key, expectedDigest) {
  const db = new DatabaseSync(jobDb, { readOnly: true });
  let row;
  try {
    row = db
      .prepare("SELECT key, status, worker, fence, output, output_file FROM jobs WHERE key = ?")
      .get(key);
  } finally {
    db.close();
  }
  assert.equal(row?.status, "done", "No accepted job result");
  assert.equal(row.output_file, `${key}.${row.fence}.jsonl`, "Unexpected accepted artifact path");
  const bytes = readFileSync(join(outDir, row.output_file));
  const digest = sha256(bytes);
  assert.equal(digest, row.output, "Accepted file differs from the canonical digest");
  assert.equal(digest, expectedDigest, "Accepted bytes differ from the approved fixture");
  return {
    job_key: key,
    worker: row.worker,
    fence: row.fence,
    file: row.output_file,
    size_bytes: bytes.length,
    sha256: digest,
    expected_sha256: expectedDigest,
    verified: true,
    verification: "read-only canonical job record plus SHA-256 of accepted file bytes",
  };
}

/**
 * One explicitly approved fixture. Peer text never supplies executable code or a JobSpec.
 * The caller is the operator, holding existing clients; this is not delegated HelpDesk authority.
 */
export async function roundtrip({ helpdesk, fleet, request, manifest, runWorker, jobDb, outDir }) {
  const thread = await helpdesk.readThread(request.thread_id);
  const original = thread.messages.find((message) => message.message_id === request.message_id);
  assert.equal(original?.sender.device_id, manifest.requester, "Wrong request author");
  assert.equal(original.body, manifest.request_body, "Request is outside the approved fixture");
  assert.ok(original.recipients.some((address) => address.device_id === manifest.operator));

  const admission = await fleet.enqueue(manifest.job);
  assert.equal(admission.key, manifest.expected_job_key, "Unexpected admitted job");
  const worker = await runWorker();
  const artifact = verifyAccepted(jobDb, outDir, admission.key, manifest.expected_sha256);
  assert.equal(artifact.worker, manifest.worker, "Unexpected accepting worker");

  const body = `${JSON.stringify({
    work_ref: manifest.work_ref,
    request_message_id: request.message_id,
    job_key: artifact.job_key,
    artifact_sha256: artifact.sha256,
    status: "verified",
  })}\n`;
  const reply = await helpdesk.postMessage(request.thread_id, {
    command_id: manifest.reply_command_id,
    recipients: [{ device_id: manifest.requester }],
    in_reply_to: request.message_id,
    body,
  });
  return { admission, worker, artifact, reply, reply_body: body };
}
