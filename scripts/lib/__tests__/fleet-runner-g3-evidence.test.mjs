import { describe, expect, it } from "vitest";
import { checkG3Evidence } from "../../fleet-runner/check-g3-evidence.mjs";

const expected = { image: "sha256:" + "1".repeat(64), source: "2".repeat(40) };
function fixture() {
  const validOutput = (n) => ({ completed: n, acceptedFilesChecked: n, sha256Matches: true });
  return {
    format: "fleet-nas-qualification/1",
    image: expected.image,
    imageSource: expected.source,
    qualifierSource: { commit: "3".repeat(40), sha256: "4".repeat(64) },
    status: "g3-qualified",
    tls: { trustedUnauthenticatedStatus: 401, untrustedCertificateRejected: true },
    storageReadiness: { unwritableRejected: true, recovered: true },
    tcpHealth: "healthy",
    gracefulStop: { exitCode: 0, manualStopStayedStopped: true },
    replacement: { acceptedDataPreserved: true },
    jobs: Array.from({ length: 10 }, (_, i) => String(i)),
    crashes: Array.from({ length: 10 }, (_, i) => ({
      trial: i + 1,
      elapsedMs: 1000,
      acceptedDataPreserved: true,
      replayRejectedWithinSignatureWindow: true,
      ...validOutput(i + 1),
    })),
    reboots: Array.from({ length: 3 }, (_, i) => ({
      trial: i + 1,
      elapsedMs: 60_000,
      bootChanged: true,
      dockerAccessAfterReboot: true,
      ...validOutput(10),
    })),
    negativeCases: [
      { name: "future-schema", code: "schema-incompatible", rejected: true },
      { name: "readonly-output", code: "EROFS", rejected: true },
      { name: "missing-owner-verifier", code: "ENOENT", rejected: true },
    ],
    final: validOutput(10),
  };
}
describe("G3 evidence checker", () => {
  it("accepts complete hardware observations under fixed image/source expectations", () =>
    expect(checkG3Evidence(fixture(), expected).valid).toBe(true));
  it("rejects process-only evidence without three actual appliance boots", () => {
    const x = fixture();
    x.reboots = [];
    x.status = "process-qualified-reboots-pending";
    expect(checkG3Evidence(x, expected).errors).toContain("three-appliance-reboots");
  });
  it("rejects a container restart presented as a hardware reboot", () => {
    const x = fixture();
    x.reboots[1].bootChanged = false;
    expect(checkG3Evidence(x, expected).valid).toBe(false);
  });
  it("rejects missing or mismatched output and recovery outside the bound", () => {
    const x = fixture();
    x.crashes[5].elapsedMs = 60_001;
    x.final.sha256Matches = false;
    expect(checkG3Evidence(x, expected).errors).toEqual(
      expect.arrayContaining(["crash-recovery-and-integrity", "final-output-integrity"]),
    );
  });
  it("rejects a different image and source, even if all reported trials look green", () => {
    const x = fixture();
    x.image = "sha256:" + "5".repeat(64);
    expect(checkG3Evidence(x, expected).errors).toContain("image-source-binding");
  });
  it("does not treat TCP liveness as storage readiness", () => {
    const x = fixture();
    x.storageReadiness.unwritableRejected = false;
    expect(checkG3Evidence(x, expected).errors).toContain("storage-readiness");
  });
});
