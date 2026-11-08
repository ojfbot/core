#!/usr/bin/env node
// Compare hardware observations with fixed G3 expectations, without importing queue/transition code.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function checkG3Evidence(evidence, expected) {
  const errors = [];
  const require = (ok, code) => {
    if (!ok) errors.push(code);
  };
  const validOutput = (r, n) =>
    r?.completed === n && r?.acceptedFilesChecked === n && r?.sha256Matches === true;
  require(evidence.format === "fleet-nas-qualification/1", "format");
  require(evidence.image === expected.image &&
    evidence.imageSource === expected.source, "image-source-binding");
  require(/^[a-f0-9]{40}$/.test(evidence.qualifierSource?.commit ?? "") &&
    /^[a-f0-9]{64}$/.test(evidence.qualifierSource?.sha256 ?? ""), "qualifier-source");
  require(evidence.status === "g3-qualified", "qualification-incomplete");
  require(evidence.tls?.trustedUnauthenticatedStatus === 401 &&
    evidence.tls?.untrustedCertificateRejected === true, "tls-trust");
  require(evidence.storageReadiness?.unwritableRejected === true &&
    evidence.storageReadiness?.recovered === true, "storage-readiness");
  require(evidence.tcpHealth === "healthy", "tcp-liveness");
  require(evidence.gracefulStop?.exitCode === 0 &&
    evidence.gracefulStop?.manualStopStayedStopped === true, "graceful-stop");
  require(evidence.replacement?.acceptedDataPreserved === true, "container-replacement");
  require(evidence.jobs?.length === 10 &&
    new Set(evidence.jobs).size === 10, "unique-fixture-jobs");
  const crashes = evidence.crashes ?? [],
    reboots = evidence.reboots ?? [];
  require(crashes.length === 10 &&
    new Set(crashes.map((r) => r.trial)).size === 10, "ten-crash-trials");
  require(crashes.every(
    (r, i) =>
      r.trial === i + 1 &&
      Number.isFinite(r.elapsedMs) &&
      r.elapsedMs >= 0 &&
      r.elapsedMs < 60_000 &&
      r.acceptedDataPreserved === true &&
      r.replayRejectedWithinSignatureWindow === true &&
      validOutput(r, i + 1),
  ), "crash-recovery-and-integrity");
  require(reboots.length === 3 &&
    new Set(reboots.map((r) => r.trial)).size === 3, "three-appliance-reboots");
  require(reboots.every(
    (r, i) =>
      r.trial === i + 1 &&
      r.bootChanged === true &&
      r.dockerAccessAfterReboot === true &&
      Number.isFinite(r.elapsedMs) &&
      r.elapsedMs >= 0 &&
      r.elapsedMs < 300_000 &&
      validOutput(r, 10),
  ), "reboot-recovery-and-integrity");
  for (const [name, code] of [
    ["future-schema", "schema-incompatible"],
    ["readonly-output", "EROFS"],
    ["missing-owner-verifier", "ENOENT"],
  ]) {
    require((evidence.negativeCases ?? []).some(
      (r) => r.name === name && r.rejected === true && r.code === code,
    ), "negative-" + name);
  }
  require(validOutput(evidence.final, 10), "final-output-integrity");
  return {
    format: "fleet-nas-g3-check/1",
    valid: errors.length === 0,
    crashTrials: crashes.length,
    rebootTrials: reboots.length,
    completed: evidence.final?.completed ?? 0,
    errors,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, image, source] = process.argv.slice(2);
  if (!file || !/^sha256:[a-f0-9]{64}$/.test(image ?? "") || !/^[a-f0-9]{40}$/.test(source ?? "")) {
    console.error(
      "usage: check-g3-evidence.mjs PRIVATE_MANIFEST EXPECTED_IMAGE EXPECTED_SOURCE_COMMIT",
    );
    process.exitCode = 2;
  } else {
    try {
      const result = checkG3Evidence(JSON.parse(await readFile(file, "utf8")), { image, source });
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
    } catch {
      console.error("g3 evidence unreadable");
      process.exitCode = 1;
    }
  }
}
