import assert from "node:assert/strict";
import childProcess from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { isAbsolute, join } from "node:path";

// No provider process, including a version/help/auth probe, may run in this proof.
const originalSpawn = childProcess.spawn;
const originalSpawnSync = childProcess.spawnSync;
let providerSpawnAttempts = 0,
  filesystemAclReads = 0,
  scratch,
  report,
  stage = "setup",
  failed = false;
const forbid = () => {
  providerSpawnAttempts++;
  throw Error("provider-spawn-forbidden");
};
childProcess.spawn = forbid;
childProcess.spawnSync = (file, args, options) => {
  if (
    file === "/bin/ls" &&
    Array.isArray(args) &&
    args.length === 2 &&
    args[0] === "-lde" &&
    isAbsolute(args[1])
  ) {
    filesystemAclReads++;
    return originalSpawnSync(file, args, options);
  }
  return forbid();
};
syncBuiltinESMExports();
try {
  assert.equal(process.platform, "darwin");
  assert.equal(
    process.argv.length,
    3,
    "usage: pnpm exec node <package>/scripts/prove-codex-revocation.mjs <plan.json>",
  );
  const { prepareSupervisedSubscriptionCanary, openSupervisedSubscriptionCanary } =
    await import("../dist/index.js");
  const { checkNativeProfile } = await import("../dist/supervised-files.js");
  const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const original = prepareSupervisedSubscriptionCanary(input.plan ?? input);
  if (input.planDigest !== undefined) assert.equal(original.planDigest, input.planDigest);
  const codex = original.plan.profiles.find((p) => p.provider === "codex");
  assert.ok(codex);
  const revoked = [
    {
      nativeVersion: "0.165.0-alpha.1.2",
      binarySHA256: "d84a54b031085f01e3ad915ea7c72ebea4dcf69e90f0d1e0e4a637e8280991d2",
    },
    {
      nativeVersion: "0.164.0",
      binarySHA256: "d8990e3ee7acfbc26f91265b12a1a83f0fee40d0e0f8f1f40a37d4ec21f499cf",
    },
  ];
  for (const pin of revoked) {
    stage = "production-gate-" + pin.nativeVersion;
    assert.throws(() => checkNativeProfile({ ...codex, ...pin, model: "gpt-6.1-sol" }), {
      message: "native-profile-unqualified",
    });
    assert.equal(providerSpawnAttempts, 0);
  }
  assert.ok(
    revoked.some(
      (p) => p.nativeVersion === codex.nativeVersion && p.binarySHA256 === codex.binarySHA256,
    ),
  );
  assert.equal(codex.model, "gpt-6.1-sol");
  stage = "test-only-fixtures";
  scratch = realpathSync(mkdtempSync("/private/tmp/core-codex-revocation-"));
  const stateFile = join(scratch, "TEST-ONLY-invocations.sqlite");
  const approvalFile = join(scratch, "TEST-ONLY-approval.json");
  const bindings = original.plan.bindings.map((b, i) => {
    const cwd = join(scratch, b.provider);
    mkdirSync(cwd, { mode: 0o700 });
    return { ...b, cwd, nativeSessionId: `00000000-0000-4000-8000-00000000000${i + 1}` };
  });
  const prepared = prepareSupervisedSubscriptionCanary({
    ...original.plan,
    windowId: "offline-revocation-test-only",
    profiles: [codex, ...original.plan.profiles.filter((p) => p.provider !== "codex")],
    bindings,
    environment: {
      HOME: process.env.HOME,
      CODEX_HOME: process.env.CODEX_HOME ?? null,
      TMPDIR: process.env.TMPDIR ?? null,
    },
  });
  const startsAtMs = Date.now() - 1000;
  writeFileSync(
    approvalFile,
    JSON.stringify({
      kind: "owner-approved-supervised-canary",
      planDigest: prepared.planDigest,
      windowId: prepared.plan.windowId,
      deviceId: prepared.plan.deviceId,
      startsAtMs,
      expiresAtMs: startsAtMs + 1800000,
      ownerNativeApprovalRef: "TEST-ONLY-OFFLINE-NOT-RUNTIME-AUTHORITY",
      invocationStateFile: stateFile,
    }),
    { mode: 0o600, flag: "wx" },
  );
  stage = "production-opener";
  const opened = openSupervisedSubscriptionCanary({
    prepared,
    stateFile,
    runtimeApprovalFile: approvalFile,
    deviceId: prepared.plan.deviceId,
  });
  if (opened.kind === "ready") opened.dispatcher.close();
  assert.deepEqual(opened, {
    kind: "held",
    planDigest: prepared.planDigest,
    holds: ["native-profile-unqualified"],
  });
  assert.equal(existsSync(stateFile), false);
  assert.equal(providerSpawnAttempts, 0);
  assert.equal(prepareSupervisedSubscriptionCanary(original.plan).planDigest, original.planDigest);
  report = {
    proof: "codex-subscription-revocation",
    status: "PASS",
    packageVersion: JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
      .version,
    originalPlanDigest: original.planDigest,
    productionGateTuplesHeld: revoked.length,
    productionOpenerVersionHeld: codex.nativeVersion,
    hold: "native-profile-unqualified",
    invocationJournalCreated: false,
    reservations: 0,
    providerSpawnAttempts,
    providerExecutions: 0,
    modelCalls: 0,
    filesystemAclReads,
    actualRuntimeApprovalUsed: false,
    fixtureCleanup: true,
  };
} catch {
  failed = true;
} finally {
  childProcess.spawn = originalSpawn;
  childProcess.spawnSync = originalSpawnSync;
  syncBuiltinESMExports();
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
if (failed) {
  process.stderr.write(
    JSON.stringify({ status: "FAIL", stage, providerSpawnAttempts, filesystemAclReads }) + "\n",
  );
  process.exitCode = 1;
} else process.stdout.write(JSON.stringify(report, null, 2) + "\n");
