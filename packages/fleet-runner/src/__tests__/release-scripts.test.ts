import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Slice 1 of the release pipeline: verify-release.sh is what the stage script runs on a CI
// artifact before starting anything. These tests run it under the system bash (3.2 on macOS) with
// a fake `docker` on PATH, so no engine is needed.
const scripts = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts");
const verify = join(scripts, "verify-release.sh");
const releaseImage = join(scripts, "release-image.sh");

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const IMAGE_ID = `sha256:${"a".repeat(64)}`;
const MANIFEST_DIGEST = `sha256:${"b".repeat(64)}`;
const ARCHIVE = "fleet-runner-image.tar";

let dir: string;
let bin: string;

function sha(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeRelease(overrides: Record<string, unknown> = {}, archive = Buffer.from("not really an image")): void {
  const release = {
    format: "fleet-runner-release/1",
    revision: REVISION,
    short_revision: REVISION.slice(0, 12),
    source_date_epoch: 1,
    tag: `fleet-runner:${REVISION}`,
    platform: "linux/amd64",
    user: "node",
    image_id: IMAGE_ID,
    manifest_digest: MANIFEST_DIGEST,
    layers: 3,
    archive: ARCHIVE,
    archive_sha256: sha(Buffer.from("not really an image")),
    inputs: { base_image: "x", pnpm: "9.15.4", buildkit: "y", lockfile_sha256: "z" },
    reproducibility: { builds: 2, identical: true, seconds: [1, 2] },
    ...overrides,
  };
  writeFileSync(join(dir, ARCHIVE), archive);
  writeFileSync(join(dir, `${ARCHIVE}.sha256`), `${sha(archive)}  ${ARCHIVE}\n`);
  writeFileSync(join(dir, "release.json"), `${JSON.stringify(release, null, 2)}\n`);
}

// A docker that answers `image inspect` and `run` from environment variables, and records calls.
function fakeDocker(): void {
  const script = `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_DOCKER_LOG"
case "$1 $2" in
  "image load") exit 0 ;;
  "image inspect")
    case "$4" in
      "{{.Id}}") echo "\${FAKE_ID:-${IMAGE_ID}}" ;;
      "{{.Os}}/{{.Architecture}}") echo "\${FAKE_PLATFORM:-linux/amd64}" ;;
      "{{.Config.User}}") echo "\${FAKE_USER:-node}" ;;
    esac
    ;;
  "run --rm") echo "\${FAKE_UID:-1000}" ;;
esac
`;
  const path = join(bin, "docker");
  writeFileSync(path, script);
  chmodSync(path, 0o755);
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync("/bin/bash", [verify, ...args], {
    encoding: "utf8",
    env: { PATH: `${bin}:/usr/bin:/bin:/usr/local/bin`, FAKE_DOCKER_LOG: join(dir, "docker.log"), ...env },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fleet-release-test-"));
  bin = mkdtempSync(join(tmpdir(), "fleet-release-bin-"));
  fakeDocker();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

describe("verify-release.sh check", () => {
  it("passes an intact release and its full or abbreviated revision", () => {
    writeRelease();
    for (const rev of [[], [REVISION], [REVISION.slice(0, 12)]]) {
      const r = run(["check", dir, ...rev]);
      expect(r.out).toContain("PASS archive checksum");
      expect(r.status).toBe(0);
    }
  });

  it("never touches Docker in check mode", () => {
    writeRelease();
    run(["check", dir, REVISION]);
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("fails when the archive no longer matches its checksum", () => {
    writeRelease();
    writeFileSync(join(dir, ARCHIVE), "tampered");
    const r = run(["check", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive checksum");
  });

  it("fails when release.json records a different archive hash than the checksum file", () => {
    writeRelease({ archive_sha256: "c".repeat(64) });
    expect(run(["check", dir]).out).toContain("FAIL archive checksum");
  });

  it("fails when the release is for another revision", () => {
    writeRelease();
    const r = run(["check", dir, "fedcba9"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL release is revision");
  });

  it("rejects a revision that is not a hex prefix", () => {
    writeRelease();
    expect(run(["check", dir, "main"]).out).toContain("FAIL revision is not a hex commit prefix");
  });

  it.each([
    [{ format: "fleet-runner-release/2" }, "format"],
    [{ revision: "main" }, "full revision"],
    [{ image_id: "sha256:short" }, "image_id"],
    [{ archive: "../elsewhere.tar" }, "archive name"],
    [{ tag: "fleet-runner:latest" }, "tag does not match"],
    [{ platform: "linux/arm64" }, "platform or user"],
    [{ user: "root" }, "platform or user"],
  ])("fails a release.json that says %j", (override, what) => {
    writeRelease(override);
    const r = run(["check", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(`FAIL`);
    expect(r.out).toContain(what);
  });

  it("fails when release.json or the archive is missing", () => {
    expect(run(["check", dir]).out).toContain("FAIL release.json missing");
    writeRelease();
    rmSync(join(dir, `${ARCHIVE}.sha256`));
    expect(run(["check", dir]).out).toContain("FAIL archive or checksum file missing");
  });

  it("prints usage and exits 2 for bad arguments", () => {
    expect(run([]).status).toBe(2);
    expect(run(["bogus", dir]).status).toBe(2);
  });
});

describe("verify-release.sh load", () => {
  it("loads the archive and passes when the image ID, platform and user match", () => {
    writeRelease();
    const r = run(["load", dir, REVISION]);
    expect(r.status).toBe(0);
    expect(r.out).toContain(`PASS image ID ${IMAGE_ID}`);
    expect(r.out).toContain("PASS linux/amd64 as user node");
    expect(r.out).toContain("PASS non-root (uid 1000)");
    expect(readFileSync(join(dir, "docker.log"), "utf8")).toContain(`docker image load --input ${join(dir, ARCHIVE)}`);
  });

  it("accepts the manifest digest an engine with the containerd image store reports", () => {
    writeRelease();
    expect(run(["load", dir], { FAKE_ID: MANIFEST_DIGEST }).status).toBe(0);
  });

  it("fails when the loaded image is not the recorded one", () => {
    writeRelease();
    const r = run(["load", dir], { FAKE_ID: `sha256:${"d".repeat(64)}` });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL image ID");
  });

  it("fails when the loaded image is the wrong platform or user", () => {
    writeRelease();
    expect(run(["load", dir], { FAKE_PLATFORM: "linux/arm64" }).out).toContain("FAIL platform or user");
    expect(run(["load", dir], { FAKE_USER: "root" }).out).toContain("FAIL platform or user");
  });

  it("fails when the image runs as uid 0 even though its configured user is named node", () => {
    writeRelease();
    const r = run(["load", dir], { FAKE_UID: "0" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL image runs as root");
  });

  it("does not load an archive that failed its checksum", () => {
    writeRelease();
    writeFileSync(join(dir, ARCHIVE), "tampered");
    expect(run(["load", dir]).status).toBe(1);
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });
});

describe("release-image.sh", () => {
  it("prints usage and exits 2 without a directory", () => {
    const r = spawnSync("/bin/bash", [releaseImage], { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("usage:");
  });

  it("refuses to overwrite an existing release directory", () => {
    const r = spawnSync("/bin/bash", [releaseImage, dir], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("refusing to overwrite");
  });
});
