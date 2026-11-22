import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Slice 1 of the release pipeline: verify-release.sh is what the stage script runs on a CI
// artifact before starting anything. These tests run it under the system bash (3.2 on macOS) with
// a fake `docker` on PATH, so no engine is needed.
const scripts = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts");
const verify = join(scripts, "verify-release.sh");
const loader = join(scripts, "load-release.sh");
const releaseImage = join(scripts, "release-image.sh");

const REVISION = "0123456789abcdef0123456789abcdef01234567";
const TAG = `fleet-runner:${REVISION}`;
const CONFIG = '{"config":"the image config"}';
const IMAGE_ID = `sha256:${sha(Buffer.from(CONFIG))}`;
const OCI_MANIFEST = JSON.stringify({
  schemaVersion: 2,
  mediaType: "application/vnd.oci.image.manifest.v1+json",
  config: {
    mediaType: "application/vnd.oci.image.config.v1+json",
    digest: IMAGE_ID,
    size: CONFIG.length,
  },
  layers: [],
});
const MANIFEST_DIGEST = `sha256:${sha(Buffer.from(OCI_MANIFEST))}`;
const ARCHIVE = "fleet-runner-image.tar";

let dir: string;
let bin: string;

function sha(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

interface ArchiveShape {
  config?: string;
  tags?: string[];
  indexDigest?: string | null;
  manifest?: boolean;
  images?: number;
  // Replace the manifest text; receives the blob names of the recorded image and an unrelated one.
  manifestRaw?: (good: string, other: string) => string;
  duplicateManifest?: boolean;
  // An extra member that tar and Docker may name differently, or a link.
  dotSlashManifest?: boolean;
  symlink?: boolean;
  // Rewrite the first member's type flag (for example to a pax extended header, `x`).
  typeflag?: string;
  // Rename a member in its tar header, as a name that tar and Docker may clean differently.
  rename?: [string, string];
  indexRaw?: string;
  // Give the blobs/ directory header a nonzero size field, so its "payload" swallows the next members.
  directorySize?: string;
  // Non-zero bytes after the end-of-archive marker.
  trailing?: boolean;
  // The OCI manifest the index points at: its text, the bytes actually stored under its name, or none.
  ociRaw?: string;
  ociBlobBytes?: string;
  omitOci?: boolean;
  layout?: string | boolean;
}

// Plain ustar, as BuildKit writes it; COPYFILE_DISABLE stops macOS tar adding metadata members.
const tarOptions = (cwd: string) => ({ cwd, env: { ...process.env, COPYFILE_DISABLE: "1" } });

// Overwrite the name field of the member called `from` (tar headers are 512 bytes, name first).
function renameMember(bytes: Buffer, from: string, to: string): void {
  for (let pos = 0; pos + 512 <= bytes.length; ) {
    const name = bytes.toString("latin1", pos, pos + 100).replace(/\0.*$/s, "");
    const size = parseInt(
      bytes
        .toString("latin1", pos + 124, pos + 136)
        .replace(/\0.*$/s, "")
        .trim() || "0",
      8,
    );
    if (name === from) {
      bytes.fill(0, pos, pos + 100);
      bytes.write(to, pos, "latin1");
      return;
    }
    pos += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`no member ${from}`);
}

const ociDigest = (shape: { ociRaw?: string }): string =>
  `sha256:${sha(Buffer.from(shape.ociRaw ?? OCI_MANIFEST))}`;

// A small tar shaped like the BuildKit docker export: manifest.json, index.json and config blobs.
function makeArchive(shape: ArchiveShape = {}): Buffer {
  const stage = mkdtempSync(join(tmpdir(), "fleet-release-stage-"));
  try {
    const config = Buffer.from(shape.config ?? CONFIG);
    const blob = `blobs/sha256/${sha(config)}`;
    mkdirSync(join(stage, "blobs/sha256"), { recursive: true });
    writeFileSync(join(stage, blob), config);
    const otherConfig = Buffer.from('{"config":"an unrelated image"}');
    const other = `blobs/sha256/${sha(otherConfig)}`;
    writeFileSync(join(stage, other), otherConfig);
    const entries = Array.from({ length: shape.images ?? 1 }, () => ({
      Config: blob,
      RepoTags: shape.tags ?? [TAG],
      Layers: [],
    }));
    if (!shape.omitOci) {
      const ociName = ociDigest(shape).slice("sha256:".length);
      writeFileSync(
        join(stage, `blobs/sha256/${ociName}`),
        shape.ociBlobBytes ?? shape.ociRaw ?? OCI_MANIFEST,
      );
    }
    const names = ["blobs"];
    if (shape.layout) {
      writeFileSync(
        join(stage, "oci-layout"),
        typeof shape.layout === "string" ? shape.layout : '{"imageLayoutVersion":"1.0.0"}',
      );
      names.push("oci-layout");
    }
    if (shape.manifest !== false) {
      writeFileSync(
        join(stage, "manifest.json"),
        shape.manifestRaw ? shape.manifestRaw(blob, other) : JSON.stringify(entries),
      );
      names.push("manifest.json");
    }
    if (shape.indexDigest !== null) {
      const digest = shape.indexDigest ?? ociDigest(shape);
      const index = {
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [
          {
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            digest,
            size: 1,
            annotations: {
              "io.containerd.image.name": `docker.io/library/${TAG}`,
              "org.opencontainers.image.created": "2026-01-01T00:00:00Z",
              "org.opencontainers.image.ref.name": REVISION,
            },
            platform: { architecture: "amd64", os: "linux" },
          },
        ],
      };
      writeFileSync(join(stage, "index.json"), shape.indexRaw ?? JSON.stringify(index));
      names.push("index.json");
    }
    const out = join(stage, "image.tar");
    const tar = spawnSync("tar", ["--format=ustar", "-cf", out, ...names], tarOptions(stage));
    if (tar.status !== 0) throw new Error("tar failed");
    if (shape.dotSlashManifest)
      spawnSync("tar", ["--format=ustar", "-rf", out, "./manifest.json"], tarOptions(stage));
    if (shape.symlink) {
      symlinkSync("manifest.json", join(stage, "link"));
      spawnSync("tar", ["--format=ustar", "-rf", out, "link"], tarOptions(stage));
    }
    if (shape.duplicateManifest) {
      spawnSync("tar", ["--format=ustar", "-rf", out, "manifest.json"], tarOptions(stage));
    }
    const bytes = readFileSync(out);
    if (shape.typeflag) bytes[156] = shape.typeflag.charCodeAt(0);
    if (shape.rename) renameMember(bytes, shape.rename[0], shape.rename[1]);
    if (shape.directorySize) {
      // The first header is blobs/: write the octal size at offset 124, NUL-terminated.
      bytes.fill(0, 124, 136);
      bytes.write(`${shape.directorySize}\0`, 124, "latin1");
    }
    if (shape.trailing) return Buffer.concat([bytes, Buffer.alloc(512, 1)]);
    return bytes;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

function writeRelease(overrides: Record<string, unknown> = {}, shape: ArchiveShape = {}): void {
  const archive = makeArchive(shape);
  const release = {
    format: "fleet-runner-release/1",
    revision: REVISION,
    short_revision: REVISION.slice(0, 12),
    source_date_epoch: 1,
    tag: TAG,
    platform: "linux/amd64",
    user: "node",
    image_id: IMAGE_ID,
    manifest_digest: ociDigest(shape),
    layers: 3,
    archive: ARCHIVE,
    archive_sha256: sha(archive),
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
    env: {
      PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin:/usr/local/bin`,
      FAKE_DOCKER_LOG: join(dir, "docker.log"),
      ...env,
    },
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

  it("refuses an archive that does not hold the recorded image, before anything is loaded", () => {
    // Same tag, different image: what a host that already has the tag would otherwise accept.
    writeRelease({}, { config: '{"config":"a different image"}' });
    const r = run(["load", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive image ID");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("refuses an archive that carries another tag, or more than one", () => {
    writeRelease({}, { tags: ["fleet-runner:latest"] });
    expect(run(["load", dir]).out).toContain("FAIL archive tags are not exactly");
    writeRelease({}, { tags: [TAG, "fleet-runner:latest"] });
    expect(run(["load", dir]).out).toContain("FAIL archive tags are not exactly");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("refuses an archive whose index names another manifest digest", () => {
    writeRelease({}, { indexDigest: `sha256:${"e".repeat(64)}` });
    const r = run(["load", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive manifest digest");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("refuses an archive with no manifest.json or with two images", () => {
    writeRelease({}, { manifest: false });
    expect(run(["check", dir]).out).toContain("FAIL archive has no manifest.json");
    writeRelease({}, { images: 2 });
    expect(run(["check", dir]).out).toContain("FAIL archive does not hold exactly one image");
  });

  it("checks the archive's own identity in check mode too", () => {
    writeRelease();
    expect(run(["check", dir]).out).toContain(`PASS archive holds ${TAG}`);
  });

  it("reads the real top-level fields, not a decoy nested object or a regex-friendly lookalike", () => {
    // The real Config and RepoTags use spaced keys and name an unrelated image; a compact decoy
    // holding the recorded image sits inside a nested object. Docker loads the real one.
    const forged = (good: string, other: string) =>
      `[{"Config" : "${other}", "RepoTags" : ["${TAG}"], "Layers" : [], ` +
      `"decoy":{"Config":"${good}","RepoTags":["${TAG}"]}}]`;
    writeRelease({}, { manifestRaw: forged });
    const r = run(["load", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL the manifest entry does not have exactly the expected keys");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("reads the real RepoTags when a decoy holds the right tag", () => {
    const forged = (good: string) =>
      `[{"Config" : "${good}", "RepoTags" : ["fleet-runner:latest"], "decoy":{"RepoTags":["${TAG}"]}}]`;
    writeRelease({}, { manifestRaw: forged });
    expect(run(["check", dir]).out).toContain("FAIL the manifest entry does not have exactly");
  });

  it("accepts a valid manifest however it is spaced", () => {
    const spaced = (good: string) =>
      `[ { "Config" : "${good}" , "RepoTags" : [ "${TAG}" ] , "Layers" : [ ] } ]`;
    writeRelease({}, { manifestRaw: spaced });
    expect(run(["check", dir]).status).toBe(0);
  });

  it("refuses a manifest that is not exactly one top-level entry", () => {
    writeRelease({}, { manifestRaw: () => "{}" });
    expect(run(["check", dir]).out).toContain("FAIL archive does not hold exactly one image");
    writeRelease({}, { manifestRaw: () => "not json" });
    expect(run(["check", dir]).out).toContain("FAIL manifest.json is not valid JSON");
  });

  it("refuses an archive with two manifest.json members", () => {
    writeRelease({}, { duplicateManifest: true });
    const r = run(["load", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive has a member that appears twice");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("refuses a manifest.json that tar lists as ./manifest.json, and link members", () => {
    writeRelease({}, { dotSlashManifest: true });
    expect(run(["check", dir]).out).toContain(
      "FAIL archive has a member outside the allowed layout",
    );
    writeRelease({}, { symlink: true });
    expect(run(["check", dir]).out).toContain(
      "FAIL archive has a member that is not a plain file or directory",
    );
  });

  it("refuses pax and GNU extension records, which tar and Docker may read differently", () => {
    for (const flag of ["x", "g", "L", "K"]) {
      writeRelease({}, { typeflag: flag });
      expect(run(["check", dir]).out).toContain(
        "FAIL archive has a member that is not a plain file or directory",
      );
    }
  });

  it("always reads an index.json that is present, and needs the release to record its digest", () => {
    writeRelease({ manifest_digest: null });
    const r = run(["check", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      "FAIL archive has an index.json but the release records no manifest digest",
    );
  });

  it("accepts a release with no index.json and no recorded manifest digest", () => {
    writeRelease({ manifest_digest: null }, { indexDigest: null });
    expect(run(["check", dir]).status).toBe(0);
  });

  it("refuses member names that tar or Docker would clean, and any name off the allowlist", () => {
    for (const name of [
      "./manifest.json",
      "x/../manifest.json",
      "/manifest.json",
      "a//manifest.json",
      "Manifest.json",
    ]) {
      writeRelease({}, { rename: ["manifest.json", name] });
      const r = run(["check", dir]);
      expect(r.status, name).toBe(1);
      expect(r.out, name).toContain("FAIL archive has a member outside the allowed layout");
    }
    writeRelease({}, { rename: ["index.json", "extra.json"] });
    expect(run(["check", dir]).out).toContain(
      "FAIL archive has a member outside the allowed layout",
    );
  });

  it("refuses keys that only differ in case, because Docker matches field names case-insensitively", () => {
    const cased = (good: string, other: string) =>
      `[{"Config":"${good}","config":"${other}","RepoTags":["${TAG}"],"Layers":[]}]`;
    writeRelease({}, { manifestRaw: cased });
    expect(run(["check", dir]).out).toContain(
      "FAIL the manifest entry does not have exactly the expected keys",
    );
    const lower = (good: string) => `[{"Config":"${good}","repotags":["${TAG}"],"Layers":[]}]`;
    writeRelease({}, { manifestRaw: lower });
    expect(run(["check", dir]).out).toContain(
      "FAIL the manifest entry does not have exactly the expected keys",
    );
    writeRelease({}, { indexRaw: '{"schemaVersion":2,"mediaType":"x","Manifests":[]}' });
    expect(run(["check", dir]).out).toContain(
      "FAIL index.json does not have exactly the expected keys",
    );
    writeRelease({ Tag: "fleet-runner:latest" });
    expect(run(["check", dir]).out).toContain(
      "FAIL release.json does not have exactly the expected keys",
    );
  });

  it("refuses a duplicate key in any of the three JSON files", () => {
    const dup = (good: string, other: string) =>
      `[{"Config":"${other}","Config":"${good}","RepoTags":["${TAG}"],"Layers":[]}]`;
    writeRelease({}, { manifestRaw: dup });
    expect(run(["check", dir]).out).toContain('FAIL manifest.json repeats the key "Config"');
    writeRelease(
      {},
      { indexRaw: '{"schemaVersion":2,"schemaVersion":2,"mediaType":"x","manifests":[]}' },
    );
    expect(run(["check", dir]).out).toContain('FAIL index.json repeats the key "schemaVersion"');
    writeRelease();
    const file = join(dir, "release.json");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('  "layers": 3,', '  "layers": 3,\n  "layers": 4,'),
    );
    expect(run(["check", dir]).out).toContain('FAIL release.json repeats the key "layers"');
  });

  it("binds the index annotations and platform that an engine names the loaded image from", () => {
    const index = (name: string, platform: string) =>
      JSON.stringify({
        schemaVersion: 2,
        mediaType: "m",
        manifests: [
          {
            mediaType: "m",
            digest: MANIFEST_DIGEST,
            size: 1,
            annotations: {
              "io.containerd.image.name": name,
              "org.opencontainers.image.created": "t",
              "org.opencontainers.image.ref.name": REVISION,
            },
            platform: { architecture: platform, os: "linux" },
          },
        ],
      });
    writeRelease({}, { indexRaw: index("docker.io/library/fleet-runner:latest", "amd64") });
    expect(run(["check", dir]).out).toContain("FAIL archive index names another image");
    writeRelease({}, { indexRaw: index(`docker.io/library/${TAG}`, "arm64") });
    expect(run(["check", dir]).out).toContain("FAIL archive index platform");
    const wrongRef = index(`docker.io/library/${TAG}`, "amd64").replace(
      `"org.opencontainers.image.ref.name":"${REVISION}"`,
      `"org.opencontainers.image.ref.name":"${"f".repeat(40)}"`,
    );
    writeRelease({}, { indexRaw: wrongRef });
    expect(run(["check", dir]).out).toContain(
      "FAIL archive index ref name is not the release revision",
    );
  });

  it("reads the OCI manifest the index points at, since a containerd-store engine ignores manifest.json", () => {
    // Its bytes must hash to the recorded digest.
    writeRelease({}, { ociBlobBytes: '{"schemaVersion":2}' });
    expect(run(["check", dir]).out).toContain(
      "FAIL archive OCI manifest does not hash to the recorded manifest digest",
    );
    // It must exist.
    writeRelease({}, { omitOci: true });
    expect(run(["check", dir]).out).toContain("FAIL archive has no OCI manifest blob");
    // Its config must be the checked image, even when its own hash matches the recorded digest.
    const other = JSON.parse(OCI_MANIFEST);
    other.config.digest = `sha256:${"9".repeat(64)}`;
    writeRelease({}, { ociRaw: JSON.stringify(other) });
    expect(run(["check", dir]).out).toContain("FAIL archive OCI manifest names another config");
    // Its layers must be the ones manifest.json lists.
    const layered = JSON.parse(OCI_MANIFEST);
    layered.layers = [{ mediaType: "l", digest: `sha256:${"8".repeat(64)}`, size: 1 }];
    writeRelease({}, { ociRaw: JSON.stringify(layered) });
    expect(run(["check", dir]).out).toContain(
      "FAIL archive OCI manifest layers differ from manifest.json",
    );
    for (const text of [`{"MediaType":"x"}`, "not json"]) {
      writeRelease({}, { ociRaw: text });
      expect(run(["check", dir]).status).toBe(1);
    }
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("holds the OCI manifest to the same exact-key and duplicate-key rule", () => {
    const cased = JSON.parse(OCI_MANIFEST);
    cased.Config = cased.config;
    writeRelease({}, { ociRaw: JSON.stringify(cased) });
    expect(run(["check", dir]).out).toContain(
      "FAIL the OCI manifest does not have exactly the expected keys",
    );
    const dup = OCI_MANIFEST.replace('"layers":[]', '"layers":[],"layers":[]');
    writeRelease({}, { ociRaw: dup });
    expect(run(["check", dir]).out).toContain('FAIL the OCI manifest repeats the key "layers"');
    const extra = JSON.parse(OCI_MANIFEST);
    extra.config.urls = ["x"];
    writeRelease({}, { ociRaw: JSON.stringify(extra) });
    expect(run(["check", dir]).out).toContain(
      "FAIL the OCI manifest config does not have exactly the expected keys",
    );
  });

  it("requires an index when oci-layout is present, and an exact oci-layout", () => {
    writeRelease({ manifest_digest: null }, { layout: true, indexDigest: null });
    expect(run(["check", dir]).out).toContain("FAIL archive has an oci-layout but no index.json");
    writeRelease({}, { layout: true });
    expect(run(["check", dir]).status).toBe(0);
    writeRelease({}, { layout: '{"imageLayoutVersion":"1.0.0","extra":1}' });
    expect(run(["check", dir]).out).toContain(
      "FAIL oci-layout does not have exactly the expected keys",
    );
  });

  it("refuses a directory member with a nonzero size, which would hide the members after it", () => {
    writeRelease({}, { directorySize: "00000001000" });
    const r = run(["check", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive directory member has a nonzero size");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("refuses any data after the end-of-archive marker", () => {
    writeRelease({}, { trailing: true });
    expect(run(["check", dir]).out).toContain("FAIL archive has data after its end marker");
    writeRelease();
    expect(run(["check", dir]).status).toBe(0);
  });

  it("fails closed when node is not available to read the archive", () => {
    writeRelease();
    // A PATH of symlinks to exactly the tools the script uses before it reaches node, and no node,
    // wherever node happens to live on this machine (perl: macOS shasum is a perl script).
    const bare = mkdtempSync(join(tmpdir(), "fleet-release-bare-"));
    try {
      for (const tool of ["sed", "head", "awk", "sha256sum", "shasum", "perl"]) {
        const found = spawnSync("sh", ["-c", `command -v ${tool}`], {
          encoding: "utf8",
        }).stdout.trim();
        if (found) symlinkSync(found, join(bare, tool));
      }
      const probe = spawnSync("sh", ["-c", "command -v node"], { env: { PATH: bare } });
      expect(probe.status, "node must not be reachable from the bare PATH").not.toBe(0);
      const result = spawnSync("/bin/bash", [verify, "check", dir], {
        encoding: "utf8",
        env: { PATH: bare },
      });
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain("PASS archive checksum");
      expect(output).toContain("FAIL node is required");
      expect(result.status).toBe(1);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
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
    expect(readFileSync(join(dir, "docker.log"), "utf8")).toContain(
      `docker image load --input ${join(dir, ARCHIVE)}`,
    );
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
    expect(run(["load", dir], { FAKE_PLATFORM: "linux/arm64" }).out).toContain(
      "FAIL platform or user",
    );
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

describe("load-release.sh (the server half: POSIX sh, no node)", () => {
  const sh = (args: string[], env: Record<string, string> = {}, path = `${bin}:/usr/bin:/bin`) =>
    spawnSync("/bin/sh", [loader, ...args], {
      encoding: "utf8",
      env: { PATH: path, FAKE_DOCKER_LOG: join(dir, "docker.log"), ...env },
    });
  const args = () => {
    writeRelease();
    const archiveSha = readFileSync(join(dir, `${ARCHIVE}.sha256`), "utf8").split(/\s+/)[0] ?? "";
    return [join(dir, ARCHIVE), archiveSha, IMAGE_ID, TAG, MANIFEST_DIGEST];
  };

  it("loads and checks an archive whose checksum is the checked one, with no node on the PATH", () => {
    const bare = mkdtempSync(join(tmpdir(), "fleet-release-server-"));
    try {
      for (const tool of ["awk", "tr", "shasum", "sha256sum", "bash", "sh", "cat"]) {
        const found = spawnSync("sh", ["-c", `command -v ${tool}`], {
          encoding: "utf8",
        }).stdout.trim();
        if (found) symlinkSync(found, join(bare, tool));
      }
      symlinkSync(join(bin, "docker"), join(bare, "docker"));
      const r = sh(args(), {}, bare);
      expect(r.stdout).toContain("PASS archive checksum");
      expect(r.stdout).toContain(`PASS image ID ${IMAGE_ID}`);
      expect(r.stdout).toContain("PASS non-root (uid 1000)");
      expect(r.status).toBe(0);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("refuses an archive that is not the checked bytes, before loading it", () => {
    const a = args();
    writeFileSync(join(dir, ARCHIVE), "swapped after the check");
    const r = sh(a);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FAIL archive checksum");
    expect(() => readFileSync(join(dir, "docker.log"))).toThrow();
  });

  it("fails when the loaded image is not the checked one, or runs as root", () => {
    const a = args();
    expect(sh(a, { FAKE_ID: `sha256:${"d".repeat(64)}` }).stdout).toContain("FAIL image ID");
    expect(sh(a, { FAKE_PLATFORM: "linux/arm64" }).stdout).toContain("FAIL platform or user");
    expect(sh(a, { FAKE_UID: "0" }).stdout).toContain("FAIL image runs as root");
  });

  it("rejects malformed arguments", () => {
    const a = args();
    expect(sh([a[0], "short", a[2], a[3]]).stdout).toContain("FAIL archive checksum argument");
    expect(sh([a[0], a[1], "sha256:zz", a[3]]).stdout).toContain("FAIL image ID argument");
    expect(sh([a[0], a[1], a[2], "other:tag"]).stdout).toContain("FAIL tag argument");
    expect(sh([]).status).toBe(2);
  });
});

describe("fleet-runner-release.yml", () => {
  const workflow = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../.github/workflows/fleet-runner-release.yml",
    ),
    "utf8",
  );

  it("checks out full history, so a rebuild can prove the revision belongs to main", () => {
    // GitHub expressions treat the number 0 as false, so `cond && 0 || 1` is always 1. Keep the
    // value a plain literal.
    expect(workflow).toMatch(/^\s+fetch-depth: 0$/m);
    expect(workflow).not.toMatch(/fetch-depth:.*\$\{\{/);
  });

  it("gives every non-pull-request run its own concurrency group and never cancels it", () => {
    expect(workflow).toContain("github.run_id");
    expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it("publishes only from main pushes and dispatches", () => {
    expect(workflow).toContain(
      "github.event_name != 'pull_request' && github.ref == 'refs/heads/main'",
    );
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
