#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const usage = "Usage: g6-trial-checkpoint.mjs begin <lid-1|...|wifi-3> <owner-alias> <ID.json> | arm <ID.json> <job-key> <fence> | resume <ID.json> | attempt <ID.json> <worker-alias> <job-key> <fence> | finish <ID.json> <pass|invalid> <private-receipt-ref>";
const trialPattern = /^(lid|wifi)-[1-3]$/;
const keyPattern = /^[a-f0-9]{64}$/;
const aliasPattern = /^[a-z][a-z0-9-]{0,31}$/;

function die(message) {
  console.error(`G6 checkpoint: ${message}`);
  process.exit(2);
}
function checkpointPath(value) {
  const path = resolve(value);
  const id = basename(path, ".json");
  if (basename(path) !== `${id}.json` || !trialPattern.test(id))
    die("checkpoint filename must be the stable trial ID plus .json");
  return path;
}
function load(path) {
  let value;
  try { value = JSON.parse(readFileSync(path, "utf8")); } catch { die("checkpoint is missing or invalid JSON"); }
  if (value.correlation !== "FR-20261110-interruption" || !trialPattern.test(value.trial_id))
    die("checkpoint correlation or trial ID is invalid");
  return value;
}
function write(path, value, exclusive = false) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    if (exclusive && existsSync(path)) die("checkpoint already exists; resume the existing trial");
    renameSync(temp, path);
  } finally {
    try { rmSync(temp); } catch {}
  }
}
function requireActive(path, state) {
  const lockPath = join(dirname(path), ".g6-active-trial.json");
  let lock;
  try { lock = JSON.parse(readFileSync(lockPath, "utf8")); } catch { die("active-trial lock is missing; do not recreate it without reconciling the queue"); }
  if (lock.trial_id !== state.trial_id || lock.checkpoint !== path || lock.owner_alias !== state.owner_alias)
    die("another trial owns this evidence directory");
  return lockPath;
}

const [command, ...args] = process.argv.slice(2);
if (!command) die(usage);
if (command === "begin") {
  if (args.length !== 3) die(usage);
  const [trialId, ownerAlias, rawPath] = args;
  if (!trialPattern.test(trialId) || !aliasPattern.test(ownerAlias)) die("invalid trial ID or private owner alias");
  const path = checkpointPath(rawPath);
  if (basename(path) !== `${trialId}.json`) die("checkpoint filename must match trial ID");
  if (existsSync(path)) die("checkpoint already exists; resume the existing trial");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const lockPath = join(dirname(path), ".g6-active-trial.json");
  const lock = { correlation: "FR-20261110-interruption", trial_id: trialId, owner_alias: ownerAlias, checkpoint: path };
  try { writeFileSync(lockPath, JSON.stringify(lock) + "\n", { flag: "wx", mode: 0o600 }); }
  catch { die("another trial is active; inspect its checkpoint and queue before resuming"); }
  write(path, {
    ...lock,
    status: "prepared",
    armed: false,
    started_at: new Date().toISOString(),
    attempts: [],
    receipt_refs: [],
  }, true);
  console.log(JSON.stringify({ trial_id: trialId, status: "prepared", checkpoint: path }));
} else if (command === "arm") {
  if (args.length !== 3) die(usage);
  const path = checkpointPath(args[0]);
  const state = load(path);
  requireActive(path, state);
  const [jobKey, fenceText] = args.slice(1);
  const fence = Number(fenceText);
  if (state.status !== "prepared" || !keyPattern.test(jobKey) || !Number.isSafeInteger(fence) || fence < 1)
    die("arm requires a prepared trial, job key and positive fence");
  state.status = "armed";
  state.armed = true;
  state.armed_at = new Date().toISOString();
  state.job_key = jobKey;
  state.attempts.push({ fence, worker_alias: state.owner_alias, observed_at: state.armed_at });
  write(path, state);
  console.log(JSON.stringify({ trial_id: state.trial_id, status: state.status, job_key: jobKey, fence }));
} else if (command === "attempt") {
  if (args.length !== 4) die(usage);
  const path = checkpointPath(args[0]);
  const state = load(path);
  requireActive(path, state);
  const [workerAlias, jobKey, fenceText] = args.slice(1);
  const fence = Number(fenceText);
  if (state.status !== "armed" || !aliasPattern.test(workerAlias) || jobKey !== state.job_key || !Number.isSafeInteger(fence) || fence < 1)
    die("attempt requires the armed job key and a valid worker/fence");
  if (fence <= state.attempts.at(-1).fence) die("fences must strictly increase; preserve the existing receipt");
  state.attempts.push({ fence, worker_alias: workerAlias, observed_at: new Date().toISOString() });
  write(path, state);
  console.log(JSON.stringify({ trial_id: state.trial_id, recorded_fence: fence }));
} else if (command === "resume") {
  if (args.length !== 1) die(usage);
  const path = checkpointPath(args[0]);
  const state = load(path);
  requireActive(path, state);
  if (state.status !== "prepared" && state.status !== "armed") die("trial is already finished");
  console.log(JSON.stringify(state, null, 2));
} else if (command === "finish") {
  if (args.length !== 3) die(usage);
  const path = checkpointPath(args[0]);
  const state = load(path);
  const lockPath = requireActive(path, state);
  const [verdict, receiptRef] = args.slice(1);
  if (state.status !== "armed" || !["pass", "invalid"].includes(verdict) || !receiptRef.trim())
    die("finish requires an armed trial, pass/invalid verdict and private receipt reference");
  state.status = verdict === "pass" ? "passed" : "invalid";
  state.finished_at = new Date().toISOString();
  state.receipt_refs.push(receiptRef);
  write(path, state);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  if (lock.trial_id !== state.trial_id) die("active-trial lock changed; checkpoint retained for reconciliation");
  rmSync(lockPath);
  console.log(JSON.stringify({ trial_id: state.trial_id, status: state.status, checkpoint: path }));
} else die(usage);
