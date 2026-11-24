// Smoke tests for the FleetRunner test copy (ojfbot/core#647, slice 3). Run from the Mac by
// fleet-stage.sh against the test copy only, with the test copy's own keys.
//
//   node stage-smoke.mjs status <revision>   one signed status call: ready, and which build
//   node stage-smoke.mjs build                one signed status call: prints ready and the build as
//                                             it is (exit 0 only if ready); fleet-promote.sh compares
//   node stage-smoke.mjs smoke  <revision>   the three acceptance checks, in order:
//     1. the signed status answers, ready, and its build is exactly <revision>;
//     2. a signed job submit (as the test owner) is accepted;
//     3. a worker (as the test worker) can claim that job, and finish it so the queue is left clean.
//
// Environment: STAGE_URL (https://<host>:<port>), STAGE_KEYS_DIR (owner.token, stage-worker.token),
// NODE_EXTRA_CA_CERTS (the private CA, set before node starts). The tokens are the test copy's own:
// this script never reads production's keys and has no way to name production's address.
// The one exception is fleet-promote.sh, which uses only status and build against production, as
// the read-only identity STAGE_STATUS_ID (its <id>.token in STAGE_KEYS_DIR), never the owner key.
// STAGE_STATUS_ID applies to status and build only; smoke always signs as the test copy's owner.
// Prints PASS/FAIL lines and counts only. Needs the package built (dist/), which fleet-stage.sh does.
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

const [command, revision] = process.argv.slice(2);
const fail = (why) => {
  console.log(`FAIL ${why}`);
  process.exit(1);
};
if (
  !(command === "build" && revision === undefined) &&
  !(["status", "smoke"].includes(command ?? "") && /^[0-9a-f]{7,40}$/.test(revision ?? ""))
) {
  console.error("usage: stage-smoke.mjs status|smoke <revision> | build");
  process.exit(2);
}
const url = process.env.STAGE_URL;
const keys = process.env.STAGE_KEYS_DIR;
if (!url || !keys) fail("STAGE_URL and STAGE_KEYS_DIR must be set");
if (!/^https:\/\/[^/@]+$/.test(url)) fail("STAGE_URL must be an https origin");

const { fleetClient } = await import(new URL("../dist/client.js", import.meta.url).href);
// The status reader's key is the only one read for status and build: another identity's status
// call never opens owner.token.
const statusId = command === "smoke" ? "owner" : (process.env.STAGE_STATUS_ID || "owner");
if (!/^[a-z][a-z0-9-]{0,62}$/.test(statusId)) fail("STAGE_STATUS_ID is not an identity name");
const reader = fleetClient(url, statusId, join(keys, `${statusId}.token`));

let snapshot;
try {
  snapshot = await reader.status();
} catch (error) {
  fail(`status unreachable (${error?.cause?.code ?? error?.status ?? "error"})`);
}
const { ready, build, reasons } = snapshot.service;
if (command === "build") {
  console.log(JSON.stringify({ ready, build, reasons }));
  process.exit(ready ? 0 : 1);
}
// The service stores the full revision the stage script gave it; an abbreviation is accepted.
const buildMatches = typeof build === "string" && (build === revision || (revision.length < 40 && build.startsWith(revision)));
if (command === "status") {
  console.log(JSON.stringify({ ready, build, reasons }));
  process.exit(ready && buildMatches ? 0 : 1);
}
if (!ready) fail(`status is not ready (${(reasons ?? []).join(",") || "no reason given"})`);
if (!buildMatches) fail(`status shows build ${String(build).slice(0, 12)}, not ${revision.slice(0, 12)}`);
console.log(`PASS status ready, build ${revision.slice(0, 12)}`);
const owner = reader;

// A fixture no earlier run has used, so admission is a real, new job.
const fixture = Buffer.from(`fleet-runner stage smoke ${revision} ${randomBytes(8).toString("hex")}\n`);
const sha = createHash("sha256").update(fixture).digest("hex");
let admitted;
try {
  admitted = await owner.enqueue({
    kind: "proof-fixture",
    inputs: [sha],
    payload: null,
    requires: ["stage-smoke"],
  });
} catch (error) {
  fail(`signed submit refused (${error?.status ?? "error"})`);
}
if (!admitted?.created || !/^[a-f0-9]{64}$/.test(admitted.key)) fail("signed submit was not accepted as a new job");
console.log("PASS signed submit accepted");

const worker = fleetClient(url, "stage-worker", join(keys, "stage-worker.token"));
let claim = null;
// An earlier failed run may have left its smoke job waiting; clear those (non-retryably) first.
for (let i = 0; i < 20; i += 1) {
  claim = await worker.claim(["stage-smoke"], ["proof-fixture"]).catch((error) => fail(`claim refused (${error?.status ?? "error"})`));
  if (claim === null || claim.key === admitted.key) break;
  await worker.fail(claim, "stage-smoke-stale", false);
}
if (claim === null || claim.key !== admitted.key) fail("the worker could not claim the submitted job");
console.log("PASS worker claimed the job");

const accepted = await worker.complete(claim, fixture, sha).catch(() => false);
const verified = accepted && (await owner.verify(admitted.key).then((r) => r.verified, () => false));
if (!verified) fail("the claimed job could not be completed and verified");
console.log("PASS job completed and its output verified");
