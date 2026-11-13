import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateToken } from "../../packages/fleet-runner/dist/auth.js";
import { fleetClient } from "../../packages/fleet-runner/dist/client.js";
import { JobStore, jobKey, writeOutput } from "../../packages/fleet-runner/dist/jobs.js";
import { fleetServer } from "../../packages/fleet-runner/dist/server.js";
import { workOnce } from "../../packages/fleet-runner/dist/worker.js";
import { sha256, verifyAccepted } from "./helpdesk-roundtrip.mjs";

assert.equal(process.versions.node, "24.22.2", "Use the repository-pinned Node runtime");
assert.equal(
  process.argv.length,
  5,
  "usage: verify-helpdesk-bundle.mjs <built-LocalHelp-root> <599-bundle.zip> <new-evidence-dir>",
);
const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
execFileSync("git", ["diff", "--quiet", "HEAD", "--"], { cwd: coreRoot });
const code = execFileSync("git", ["rev-parse", "HEAD"], { cwd: coreRoot, encoding: "utf8" }).trim();
const helpdeskRoot = resolve(process.argv[2]);
const bundle = resolve(process.argv[3]);
const evidence = resolve(process.argv[4]);
const bundleName = "helpdesk-fleetrunner-trace-20261113.zip";
const expectedDigest = "c57717be0317cbb284e4e98d520e00ab6f38588d165cb6817e87d06f4a963d48";
const bytes = readFileSync(bundle);
assert.equal(basename(bundle), bundleName);
assert.equal(bytes.length, 37_000, "The saved #599 bundle has changed size");
assert.equal(
  sha256(bytes),
  expectedDigest,
  "The saved #599 bundle differs from its recorded digest",
);
assert.equal(
  process.env.HELPDESK_DEVICE_WRITER,
  "yuri",
  "This bounded run uses Yuri's existing enrollment",
);
const { clientFromEnvironment } = await import(
  pathToFileURL(join(helpdeskRoot, "packages/helpdesk-device/dist/config.js")).href
);
const helpdesk = await clientFromEnvironment();
await helpdesk.presence(); // Establish signed live access before starting work.

process.umask(0o077);
mkdirSync(evidence, { mode: 0o700 });
const save = (name, value) =>
  writeFileSync(join(evidence, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
const keys = join(evidence, "temporary-fleet-keys");
const accepted = join(evidence, "accepted");
const jobDb = join(evidence, "jobs.sqlite");
mkdirSync(keys);
mkdirSync(accepted);
let server;
let store;
let executions = 0;
try {
  for (const identity of ["owner", "bundle-worker"]) generateToken(join(keys, identity));
  store = new JobStore(jobDb);
  server = fleetServer(store, {
    registry: keys,
    outDir: accepted,
    inputDir: join(evidence, "inputs"),
  });
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const owner = fleetClient(endpoint, "owner", join(keys, "owner"));
  const worker = fleetClient(endpoint, "bundle-worker", join(keys, "bundle-worker"));
  const workRef = "helpdesk-bundle-20261113";
  const requestBody = `${JSON.stringify({
    action: "verify-evidence-bundle",
    bundle: bundleName,
    expected_sha256: expectedDigest,
    expected_size_bytes: bytes.length,
    work_ref: workRef,
  })}\n`;
  const submission = {
    command_id: randomUUID(),
    session_id: workRef,
    subject: "Verify the saved #599 evidence bundle through FleetRunner",
    recipients: [{ device_id: "yuri" }, { device_id: "yojimbo" }],
    body: requestBody,
  };
  const replyCommand = randomUUID();
  save("submission.json", { submission, reply_command_id: replyCommand });
  assert.equal(await owner.uploadInput(bytes), expectedDigest);
  const request = await helpdesk.createThread(submission);
  save("request.json", {
    receipt: request,
    readback: await helpdesk.readThread(request.thread_id),
  });
  assert.equal(request.duplicate, false);

  const job = {
    kind: "verify-evidence-bundle",
    inputs: [expectedDigest],
    params: {
      request_message_id: request.message_id,
      expected_sha256: expectedDigest,
      expected_size_bytes: bytes.length,
    },
    code,
    payload: null,
    requires: ["evidence-bundle-verification"],
    priority: 0,
    maxAttempts: 1,
  };
  const expectedReceipt = {
    bundle: bundleName,
    request_message_id: request.message_id,
    input_sha256: expectedDigest,
    size_bytes: bytes.length,
    code_revision: code,
    verified: true,
  };
  const expectedOutput = Buffer.from(`${JSON.stringify(expectedReceipt)}\n`);
  save("manifest.json", {
    work_ref: workRef,
    code_revision: code,
    operator_script_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    source_base: "324711ba76b249b266753aa23486c36a9227a767",
    requester_and_operator: "yuri",
    worker: "bundle-worker",
    request_body: requestBody,
    job,
    expected_job_key: jobKey(job),
    expected_artifact_sha256: sha256(expectedOutput),
    expected_receipt: expectedReceipt,
    scope:
      "One operator-approved live HelpDesk request; temporary loopback FleetRunner; no delegation or deployment.",
  });

  const execute = async (selected) => {
    const thread = await helpdesk.readThread(selected.thread_id);
    const original = thread.messages.find((message) => message.message_id === selected.message_id);
    assert.equal(original?.sender.device_id, "yuri", "Wrong request author");
    assert.equal(original.body, requestBody, "Request differs from the operator-approved contents");
    assert.ok(original.recipients.some((address) => address.device_id === "yuri"));
    const admission = await owner.enqueue(job);
    assert.equal(admission.key, jobKey(job));
    const workerResult = await workOnce(worker, {
      caps: ["evidence-bundle-verification"],
      outDir: join(evidence, "worker-attempts"),
      signal: AbortSignal.timeout(60_000),
      handlers: {
        "verify-evidence-bundle": async (claim, context) => {
          executions += 1;
          assert.equal(claim.code, code);
          assert.deepEqual(claim.inputs, job.inputs);
          assert.deepEqual(claim.params, job.params);
          const input = await worker.downloadInput(claim, claim.inputs[0], context.signal);
          context.signal.throwIfAborted();
          const digest = sha256(input);
          assert.equal(digest, claim.params.expected_sha256);
          assert.equal(input.length, claim.params.expected_size_bytes);
          return writeOutput(
            context.outDir,
            claim,
            `${JSON.stringify({
              bundle: bundleName,
              request_message_id: claim.params.request_message_id,
              input_sha256: digest,
              size_bytes: input.length,
              code_revision: claim.code,
              verified: true,
            })}\n`,
          );
        },
      },
    });
    const artifact = verifyAccepted(jobDb, accepted, admission.key, sha256(expectedOutput));
    assert.equal(artifact.worker, "bundle-worker");
    const output = readFileSync(join(accepted, artifact.file));
    assert.deepEqual(output, expectedOutput);
    const body = `${JSON.stringify({
      work_ref: workRef,
      request_message_id: selected.message_id,
      job_key: admission.key,
      receipt: JSON.parse(output),
      artifact_sha256: artifact.sha256,
      verification: artifact.verification,
      status: "verified",
    })}\n`;
    const reply = await helpdesk.postMessage(selected.thread_id, {
      command_id: replyCommand,
      session_id: workRef,
      recipients: submission.recipients,
      in_reply_to: selected.message_id,
      body,
    });
    return { admission, worker_result: workerResult, artifact, reply, body };
  };
  const snapshot = () => {
    const db = new DatabaseSync(jobDb, { readOnly: true });
    try {
      return {
        jobs: db.prepare("SELECT * FROM jobs").all(),
        events: db.prepare("SELECT * FROM job_events ORDER BY seq").all(),
      };
    } finally {
      db.close();
    }
  };
  const first = await execute(request);
  save("artifact.json", first.artifact);
  save("reply.json", { receipt: first.reply, body: first.body });
  assert.equal(first.admission.created, true);
  assert.equal(first.worker_result, "completed");
  assert.equal(first.reply.duplicate, false);
  const before = snapshot();
  save("job.json", before);
  assert.equal(before.jobs.length, 1);
  assert.equal(before.jobs[0].attempts, 1);
  assert.deepEqual(
    before.events.map((event) => event.type),
    ["enqueued", "claimed", "completed"],
  );

  const repeatedRequest = await helpdesk.createThread(submission);
  assert.equal(repeatedRequest.duplicate, true);
  assert.equal(repeatedRequest.message_id, request.message_id);
  assert.equal(repeatedRequest.thread_id, request.thread_id);
  const second = await execute(repeatedRequest);
  assert.equal(second.admission.created, false);
  assert.equal(second.admission.key, first.admission.key);
  assert.equal(second.worker_result, "idle");
  assert.equal(second.reply.duplicate, true);
  assert.equal(second.reply.message_id, first.reply.message_id);
  assert.equal(executions, 1);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(second.artifact, first.artifact);
  assert.equal(readdirSync(accepted).length, 1);
  const finalThread = await helpdesk.readThread(request.thread_id);
  assert.equal(finalThread.messages.length, 2);
  assert.equal(finalThread.messages[1].in_reply_to, request.message_id);
  assert.equal(await helpdesk.messageBody(first.reply.message_id), first.body);
  save("reply-readback.json", finalThread.messages[1]);
  save("duplicate.json", {
    status: "PASS",
    request: repeatedRequest,
    admission: second.admission,
    reply: second.reply,
    worker_result: second.worker_result,
    executions,
    attempts: before.jobs[0].attempts,
    accepted_artifacts: readdirSync(accepted).length,
    helpdesk_messages: finalThread.messages.length,
    canonical_job_and_events_unchanged: true,
  });
  const result = {
    status: "PASS",
    evidence,
    code_revision: code,
    thread_id: request.thread_id,
    request_message_id: request.message_id,
    job_key: first.admission.key,
    bundle_sha256: expectedDigest,
    artifact_sha256: first.artifact.sha256,
    reply_message_id: first.reply.message_id,
    duplicate: "PASS",
    executions,
  };
  save("result.json", result);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  save("failure.json", { status: "FAIL", name: error.name, message: error.message });
  throw error;
} finally {
  if (server?.listening) await new Promise((ok) => server.close(ok));
  store?.close();
  rmSync(keys, { recursive: true, force: true });
  save("cleanup.json", {
    listener_stopped: !server?.listening,
    temporary_keys_removed: !existsSync(keys),
  });
}
