#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../dist/jobs.js";
import { parseLedgerProof } from "../dist/ledger-proof.js";
import { parseProofRelay } from "../dist/ledger-proof-relay.js";
import { parseProofRuntime } from "../dist/ledger-proof-runtime.js";
import { verifyProofCommand, runProofCommand } from "../dist/ledger-proof-command.js";
import { projection, validateSettings, proofRelaySession } from "./ledger-proof-local-operator.mjs";
import { inspectLocalBinding, prepareLocalBinding } from "./ledger-proof-local-bind.mjs";
import { inspectLocalProof, checkLocalProofReady } from "./ledger-proof-local-guard.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const digest = (value) => hash(canonicalJson(value));
const sha = (path) => hash(readFileSync(path));
const json = (path) => {
  const st = lstatSync(path);
  if (!st.isFile() || st.isSymbolicLink() || st.uid !== process.getuid() || st.mode & 0o077)
    throw Error("practice-input-must-be-private-file");
  return JSON.parse(readFileSync(path, "utf8"));
};
const write = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const requireThat = (value, message) => {
  if (!value) throw Error(message);
};
const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const plistValue = (value) =>
  Array.isArray(value)
    ? `<array>${value.map(plistValue).join("")}</array>`
    : typeof value === "boolean"
      ? `<${value}/>`
      : `<string>${xml(value)}</string>`;
const encodePlist = (value) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>' +
  Object.entries(value)
    .map(([key, entry]) => `<key>${xml(key)}</key>${plistValue(entry)}`)
    .join("") +
  "</dict></plist>\n";

/** host contains stable local installation/identity facts; target contains inspect/baseline facts. */
export function preparePractice({ plan, role, host, target, root }) {
  requireThat(["primary", "fallback"].includes(role), "practice-role-invalid");
  const proof = parseLedgerProof(plan.proof);
  requireThat(
    proof.practice === true && digest(proof) === plan.planSha256,
    "practice-plan-mismatch",
  );
  requireThat(
    resolve(root) === root && !existsSync(root),
    "practice-root-must-be-new-absolute-path",
  );
  const scripts = resolve(host.scripts);
  const node = resolve(host.node),
    bundle = resolve(host.bundle);
  const client = { node, nodeSha256: sha(node), bundle, sha256: sha(bundle) };
  requireThat(
    client.nodeSha256 === host.nodeSha256 && client.sha256 === host.bundleSha256,
    "practice-release-drift",
  );
  const path = (leaf) => join(root, leaf);
  const op = join(scripts, "ledger-proof-local-operator.mjs");
  const label = `org.ojfbot.fleetrunner.${proof.proofId}.${role}`;
  const domain = `gui/${process.getuid()}`;
  const relay = {
    proof,
    relay: {
      adapter: host.adapter,
      environment: host.environment,
      thread: plan.thread,
      stream: plan.stream,
      device: host.device,
      primaryDevice: host.primaryDevice,
      fallbackDevice: host.fallbackDevice,
      session: proofRelaySession(proof.proofId),
      startAfter: plan.startAfter,
      directory: path("relay"),
    },
  };
  requireThat(
    host.device === (role === "primary" ? host.primaryDevice : host.fallbackDevice),
    "practice-device-role-mismatch",
  );
  parseProofRelay(relay.relay, proof);
  verifyProofCommand(host.adapter);
  const operator = {
    schemaVersion: 1,
    proofId: proof.proofId,
    endsAtMs: proof.endsAtMs,
    proofRoot: root,
    uid: process.getuid(),
    practicePlanSha256: plan.planSha256,
    nasAlias: target.nasAlias,
    docker: target.docker,
    target: projection(target.inspect),
    snapshot: {
      serviceUid: target.inspect.Config.User.split(":")[0],
      node: target.node,
      bundle: target.serverBundle,
      serverBundleSHA256: target.serverBundleSha256,
      clientBundle: bundle,
      clientBundleSHA256: client.sha256,
      schema: 5,
      database: "/var/lib/fleet-runner/state/fleet.sqlite",
      outputs: "/var/lib/fleet-runner/output",
    },
    protected: host.protected,
    local: {
      domain,
      stopLabels: [label, `org.ojfbot.fleetrunner.${proof.proofId}.unused`],
      watchdogLabel: `org.ojfbot.fleetrunner.${proof.proofId}.watchdog-disabled`,
      pauseFiles: [path(`${role}.pause`), path("unused.pause")],
      ownedProcessMarkers: [path(`${role}.json`), path(`${role}.plist`), path(`${role}.cpu`)],
      wakeOwner: `cg307-u1-${proof.proofId}`,
    },
  };
  validateSettings(operator);
  requireThat(
    operator.target.labels["cg307-u1.proof"] === proof.proofId,
    "practice-target-proof-mismatch",
  );
  requireThat(digest(operator.target) === target.projectionSha256, "practice-target-drift");
  const command = (program, args, files = {}) => ({ program, sha256: sha(program), args, files });
  const operatorCommand = (mode) =>
    command(node, [op, "--settings", path("operator.json"), "--mode", mode], {
      [op]: sha(op),
      [path("operator.json")]: hash(JSON.stringify(operator, null, 2) + "\n"),
    });
  const relayCommand = (action) =>
    command(
      node,
      [
        bundle,
        "ledger-proof-relay",
        action,
        "--settings",
        path("relay.json"),
        "--sha256",
        digest(relay),
      ],
      {
        [bundle]: client.sha256,
        [path("relay.json")]: hash(JSON.stringify(relay, null, 2) + "\n"),
      },
    );
  const disabled = command("/usr/bin/false", []);
  const runtime = {
    proof,
    role,
    stateFile: path(`${role}.sqlite`),
    evidenceDir: path("evidence"),
    cpuSlot: path(`${role}.cpu`),
    pauseFile: path(`${role}.pause`),
    reservationFile: path("reservation"),
    artifacts: { [node]: client.nodeSha256, [bundle]: client.sha256 },
    settings: {
      schemaVersion: 1,
      endpoint: target.endpoint,
      worker: proof[role],
      tokenFile: host.tokenFile,
      caFile: host.caFile,
      outDir: path("out"),
      statusFile: path(`${role}-status.json`),
      pollMs: 5000,
      kinds: {
        "bookcase-ledger-replay": {
          capabilities: [proof.capability],
          command: [node, bundle, "--grant", path("no-grant.exists")],
          timeoutMs: 5000,
        },
      },
    },
    commands: {
      probe: operatorCommand("protected-probe"),
      snapshot: operatorCommand("snapshot"),
      post: relayCommand("post"),
      stop: disabled,
      fault: disabled,
      faultEvidence: relayCommand("evidence"),
    },
  };
  parseProofRuntime(runtime);
  const binding = {
    schemaVersion: 1,
    proofId: proof.proofId,
    client,
    operator: { settings: path("operator.json"), sha256: digest(operator) },
    relay: { settings: path("relay.json"), sha256: digest(relay) },
    roles: [{ role, settings: path(`${role}.json`), sha256: digest(runtime), initialize: true }],
  };
  const plist = {
    Label: label,
    ProgramArguments: [
      node,
      bundle,
      "ledger-proof",
      "launch",
      "--settings",
      path(`${role}.json`),
      "--sha256",
      digest(runtime),
    ],
    RunAtLoad: true,
    KeepAlive: false,
    StandardOutPath: path(`${role}.stdout`),
    StandardErrorPath: path(`${role}.stderr`),
  };
  const plistBytes = encodePlist(plist);
  const guard = {
    schemaVersion: 1,
    proofId: proof.proofId,
    planSha256: plan.planSha256,
    sourceSequence: plan.startAfter,
    startsAtMs: proof.startsAtMs,
    endsAtMs: proof.endsAtMs,
    binding: { settings: path("binder.json"), sha256: digest(binding) },
    operator: {
      settings: path("operator.json"),
      sha256: digest(operator),
      program: op,
      programSha256: sha(op),
    },
    goFile: path("GO.json"),
    consumedFile: path("GO.used"),
    receiptFile: path("guard-receipt.json"),
    domain,
    roles: [{ role, label, plist: path(`${role}.plist`), sha256: hash(plistBytes) }],
  };
  mkdirSync(root, { mode: 0o700 });
  for (const leaf of ["relay", "evidence", "out"]) mkdirSync(path(leaf), { mode: 0o700 });
  write(path("operator.json"), operator);
  write(path("relay.json"), relay);
  write(path(`${role}.json`), runtime);
  write(path("binder.json"), binding);
  write(path("guard.json"), guard);
  writeFileSync(path(`${role}.plist`), plistBytes, { flag: "wx", mode: 0o600 });
  inspectLocalBinding(binding);
  prepareLocalBinding(binding);
  return {
    prepared: true,
    role,
    proofId: proof.proofId,
    guard: path("guard.json"),
    guardSha256: digest(guard),
  };
}

/** Read-only: no GO, launchd bootstrap, journal writes, or cleanup side effects. */
export async function preflightPractice(guard, role, dependencies = {}) {
  const prepared = inspectLocalProof(guard, dependencies.io);
  requireThat(
    prepared.operator.practicePlanSha256 === guard.planSha256 &&
      guard.roles.length === 1 &&
      guard.roles[0].role === role,
    "practice-role-plan-mismatch",
  );
  const runtime = dependencies.readRuntime?.() ?? json(prepared.binding.roles[0].settings);
  parseProofRuntime(runtime);
  validateSettings(prepared.operator);
  // Execute the exact stdin contract used by the launch guard, before any approval/window.
  const result = checkLocalProofReady(prepared);
  const relay = dependencies.readRelay?.() ?? json(prepared.binding.relay.settings);
  const parsed = parseProofRelay(relay.relay, parseLedgerProof(relay.proof));
  const run = dependencies.runCommand ?? runProofCommand;
  const response = await run(
    {
      ...parsed.adapter,
      args: [
        ...parsed.adapter.args,
        "request",
        "GET",
        `/helpdesk/api/threads/${parsed.thread}?after=${parsed.startAfter}&limit=1`,
      ],
    },
    {},
    undefined,
    20000,
    parsed.environment,
  );
  requireThat(
    response?.thread?.thread_id === parsed.thread && response?.stream_id === parsed.stream,
    "practice-relay-thread-stream-mismatch",
  );
  // The signed worker-control GET exercises this role's TLS, key and server registration without claiming work.
  await (
    dependencies.checkWorker ??
    (async () => {
      const { signer } = await import("../dist/auth.js");
      const { request } = await import("node:https");
      const target = "/worker-control";
      const authorize = signer(runtime.settings.worker, runtime.settings.tokenFile);
      await new Promise((accept, reject) => {
        const req = request(
          new URL(target, runtime.settings.endpoint),
          {
            ca: readFileSync(runtime.settings.caFile),
            method: "GET",
            headers: { authorization: authorize("GET", target, Buffer.alloc(0)) },
            timeout: 10000,
          },
          (res) => {
            res.resume();
            res.on("end", () =>
              res.statusCode === 200
                ? accept()
                : reject(Error(`practice-worker-key-http-${res.statusCode}`)),
            );
          },
        );
        req.on("timeout", () => req.destroy(Error("practice-worker-key-timeout")));
        req.on("error", reject);
        req.end();
      });
    })
  )();
  return { state: "PASS", role, proofId: result.proofId, ready: true };
}

export async function practiceMain(args) {
  const [action, ...values] = args;
  const options = {};
  requireThat(values.length % 2 === 0, "practice-arguments: use flag/value pairs");
  for (let i = 0; i < values.length; i += 2) {
    requireThat(
      ["--plan", "--role", "--host", "--target", "--root"].includes(values[i]) &&
        options[values[i]] === undefined,
      "practice-arguments-invalid",
    );
    options[values[i]] = values[i + 1];
  }
  requireThat(["primary", "fallback"].includes(options["--role"]), "practice-role-required");
  if (action === "prepare")
    return preparePractice({
      plan: json(options["--plan"]),
      role: options["--role"],
      host: json(options["--host"]),
      target: json(options["--target"]),
      root: options["--root"],
    });
  if (action === "preflight")
    return preflightPractice(
      json(join(resolve(options["--root"]), "guard.json")),
      options["--role"],
    );
  throw Error(
    "usage: fleet-runner practice prepare|preflight --role primary|fallback --root PATH [--plan PATH --host PATH --target PATH]",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  practiceMain(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(
        JSON.stringify({
          state: "FAIL",
          check: error.check ?? null,
          reason: error.message,
          firstFailure: error.privateFailure ?? error.commandFailure ?? null,
        }),
      );
      process.exitCode = 1;
    });
}
