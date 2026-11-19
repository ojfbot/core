#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLocalIdleBinding, inspectLocalBinding } from "./ledger-proof-local-bind.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
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
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...keys].sort().join();
const absolute = (value) =>
  typeof value === "string" &&
  isAbsolute(value) &&
  resolve(value) === value &&
  !value.includes("\0");
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fail = (reason) => {
  throw Error(`proof-guard-${reason}`);
};
const cleanupFields = [
  "containerStopped",
  "localProfileStopped",
  "capabilitiesRemoved",
  "baselineUnchanged",
  "scheduleRemoved",
];

function readPrivate(file, io) {
  const info = io.stat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== io.uid() || info.mode & 0o077)
    fail("file-unsafe");
  const bytes = io.read(file);
  if (bytes.length > 64 * 1024) fail("file-bound");
  return JSON.parse(bytes.toString("utf8"));
}

export function parseLocalGuard(value) {
  if (
    !exact(value, [
      "schemaVersion",
      "proofId",
      "planSha256",
      "sourceSequence",
      "startsAtMs",
      "endsAtMs",
      "binding",
      "operator",
      "goFile",
      "consumedFile",
      "receiptFile",
      "domain",
      "roles",
    ])
  )
    fail("manifest-invalid");
  if (
    value.schemaVersion !== 1 ||
    typeof value.proofId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.proofId) ||
    !hex(value.planSha256) ||
    !Number.isSafeInteger(value.sourceSequence) ||
    value.sourceSequence < 0 ||
    !Number.isSafeInteger(value.startsAtMs) ||
    !Number.isSafeInteger(value.endsAtMs) ||
    value.endsAtMs <= value.startsAtMs
  )
    fail("manifest-invalid");
  if (
    !exact(value.binding, ["settings", "sha256"]) ||
    !absolute(value.binding.settings) ||
    !hex(value.binding.sha256)
  )
    fail("manifest-invalid");
  if (
    !exact(value.operator, ["settings", "sha256", "program", "programSha256"]) ||
    !absolute(value.operator.settings) ||
    !hex(value.operator.sha256) ||
    !absolute(value.operator.program) ||
    !hex(value.operator.programSha256)
  )
    fail("manifest-invalid");
  if (
    !["goFile", "consumedFile", "receiptFile"].every((name) => absolute(value[name])) ||
    !/^gui\/[1-9][0-9]*$/.test(value.domain) ||
    !Array.isArray(value.roles) ||
    value.roles.length < 1 ||
    value.roles.length > 4
  )
    fail("manifest-invalid");
  const seen = new Set();
  for (const role of value.roles) {
    if (
      !exact(role, ["role", "label", "plist", "sha256"]) ||
      !["primary", "fallback", "supervisor", "watchdog"].includes(role.role) ||
      seen.has(role.role) ||
      !role.label.includes(value.proofId) ||
      !/^[A-Za-z0-9._-]+$/.test(role.label) ||
      !absolute(role.plist) ||
      !hex(role.sha256)
    )
      fail("roles-invalid");
    seen.add(role.role);
  }
  return structuredClone(value);
}

const realIo = {
  stat: lstatSync,
  read: readFileSync,
  uid: () => process.getuid(),
  now: Date.now,
  write: writeFileSync,
  run: (program, args, input, timeout = 10_000) => {
    const result = spawnSync(program, args, {
      input,
      encoding: "utf8",
      timeout,
      maxBuffer: 64 * 1024,
      env: {
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
      },
    });
    return {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  },
};

function invoke(io, program, args, input, timeout) {
  const result = io.run(program, args, input, timeout);
  if (result.status !== 0 || result.signal) {
    const error = Error("proof-guard-command-failed");
    error.privateFailure = {
      exitCode: result.status ?? null,
      signal: result.signal ?? null,
      stderr: String(result.stderr ?? "").slice(-4096),
    };
    throw error;
  }
  return result.stdout;
}

/** A previously verified GO is consumed once, before any startup effect. */
export function verifyLocalGo(settings, io) {
  const go = readPrivate(settings.goFile, io);
  if (
    !exact(go, ["verified", "sourceSequence", "planSha256"]) ||
    go.verified !== true ||
    go.planSha256 !== settings.planSha256 ||
    !Number.isSafeInteger(go.sourceSequence) ||
    go.sourceSequence <= settings.sourceSequence
  )
    fail("go-mismatch");
  return go;
}

/** Preflight is inside the guarded block, so its failure still invokes exact cleanup. */
export function launchLocalProof(input, overrides = {}) {
  const settings = parseLocalGuard(input);
  const io = { ...realIo, ...overrides };
  const go = verifyLocalGo(settings, io);
  const binding = readPrivate(settings.binding.settings, io);
  if (hash(canonical(binding)) !== settings.binding.sha256 || binding.proofId !== settings.proofId)
    fail("binding-drift");
  const operator = readPrivate(settings.operator.settings, io);
  if (
    hash(canonical(operator)) !== settings.operator.sha256 ||
    operator.proofId !== settings.proofId
  )
    fail("operator-drift");
  const operatorProgram = io.stat(settings.operator.program);
  if (
    !operatorProgram.isFile() ||
    operatorProgram.isSymbolicLink() ||
    operatorProgram.uid !== io.uid() ||
    operatorProgram.mode & 0o022 ||
    hash(io.read(settings.operator.program)) !== settings.operator.programSha256
  )
    fail("operator-program-drift");
  for (const role of settings.roles) {
    const info = io.stat(role.plist);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== io.uid() ||
      info.mode & 0o022 ||
      hash(io.read(role.plist)) !== role.sha256
    )
      fail("plist-drift");
  }
  const inspected = inspectLocalBinding(binding, io);
  if (inspected.manifest.proofId !== settings.proofId) fail("binding-drift");
  const now = io.now();
  if (now < settings.startsAtMs - 600_000 || now >= settings.endsAtMs - 720_000)
    fail("outside-window");
  io.write(
    settings.consumedFile,
    `${JSON.stringify({ planSha256: settings.planSha256, sourceSequence: go.sourceSequence })}\n`,
    { flag: "wx", mode: 0o600 },
  );
  const op = (mode, body) =>
    JSON.parse(
      invoke(
        io,
        binding.client.node,
        [settings.operator.program, "--settings", settings.operator.settings, "--mode", mode],
        JSON.stringify(body),
        20_000,
      ),
    );
  const receipt = {
    proofId: settings.proofId,
    goSequence: go.sourceSequence,
    planSha256: settings.planSha256,
    rolesStarted: [],
    firstFailure: null,
    cleanup: null,
    rolesAbsent: null,
    state: "HELD",
  };
  try {
    checkLocalIdleBinding(binding, io);
    const snapshot = op("snapshot", { proofId: settings.proofId });
    if (
      snapshot.schema !== operator.snapshot.schema ||
      snapshot.rows?.length !== 0 ||
      snapshot.events?.length !== 0 ||
      snapshot.accepted !== null
    )
      fail("queue-not-empty");
    const probe = op("protected-probe", { proofId: settings.proofId });
    if (
      probe.proofId !== settings.proofId ||
      probe.protectedIdle !== true ||
      probe.baselineUnchanged !== true
    )
      fail("protected-not-ready");
    for (const role of settings.roles) {
      if (io.now() >= settings.endsAtMs - 720_000) fail("startup-deadline");
      const label = `${settings.domain}/${role.label}`;
      const absent = io.run("/bin/launchctl", ["print", label]);
      if (absent.status !== 113 || !/Could not find service/.test(absent.stderr))
        fail("role-not-absent");
      invoke(io, "/bin/launchctl", ["bootstrap", settings.domain, role.plist]);
      invoke(io, "/bin/launchctl", ["print", label]);
      receipt.rolesStarted.push(role.role);
    }
    receipt.state = "STARTED";
  } catch (error) {
    receipt.firstFailure = {
      reason: /^proof-(?:guard|bind)-[a-z-]+$/.test(error?.message ?? "")
        ? error.message
        : "proof-guard-startup-failed",
      ...(error?.privateFailure ? { private: error.privateFailure } : {}),
    };
    try {
      receipt.cleanup = op("stop", { proofId: settings.proofId, endsAtMs: settings.endsAtMs });
    } catch (cleanupError) {
      receipt.cleanupError = cleanupError?.message ?? "proof-guard-cleanup-failed";
    }
    try {
      for (const role of settings.roles) {
        const label = `${settings.domain}/${role.label}`;
        const state = io.run("/bin/launchctl", ["print", label]);
        if (state.status === 0) invoke(io, "/bin/launchctl", ["bootout", label]);
      }
      receipt.rolesAbsent = settings.roles.every((role) => {
        const state = io.run("/bin/launchctl", ["print", `${settings.domain}/${role.label}`]);
        return state.status === 113 && /Could not find service/.test(state.stderr);
      });
    } catch (cleanupError) {
      receipt.rolesAbsent = false;
      receipt.roleCleanupError = cleanupError?.message ?? "proof-guard-role-cleanup-failed";
    }
    receipt.state =
      receipt.rolesAbsent === true &&
      cleanupFields.every((field) => receipt.cleanup?.[field] === true)
        ? "HELD_CLEANED"
        : "HELD_CLEANUP_UNVERIFIED";
  }
  io.write(settings.receiptFile, `${JSON.stringify(receipt)}\n`, { flag: "wx", mode: 0o600 });
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (
      process.argv.length !== 5 ||
      process.argv[2] !== "--settings" ||
      !absolute(process.argv[3]) ||
      !hex(process.argv[4])
    )
      fail("arguments");
    const settings = readPrivate(process.argv[3], realIo);
    if (hash(canonical(settings)) !== process.argv[4]) fail("manifest-drift");
    const receipt = launchLocalProof(settings);
    process.stdout.write(
      `${JSON.stringify({
        state: receipt.state,
        rolesStarted: receipt.rolesStarted,
        firstFailure: receipt.firstFailure?.reason ?? null,
      })}\n`,
    );
    if (receipt.state !== "STARTED") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${
        /^proof-guard-[a-z-]+$/.test(error?.message ?? "") ? error.message : "proof-guard-failed"
      }\n`,
    );
    process.exitCode = 1;
  }
}
