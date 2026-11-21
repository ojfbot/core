#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { proofRelaySession } from "./ledger-proof-local-operator.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_, row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? Object.fromEntries(
          Object.keys(row)
            .sort()
            .map((key) => [key, row[key]]),
        )
      : row,
  );
const fail = (reason) => {
  throw Error(`proof-bind-${reason}`);
};
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...keys].sort().join();
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const absolute = (value) =>
  typeof value === "string" &&
  isAbsolute(value) &&
  resolve(value) === value &&
  !value.includes("\0");
const proofIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const roles = new Set(["primary", "fallback", "supervisor", "watchdog"]);

export function parseLocalBinding(value) {
  if (!exact(value, ["schemaVersion", "proofId", "client", "operator", "relay", "roles"]))
    fail("manifest-invalid");
  if (value.schemaVersion !== 1 || !proofIdPattern.test(value.proofId)) fail("manifest-invalid");
  if (
    !exact(value.client, ["node", "nodeSha256", "bundle", "sha256"]) ||
    !absolute(value.client.node) ||
    !hex(value.client.nodeSha256) ||
    !absolute(value.client.bundle) ||
    !hex(value.client.sha256)
  )
    fail("client-invalid");
  for (const name of ["operator", "relay"])
    if (
      !exact(value[name], ["settings", "sha256"]) ||
      !absolute(value[name].settings) ||
      !hex(value[name].sha256)
    )
      fail(`${name}-invalid`);
  if (!Array.isArray(value.roles) || value.roles.length < 1 || value.roles.length > 4)
    fail("roles-invalid");
  const named = new Set();
  for (const row of value.roles) {
    if (
      !exact(row, ["role", "settings", "sha256", "initialize"]) ||
      !roles.has(row.role) ||
      named.has(row.role) ||
      !absolute(row.settings) ||
      !hex(row.sha256) ||
      typeof row.initialize !== "boolean"
    )
      fail("roles-invalid");
    named.add(row.role);
  }
  return structuredClone(value);
}

function privateBytes(file, io, confidential = false, maxBytes = 16 * 1024 * 1024) {
  const info = io.stat(file);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.uid !== io.uid() ||
    info.mode & (confidential ? 0o077 : 0o022)
  )
    fail("file-unsafe");
  if (typeof info.size === "number" && info.size > maxBytes) fail("file-too-large");
  const bytes = io.read(file);
  if (bytes.length > maxBytes) fail("file-too-large");
  return bytes;
}
function privateJson(file, io) {
  const bytes = privateBytes(file, io, true);
  if (bytes.length > 64 * 1024) fail("file-too-large");
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

const realIo = {
  stat: lstatSync,
  read: readFileSync,
  uid: () => process.getuid(),
  run: (program, args) => {
    const result = spawnSync(program, args, {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      env: {
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
      },
    });
    return { status: result.status, signal: result.signal, stdout: result.stdout ?? "" };
  },
};

/** Validate every immutable input before creating any journal. */
export function inspectLocalBinding(input, overrides = {}) {
  const manifest = parseLocalBinding(input);
  const io = { ...realIo, ...overrides };
  if (
    digest(privateBytes(manifest.client.node, io, false, 256 * 1024 * 1024)) !==
    manifest.client.nodeSha256
  )
    fail("node-drift");
  if (digest(privateBytes(manifest.client.bundle, io)) !== manifest.client.sha256)
    fail("client-drift");
  const operator = privateJson(manifest.operator.settings, io);
  const relay = privateJson(manifest.relay.settings, io);
  if (
    digest(Buffer.from(canonical(operator.value))) !== manifest.operator.sha256 ||
    digest(Buffer.from(canonical(relay.value))) !== manifest.relay.sha256
  )
    fail("settings-drift");
  if (
    operator.value.proofId !== manifest.proofId ||
    operator.value.snapshot?.clientBundle !== manifest.client.bundle ||
    operator.value.snapshot?.clientBundleSHA256 !== manifest.client.sha256 ||
    !hex(operator.value.snapshot?.serverBundleSHA256)
  )
    fail("operator-binding-mismatch");
  if (
    relay.value.proof?.proofId !== manifest.proofId ||
    relay.value.relay?.session !== proofRelaySession(manifest.proofId)
  )
    fail("relay-binding-mismatch");
  const practice = relay.value.proof.practice === true;
  const practicePlanSha256 = practice
    ? digest(Buffer.from(canonical(relay.value.proof)))
    : undefined;
  if (operator.value.practicePlanSha256 !== practicePlanSha256) fail("practice-operator-mismatch");
  const journals = new Map();
  for (const entry of manifest.roles) {
    const { value } = privateJson(entry.settings, io);
    if (
      digest(Buffer.from(canonical(value))) !== entry.sha256 ||
      value.role !== entry.role ||
      value.proof?.proofId !== manifest.proofId
    )
      fail("role-binding-mismatch");
    if (
      (value.proof.practice === true) !== practice ||
      (practice &&
        (!["primary", "fallback"].includes(entry.role) ||
          digest(Buffer.from(canonical(value.proof))) !== practicePlanSha256))
    )
      fail("practice-role-binding-mismatch");
    if (!absolute(value.stateFile)) fail("journal-path-invalid");
    const journal = journals.get(value.stateFile) ?? { initializers: 0 };
    journal.initializers += Number(entry.initialize);
    journals.set(value.stateFile, journal);
  }
  if ([...journals.values()].some(({ initializers }) => initializers !== 1))
    fail("journal-initializer-mismatch");
  return { manifest, io, journalCount: journals.size, practicePlanSha256 };
}

function invokeJournal(manifest, io, entry, action) {
  const result = io.run(manifest.client.node, [
    manifest.client.bundle,
    "ledger-proof",
    action,
    "--settings",
    entry.settings,
    "--sha256",
    entry.sha256,
  ]);
  if (result.status !== 0 || result.signal) fail(`journal-${action}-${entry.role}`);
  let body;
  try {
    body = JSON.parse(result.stdout);
  } catch {
    fail(`journal-${action}-${entry.role}`);
  }
  return body;
}

/** Read-only gate; rerun immediately before local role bootstrap. */
export function checkLocalIdleBinding(input, overrides = {}) {
  const { manifest, io, journalCount } = inspectLocalBinding(input, overrides);
  for (const entry of manifest.roles) {
    const status = invokeJournal(manifest, io, entry, "status");
    if (
      status.proofId !== manifest.proofId ||
      status.role !== entry.role ||
      status.terminal !== null ||
      status.jobAdmitted !== false ||
      status.verifiedOutput !== null ||
      status.reportDelivered !== false
    )
      fail(`journal-not-idle-${entry.role}`);
  }
  return {
    idle: true,
    proofId: manifest.proofId,
    journals: journalCount,
    roles: manifest.roles.map((row) => row.role),
  };
}

/** Exactly one init per journal, then a read-only idle status for every role. */
export function prepareLocalBinding(input, overrides = {}) {
  const { manifest, io, journalCount } = inspectLocalBinding(input, overrides);
  for (const entry of manifest.roles.filter((row) => row.initialize)) {
    if (invokeJournal(manifest, io, entry, "init").initialized !== true)
      fail(`journal-init-${entry.role}`);
  }
  checkLocalIdleBinding(manifest, io);
  return {
    prepared: true,
    proofId: manifest.proofId,
    journals: journalCount,
    roles: manifest.roles.map((row) => row.role),
  };
}

if (
  typeof __FLEET_PRACTICE_BUNDLE__ === "undefined" &&
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    if (
      process.argv.length !== 5 ||
      process.argv[2] !== "--settings" ||
      !absolute(process.argv[3]) ||
      !hex(process.argv[4])
    )
      fail("arguments");
    const { bytes, value } = privateJson(process.argv[3], realIo);
    if (digest(Buffer.from(canonical(value))) !== process.argv[4]) fail("manifest-drift");
    const result = prepareLocalBinding(value);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${/^proof-bind-[a-z-]+$/.test(error?.message ?? "") ? error.message : "proof-bind-failed"}\n`,
    );
    process.exitCode = 1;
  }
}
