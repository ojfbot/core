import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Slices 2 and 3 of the release pipeline, end to end without a server or Docker: the real scripts
// run from a sandbox git repo; `ssh` runs the "server" side locally in a sandbox folder; `docker`,
// `gh` and `pnpm` are fakes; and the "container" is a real fleet-runner server over TLS from the
// built package, so the signed status, submit and claim are the real ones.
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const IMAGE_ID_OF = (rev: string) => `sha256:${sha(Buffer.from(`config of ${rev}`))}`;

function sha(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

interface Sandbox {
  root: string;
  repo: string;
  bin: string;
  nasDeploy: string;
  nasRoot: string;
  keys: string;
  ca: string;
  conf: string;
  port: number;
  revs: string[];
}
let box: Sandbox;

function sh(cwd: string, command: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

async function freePort(): Promise<number> {
  return await new Promise((ok, bad) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
    s.on("error", bad);
  });
}

// A valid release for a revision: the archive layout BuildKit's docker export writes.
function makeRelease(dir: string, rev: string): void {
  mkdirSync(dir, { recursive: true });
  const stage = mkdtempSync(join(tmpdir(), "fleet-stage-archive-"));
  try {
    const tag = `fleet-runner:${rev}`;
    const config = Buffer.from(`config of ${rev}`);
    const oci = JSON.stringify({
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      config: {
        mediaType: "application/vnd.oci.image.config.v1+json",
        digest: IMAGE_ID_OF(rev),
        size: config.length,
      },
      layers: [],
    });
    const ociDigest = `sha256:${sha(Buffer.from(oci))}`;
    mkdirSync(join(stage, "blobs/sha256"), { recursive: true });
    writeFileSync(join(stage, `blobs/sha256/${sha(config)}`), config);
    writeFileSync(join(stage, `blobs/sha256/${sha(Buffer.from(oci))}`), oci);
    writeFileSync(
      join(stage, "manifest.json"),
      JSON.stringify([{ Config: `blobs/sha256/${sha(config)}`, RepoTags: [tag], Layers: [] }]),
    );
    writeFileSync(
      join(stage, "index.json"),
      JSON.stringify({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [
          {
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            digest: ociDigest,
            size: oci.length,
            annotations: {
              "io.containerd.image.name": `docker.io/library/${tag}`,
              "org.opencontainers.image.created": "2026-01-01T00:00:00Z",
              "org.opencontainers.image.ref.name": rev,
            },
            platform: { architecture: "amd64", os: "linux" },
          },
        ],
      }),
    );
    const out = join(stage, "image.tar");
    const tar = spawnSync(
      "tar",
      ["--format=ustar", "-cf", out, "blobs", "manifest.json", "index.json"],
      { cwd: stage, env: { ...process.env, COPYFILE_DISABLE: "1" } },
    );
    if (tar.status !== 0) throw new Error("tar failed");
    const archive = readFileSync(out);
    writeFileSync(join(dir, "fleet-runner-image.tar"), archive);
    writeFileSync(
      join(dir, "fleet-runner-image.tar.sha256"),
      `${sha(archive)}  fleet-runner-image.tar\n`,
    );
    writeFileSync(
      join(dir, "release.json"),
      `${JSON.stringify(
        {
          format: "fleet-runner-release/1",
          revision: rev,
          short_revision: rev.slice(0, 12),
          source_date_epoch: 1,
          tag,
          platform: "linux/amd64",
          user: "node",
          image_id: IMAGE_ID_OF(rev),
          manifest_digest: ociDigest,
          layers: 0,
          archive: "fleet-runner-image.tar",
          archive_sha256: sha(archive),
          inputs: { base_image: "x", pnpm: "9", buildkit: "y", lockfile_sha256: "z" },
          reproducibility: { builds: 2, identical: true, seconds: [1, 2] },
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

const FAKE_SSH = `#!/bin/bash
# Run the remote command locally, in the sandbox "server".
while [ "$1" = -o ]; do shift 2; done
shift
exec sh -c "$1"
`;

// compose stop/up/ps and the few engine calls the scripts make. Containers are real fleet-runner
// servers (fake-server.mjs) so the signed calls are the real ones.
const FAKE_DOCKER = `#!/bin/bash
S="$FAKE_STATE"; mkdir -p "$S/images"
echo "docker $*" >> "$S/docker.log"
envget() { sed -n "s/^$1=//p" "$ENVFILE" | tail -n 1; }
case "$1" in
  compose)
    shift; project=""; ENVFILE=""
    while [ "$#" -gt 0 ]; do
      case "$1" in -p) project="$2"; shift 2 ;; --env-file) ENVFILE="$2"; shift 2 ;; -f) shift 2 ;; *) break ;; esac
    done
    cmd="$1"; shift
    pidf="$S/$project.pid"
    stop() { if [ -f "$pidf" ]; then kill "$(cat "$pidf")" 2>/dev/null; while kill -0 "$(cat "$pidf")" 2>/dev/null; do sleep 0.1; done; rm -f "$pidf"; fi; }
    case "$cmd" in
      stop) stop ;;
      up)
        rev="$(envget FLEET_REVISION)"; [ -n "$rev" ] || { echo "FLEET_REVISION unset" >&2; exit 1; }
        stop
        build="$rev"; [ "$rev" = "$FAKE_BAD_REV" ] && build="0000000000000000000000000000000000000000"
        FAKE_ROOT="$(envget FLEET_STAGE_ROOT)" FAKE_PORT="$(envget FLEET_HOST_PORT)" FAKE_BUILD="$build" \\
          nohup node "$FAKE_SERVER" >> "$S/server.log" 2>&1 &
        echo $! > "$pidf"; echo "$(envget FLEET_IMAGE)" > "$S/$project.image"
        ;;
      ps) [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null && echo "cid-$project" ;;
    esac
    ;;
  inspect)
    # docker inspect --format {{.Image}} cid  -> the id recorded when the image was loaded
    project="\${4#cid-}"; cat "$S/images/$(cat "$S/$project.image")" ;;
  image)
    case "$2" in
      load)
        rel="$(dirname "$4")/release.json"
        tag="$(sed -n 's/^  "tag": "\\([^"]*\\)".*/\\1/p' "$rel")"; id="$(sed -n 's/^  "image_id": "\\([^"]*\\)".*/\\1/p' "$rel")"
        echo "$id" > "$S/images/$tag" ;;
      inspect)
        tag="\${@: -1}"
        case "$4" in
          "{{.Id}}") cat "$S/images/$tag" ;;
          "{{.Os}}/{{.Architecture}}") echo linux/amd64 ;;
          "{{.Config.User}}") echo node ;;
        esac ;;
    esac ;;
  run) echo 1000 ;;
  ps) cat "$S/ps.txt" 2>/dev/null || true ;;
esac
`;

const FAKE_GH = `#!/bin/bash
echo "gh $*" >> "$FAKE_STATE/gh.log"
case "$1" in
  api) cat "$FAKE_STATE/runs.tsv" ;;
  run)
    # gh run download <id> --repo R --name N --dir D
    id="$3"; shift 3; name=""; dest=""
    while [ "$#" -gt 0 ]; do case "$1" in --name) name="$2"; shift 2 ;; --dir) dest="$2"; shift 2 ;; *) shift ;; esac; done
    src="$FAKE_STATE/artifacts/$id/$name"
    [ -d "$src" ] || exit 1
    cp -R "$src"/. "$dest"/ ;;
esac
`;

const FAKE_SERVER = `
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const pkg = process.env.FAKE_PKG;
const { JobStore } = await import(pkg + "/dist/jobs.js");
const { fleetServer } = await import(pkg + "/dist/server.js");
const root = process.env.FAKE_ROOT;
mkdirSync(join(root, "state"), { recursive: true });
const store = new JobStore(join(root, "state/fleet.sqlite"));
const server = fleetServer(store, {
  registry: join(root, "public-keys"),
  outDir: join(root, "output"),
  workers: ["stage-worker"],
  observers: [],
  build: process.env.FAKE_BUILD,
  tls: { cert: readFileSync(join(root, "tls/server.crt")), key: readFileSync(join(root, "tls/server.key")) },
});
server.listen(Number(process.env.FAKE_PORT), "127.0.0.1");
for (const s of ["SIGTERM", "SIGINT"]) process.once(s, () => { server.close(() => { store.close(); process.exit(0); }); server.closeAllConnections(); });
`;

function stageEnv(extra: Record<string, string> = {}): Record<string, string> {
  return {
    PATH: `${box.bin}:${process.env.PATH ?? ""}`,
    FLEET_STAGE_CONF: box.conf,
    FAKE_STATE: join(box.root, "state-fake"),
    FAKE_SERVER: join(box.bin, "fake-server.mjs"),
    FAKE_PKG: pkg,
    FAKE_BAD_REV: "",
    FLEET_READY_TRIES: "15",
    FLEET_READY_SLEEP: "0.4",
    ...extra,
  };
}

const scriptsIn = (b: Sandbox) => join(b.repo, "packages/fleet-runner/scripts");
const stage = (args: string[], env: Record<string, string> = {}) =>
  sh(box.repo, "bash", [join(scriptsIn(box), "fleet-stage.sh"), ...args], stageEnv(env));
const setup = (args: string[] = [], env: Record<string, string> = {}) =>
  sh(box.repo, "bash", [join(scriptsIn(box), "fleet-stage-setup.sh"), ...args], stageEnv(env));
const fakeState = (name: string) => join(box.root, "state-fake", name);

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-stage-box-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const keys = join(root, "keys");
  const ca = join(root, "ca");
  mkdirSync(join(root, "state-fake"), { recursive: true });
  for (const d of [bin, keys, ca]) mkdirSync(d, { recursive: true });
  chmodSync(keys, 0o700);
  // The sandbox repo holds the real scripts and deploy files, committed twice.
  const target = join(repo, "packages/fleet-runner");
  mkdirSync(target, { recursive: true });
  cpSync(join(pkg, "scripts"), join(target, "scripts"), { recursive: true });
  cpSync(join(pkg, "deploy"), join(target, "deploy"), { recursive: true });
  symlinkSync(join(pkg, "dist"), join(target, "dist"));
  const git = (...a: string[]) => {
    const r = sh(repo, "git", a, {
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.test",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.test",
    });
    if (r.status !== 0) throw new Error(r.out);
    return r.out.trim();
  };
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "first");
  const revs = [git("rev-parse", "HEAD")];
  for (const n of ["second", "third"]) {
    writeFileSync(join(repo, `${n}.txt`), n);
    git("add", "-A");
    git("commit", "-q", "-m", n);
    revs.push(git("rev-parse", "HEAD"));
  }
  writeFileSync(join(bin, "ssh"), FAKE_SSH);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  writeFileSync(join(bin, "gh"), FAKE_GH);
  writeFileSync(join(bin, "pnpm"), "#!/bin/bash\nexit 0\n");
  writeFileSync(join(bin, "fake-server.mjs"), FAKE_SERVER);
  for (const f of ["ssh", "docker", "gh", "pnpm"]) chmodSync(join(bin, f), 0o755);
  // A private CA for the test copy's certificate.
  const o = sh(ca, "openssl", [
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:prime256v1",
    "-nodes",
    "-keyout",
    "ca.key",
    "-out",
    "ca.crt",
    "-days",
    "2",
    "-subj",
    "/CN=test-ca",
  ]);
  if (o.status !== 0) throw new Error(o.out);
  const port = await freePort();
  const nasDeploy = join(root, "nas/deploy");
  const nasRoot = join(root, "nas/root");
  mkdirSync(join(root, "nas"), { recursive: true });
  const conf = join(root, "stage.conf");
  writeFileSync(
    conf,
    [
      "NAS_SSH=sandbox",
      `NAS_STAGE_DIR=${nasDeploy}`,
      `NAS_STAGE_ROOT=${nasRoot}`,
      "STAGE_LAN_IP=127.0.0.1",
      `STAGE_PORT=${port}`,
      "STAGE_HOST=localhost",
      `STAGE_KEYS_DIR=${keys}`,
      `STAGE_CA_DIR=${ca}`,
      `PROD_PORT=${port + 1}`,
      "PROD_CONTAINER=prod-fleet",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  box = { root, repo, bin, nasDeploy, nasRoot, keys, ca, conf, port, revs };
});

afterEach(() => {
  // Stop any fake container still running.
  for (const f of existsSync(fakeState("")) ? readdirSync(fakeState("")) : []) {
    if (f.endsWith(".pid")) {
      try {
        process.kill(Number(readFileSync(fakeState(f), "utf8")));
      } catch {
        /* already gone */
      }
    }
  }
  rmSync(box.root, { recursive: true, force: true });
});

function release(rev: string): string {
  const dir = join(box.root, `release-${rev.slice(0, 7)}`);
  makeRelease(dir, rev);
  return dir;
}

describe("fleet-stage-setup.sh", () => {
  it("creates the marked folders, env file, test keys and certificate, and leaves them alone on a re-run", () => {
    const r = setup(["--tls"]);
    expect(r.out).toContain("PASS test copy folders are ready and marked");
    expect(r.status, r.out).toBe(0);
    for (const f of [".fleet-runner-staging", "fleet-staging.env", "compose.yaml"]) {
      expect(existsSync(join(box.nasDeploy, f)), f).toBe(true);
    }
    for (const f of [
      "public-keys/owner.pub",
      "public-keys/stage-worker.pub",
      "tls/server.crt",
      "tls/server.key",
    ]) {
      expect(existsSync(join(box.nasRoot, f)), f).toBe(true);
    }
    for (const d of ["state", "output"]) expect(existsSync(join(box.nasRoot, d))).toBe(true);
    expect(existsSync(join(box.keys, "ca.crt"))).toBe(true);
    // The private halves stay on this side only.
    expect(readdirSync(join(box.nasRoot, "public-keys")).sort()).toEqual([
      "owner.pub",
      "stage-worker.pub",
    ]);
    expect(readdirSync(join(box.nasRoot, "tls")).sort()).toEqual(["server.crt", "server.key"]);
    const before = readFileSync(join(box.keys, "owner.token"), "utf8");
    const again = setup(["--tls"]);
    expect(again.status, again.out).toBe(0);
    expect(readFileSync(join(box.keys, "owner.token"), "utf8")).toBe(before);
    expect(again.out).toContain("owner key already exists");
    expect(again.out).toContain("a certificate already exists");
    // No secret in the env file, and the container is not run as root.
    const env = readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8");
    expect(env).toContain("FLEET_HOST_PORT=");
    expect(env).not.toMatch(/token|key|password/i);
  });

  it("refuses a folder that already holds files but is not the test copy's", () => {
    mkdirSync(box.nasRoot, { recursive: true });
    writeFileSync(join(box.nasRoot, "someone-elses-data"), "x");
    const r = setup();
    expect(r.status).toBe(1);
    expect(r.out).toContain("is not marked as the test copy");
    expect(existsSync(join(box.nasRoot, "state"))).toBe(false);
  });
});

describe("fleet-stage.sh", () => {
  const prepare = () => {
    const s = setup(["--tls"]);
    if (s.status !== 0) throw new Error(s.out);
  };

  it("stages a first revision: verified, loaded, started, smoke-tested, then stopped again", () => {
    prepare();
    const [a] = box.revs as [string];
    const r = stage([a, "--release", release(a)]);
    expect(r.out).toContain(`PASS status ready, build ${a.slice(0, 7)}`);
    expect(r.out).toContain("PASS signed submit accepted");
    expect(r.out).toContain("PASS worker claimed the job");
    expect(r.out).toContain("PASS job completed and its output verified");
    expect(r.out).toContain("the test copy is stopped again");
    expect(r.status, r.out).toBe(0);
    expect(existsSync(join(box.nasDeploy, "releases", a, "STAGED_OK"))).toBe(true);
    // Stopped: nothing is running between tests.
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    const env = readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8");
    expect(env).toContain(`FLEET_REVISION=${a}`);
    expect(env).toContain(`FLEET_IMAGE=fleet-runner:${a}`);
    // Each revision travelled with its own compose.yaml and loader.
    for (const f of ["compose.yaml", "load-release.sh", "release.json", "fleet-runner-image.tar"]) {
      expect(existsSync(join(box.nasDeploy, "releases", a, f)), f).toBe(true);
    }
  });

  it("clears every earlier pass and keeps the previous state folder when it stages the next revision", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    const r = stage([b, "--release", release(b)]);
    expect(r.status, r.out).toBe(0);
    expect(existsSync(join(box.nasDeploy, "releases", a, "STAGED_OK"))).toBe(false);
    expect(existsSync(join(box.nasDeploy, "releases", b, "STAGED_OK"))).toBe(true);
    expect(readdirSync(box.nasRoot).some((f) => f.startsWith("state.pre-"))).toBe(true);
    expect(readdirSync(box.nasDeploy).some((f) => f.startsWith("fleet-staging.env.pre-"))).toBe(
      true,
    );
    expect(r.out).toContain(`previous test revision: ${a.slice(0, 7)}`);
  });

  it("puts the previous revision back, checks it, and stops it when the new one fails its smoke test", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    // Revision b's server answers with the wrong build, so the status check fails.
    const r = stage([b, "--release", release(b)], { FAKE_BAD_REV: b, FLEET_READY_TRIES: "3" });
    expect(r.status).toBe(1);
    expect(r.out).toContain(`FAIL status not ready on ${b.slice(0, 7)}`);
    expect(r.out).toContain("rolling back to " + a.slice(0, 7));
    expect(r.out).toContain(`PASS status ready, build ${a.slice(0, 7)}`);
    expect(r.out).toContain(`PASS the test copy is back on ${a.slice(0, 7)}`);
    const env = readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8");
    expect(env).toContain(`FLEET_REVISION=${a}`);
    expect(env).not.toContain(b);
    // No revision is left promotable, and nothing is left running.
    expect(existsSync(join(box.nasDeploy, "releases", a, "STAGED_OK"))).toBe(false);
    expect(existsSync(join(box.nasDeploy, "releases", b, "STAGED_OK"))).toBe(false);
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(readdirSync(box.nasRoot).some((f) => f.startsWith("state.failed-"))).toBe(true);
  });

  it("rolls back to the empty state when the first revision ever staged fails", () => {
    prepare();
    const [a] = box.revs as [string];
    const r = stage([a, "--release", release(a)], { FAKE_BAD_REV: a, FLEET_READY_TRIES: "3" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("PASS the test copy is back to its empty state and stopped");
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).not.toContain(
      "FLEET_REVISION",
    );
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
  });

  it("refuses a release that does not verify, before anything reaches the server", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    const dir = release(b);
    writeFileSync(join(dir, "fleet-runner-image.tar"), "tampered");
    const r = stage([a, "--release", dir]);
    expect(r.status).toBe(1);
    expect(existsSync(join(box.nasDeploy, "releases", a))).toBe(false);
    expect(existsSync(fakeState("docker.log"))).toBe(true); // isolation looked at the engine only
    expect(readFileSync(fakeState("docker.log"), "utf8")).not.toContain("compose");
  });

  it("refuses to start unless the test copy is marked, has its own port, and nothing else holds it", () => {
    prepare();
    const [a] = box.revs as [string];
    const dir = release(a);
    // Another container publishes the test copy's port.
    writeFileSync(fakeState("ps.txt"), `some-other-container 127.0.0.1:${box.port}->8787/tcp\n`);
    let r = stage([a, "--release", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("is already published by another container");
    expect(r.out).toContain("the test copy is not isolated from production");
    rmSync(fakeState("ps.txt"));
    // The same port as production.
    writeFileSync(
      box.conf,
      readFileSync(box.conf, "utf8").replace(/^PROD_PORT=.*$/m, `PROD_PORT=${box.port}`),
      { mode: 0o600 },
    );
    r = stage([a, "--release", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("must use different ports");
    // A root that setup never marked.
    writeFileSync(
      box.conf,
      readFileSync(box.conf, "utf8").replace(/^PROD_PORT=.*$/m, `PROD_PORT=${box.port + 1}`),
      { mode: 0o600 },
    );
    rmSync(join(box.nasRoot, ".fleet-runner-staging"));
    r = stage([a, "--release", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("is not marked as the test copy");
    // Production's declared root inside the test copy's, or the reverse.
    writeFileSync(join(box.nasRoot, ".fleet-runner-staging"), "");
    writeFileSync(
      box.conf,
      `${readFileSync(box.conf, "utf8")}NAS_PROD_ROOT=${box.nasRoot}/inner\n`,
      { mode: 0o600 },
    );
    r = stage([a, "--release", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("production root is inside the test copy root");
    expect(existsSync(join(box.nasDeploy, "releases", a))).toBe(false);
  });

  it("refuses a config file others can write", () => {
    prepare();
    chmodSync(box.conf, 0o666);
    const r = stage([box.revs[0]!, "--release", release(box.revs[0]!)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("must not be writable by group or others");
  });

  describe("choosing the CI run to download", () => {
    const rows = (...r: string[][]) =>
      writeFileSync(fakeState("runs.tsv"), r.map((x) => x.join("\t")).join("\n") + "\n");
    const run = (
      id: string,
      event: string,
      sha: string,
      repo = "ojfbot/core",
      branch = "main",
      path = ".github/workflows/fleet-runner-release.yml",
      at = "2026-11-22T00:00:00Z",
    ) => [id, event, branch, sha, repo, path, "success", at];
    const serve = (id: string, rev: string, as = rev) => {
      const dir = join(fakeState("artifacts"), id, `fleet-runner-release-${as.slice(0, 12)}`);
      makeRelease(dir, rev);
    };

    it("downloads by the push run's ID and never takes a fork's look-alike artifact", () => {
      prepare();
      const [a] = box.revs as [string];
      // The fork's run has the real name and the real revision; the real push run is older.
      rows(
        run("900", "pull_request", a, "someone-else/core", "main"),
        run("800", "push", a, "someone-else/core"),
        run("700", "push", a, "ojfbot/core", "feature"),
        run("100", "push", a, "ojfbot/core"),
      );
      serve("900", a);
      serve("800", a);
      serve("700", a);
      serve("100", a);
      const r = stage([a]);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain("from run 100 (push)");
      const log = readFileSync(fakeState("gh.log"), "utf8");
      expect(log).toContain("gh run download 100 --repo ojfbot/core --name fleet-runner-release-");
      for (const id of ["900", "800", "700"]) expect(log).not.toContain(`download ${id}`);
    });

    it("falls back to the newest rebuild run, accepting it only when release.json names the revision", () => {
      prepare();
      const [a, b] = box.revs as [string, string];
      rows(
        // Newest rebuild holds the wrong revision under the right name; the older one is right.
        run(
          "300",
          "workflow_dispatch",
          b,
          "ojfbot/core",
          "main",
          ".github/workflows/fleet-runner-release.yml",
          "2026-11-22T10:00:00Z",
        ),
        run(
          "200",
          "workflow_dispatch",
          b,
          "ojfbot/core",
          "main",
          ".github/workflows/fleet-runner-release.yml",
          "2026-11-22T09:00:00Z",
        ),
        run("150", "push", b, "ojfbot/core", "main", ".github/workflows/other.yml"),
      );
      serve("300", b, a); // named for a, but release.json says b: refused
      serve("200", a);
      const r = stage([a]);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain("from run 200 (rebuild)");
      expect(readFileSync(fakeState("gh.log"), "utf8")).not.toContain("download 150");
    });

    it("says what to do when no trusted release exists", () => {
      prepare();
      rows(run("900", "pull_request", box.revs[0]!, "someone-else/core"));
      const r = stage([box.revs[0]!]);
      expect(r.status).toBe(1);
      expect(r.out).toContain("no trusted CI release");
      expect(existsSync(join(box.nasDeploy, "releases", box.revs[0]!))).toBe(false);
    });
  });
});
