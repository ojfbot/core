import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { generateToken } from "../../packages/fleet-runner/dist/auth.js";
import { fleetClient } from "../../packages/fleet-runner/dist/client.js";
import { JobStore, jobKey, writeOutput } from "../../packages/fleet-runner/dist/jobs.js";
import { fleetServer } from "../../packages/fleet-runner/dist/server.js";
import { workOnce } from "../../packages/fleet-runner/dist/worker.js";
import { roundtrip, sha256 } from "./helpdesk-roundtrip.mjs";

assert.equal(process.versions.node, "24.22.2", "Use the repository-pinned Node runtime");
assert.equal(
  process.argv.length,
  4,
  "usage: prove-helpdesk-roundtrip.mjs <LocalHelp-root> <new-evidence-dir>",
);
const helpdeskRoot = resolve(process.argv[2]);
const evidence = resolve(process.argv[3]);
const fromHelpdesk = (path) => import(pathToFileURL(join(helpdeskRoot, path)).href);
const [{ createHelpDesk }, { loadConfig }, { openStore }, { HelpDeskClient }] = await Promise.all([
  fromHelpdesk("packages/helpdesk/dist/server.js"),
  fromHelpdesk("packages/helpdesk/dist/config.js"),
  fromHelpdesk("packages/helpdesk/dist/store.js"),
  fromHelpdesk("packages/helpdesk-device/dist/client.js"),
]);

mkdirSync(evidence, { mode: 0o700 });
process.umask(0o077);
const save = (name, value) =>
  writeFileSync(join(evidence, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
const secrets = join(evidence, "temporary-keys");
const helpdeskKeys = join(secrets, "helpdesk");
const fleetKeys = join(secrets, "fleet-runner");
const accepted = join(evidence, "accepted");
const inputDir = join(evidence, "inputs");
const jobDb = join(evidence, "jobs.sqlite");
mkdirSync(secrets);
mkdirSync(helpdeskKeys);
mkdirSync(fleetKeys);
mkdirSync(accepted);
const listen = async (server, port = 0) => {
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", ok);
  });
  return `http://127.0.0.1:${server.address().port}`;
};
const close = (server) => new Promise((ok) => server.close(ok));
let service;
let store;
let runnerServer;
let jobs;
try {
  // HelpDesk validates its configured same-origin port, so reserve a local port first.
  const reservation = createServer();
  await listen(reservation);
  const port = reservation.address().port;
  await close(reservation);
  const privateKeys = {};
  for (const writer of ["requester", "operator"]) {
    const { privateKey } = generateKeyPairSync("ed25519");
    privateKeys[writer] = privateKey;
    writeFileSync(
      join(helpdeskKeys, `${writer}.pub`),
      createPublicKey(privateKey).export({ type: "spki", format: "pem" }),
    );
  }
  const config = loadConfig({
    LOCALHELP_BIND_IP: "127.0.0.1",
    LOCALHELP_PORT: String(port),
    LOCALHELP_DATA_DIR: join(evidence, "helpdesk-state"),
    LOCALHELP_KEYS_DIR: helpdeskKeys,
    LOCALHELP_YURI_IP: "127.0.0.1",
  });
  store = await openStore(config.dataDir);
  service = createHelpDesk({ config, repo: store.repo, streamId: store.streamId });
  const helpdeskUrl = await listen(service.server, port);
  const requester = new HelpDeskClient({
    baseUrl: helpdeskUrl,
    writer: "requester",
    privateKey: privateKeys.requester,
  });
  const operator = new HelpDeskClient({
    baseUrl: helpdeskUrl,
    writer: "operator",
    privateKey: privateKeys.operator,
  });

  for (const name of ["owner", "qualification-worker"]) generateToken(join(fleetKeys, name));
  jobs = new JobStore(jobDb);
  runnerServer = fleetServer(jobs, { registry: fleetKeys, outDir: accepted, inputDir });
  const runnerUrl = await listen(runnerServer);
  const owner = fleetClient(runnerUrl, "owner", join(fleetKeys, "owner"));
  const worker = fleetClient(
    runnerUrl,
    "qualification-worker",
    join(fleetKeys, "qualification-worker"),
  );
  const bytes = Buffer.from("fleet NAS qualification v1\n");
  const digest = sha256(bytes);
  const job = {
    kind: "proof-fixture",
    inputs: [digest],
    params: { trial: 0 },
    code: "321a44637b8fc406b8823a192c1194511007e6c0",
    payload: null,
    requires: ["nas-qualification"],
    priority: 0,
    maxAttempts: 1,
  };
  const manifest = {
    work_ref: "circusgreen-roundtrip-20261113",
    requester: "requester",
    operator: "operator",
    worker: "qualification-worker",
    request_command_id: randomUUID(),
    reply_command_id: randomUUID(),
    request_body: `${JSON.stringify({ action: "proof-fixture", input_sha256: digest, work_ref: "circusgreen-roundtrip-20261113" })}\n`,
    job,
    expected_job_key: jobKey(job),
    expected_sha256: digest,
    source_pins: {
      core: "321a44637b8fc406b8823a192c1194511007e6c0",
      LocalHelp: "1629a1e8db2e526590a33b857848e2f70edf240d",
    },
    scope:
      "Operator-run loopback integration with synthetic keys. No live services or delegated authority.",
  };
  save("manifest.json", manifest); // Identities and expected facts exist before sending.
  assert.equal(await owner.uploadInput(bytes), digest);
  const submission = {
    command_id: manifest.request_command_id,
    subject: "Isolated FleetRunner proof",
    recipients: [{ device_id: manifest.operator }],
    body: manifest.request_body,
  };
  const request = await requester.createThread(submission);
  assert.equal(request.duplicate, false);
  save("request.json", {
    submission,
    receipt: request,
    readback: await operator.readThread(request.thread_id),
  });

  let executions = 0;
  const runWorker = () =>
    workOnce(worker, {
      caps: ["nas-qualification"],
      outDir: join(evidence, "worker-attempts"),
      handlers: {
        "proof-fixture": async (claim, context) => {
          executions += 1;
          const input = await worker.downloadInput(claim, claim.inputs[0], context.signal);
          return writeOutput(context.outDir, claim, input);
        },
      },
    });
  const options = {
    helpdesk: operator,
    fleet: owner,
    request,
    manifest,
    runWorker,
    jobDb,
    outDir: accepted,
  };
  const first = await roundtrip(options);
  assert.equal(first.admission.created, true);
  assert.equal(first.worker, "completed");
  const replyBody = await requester.messageBody(first.reply.message_id);
  assert.equal(replyBody, first.reply_body);
  const firstThread = await requester.readThread(request.thread_id);
  assert.equal(firstThread.messages.length, 2);
  assert.equal(firstThread.messages[1].in_reply_to, request.message_id);
  save("artifact.json", first.artifact);
  save("reply.json", { receipt: first.reply, body: replyBody, readback: firstThread.messages[1] });

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
  const before = snapshot();
  save("job.json", before);
  const repeated = await requester.createThread(submission);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.message_id, request.message_id);
  const second = await roundtrip({ ...options, request: repeated });
  assert.equal(second.admission.created, false);
  assert.equal(second.admission.key, first.admission.key);
  assert.equal(second.worker, "idle");
  assert.equal(second.reply.duplicate, true);
  assert.equal(second.reply.message_id, first.reply.message_id);
  assert.equal(executions, 1);
  assert.deepEqual(snapshot(), before);
  assert.equal(before.jobs.length, 1);
  assert.equal(before.jobs[0].attempts, 1);
  assert.deepEqual(
    before.events.map((event) => event.type),
    ["enqueued", "claimed", "completed"],
  );
  assert.equal(readdirSync(accepted).length, 1);
  assert.deepEqual(readFileSync(join(accepted, first.artifact.file)), bytes);
  const finalThread = await requester.readThread(request.thread_id);
  assert.equal(finalThread.messages.length, 2);
  save("duplicate.json", {
    status: "PASS",
    repeated_request: repeated,
    repeated_admission: second.admission,
    worker_result: second.worker,
    repeated_reply: second.reply,
    handler_executions: executions,
    jobs: before.jobs.length,
    attempts: before.jobs[0].attempts,
    artifacts: readdirSync(accepted).length,
    messages: finalThread.messages.length,
    job_records_and_events_unchanged: true,
    artifact_digest_unchanged: second.artifact.sha256 === first.artifact.sha256,
  });
  save("result.json", {
    status: "PASS",
    cases: [
      "signed request -> job -> original-byte verification -> signed reply",
      "identical request produces no second execution or reply",
    ],
    node: process.versions.node,
    request_message_id: request.message_id,
    job_key: first.admission.key,
    artifact_sha256: first.artifact.sha256,
    reply_message_id: first.reply.message_id,
  });
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", evidence, request: request.message_id, job: first.admission.key, sha256: first.artifact.sha256, reply: first.reply.message_id, duplicate: "PASS", executions })}\n`,
  );
} finally {
  if (runnerServer?.listening) await close(runnerServer);
  jobs?.close();
  if (service) await service.close();
  store?.close();
  rmSync(secrets, { recursive: true, force: true });
}
