import { spawn, spawnSync } from "node:child_process";
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Slices 2 and 3 of the release pipeline, end to end without a server or Docker: the real scripts
// run from a sandbox git repo; `ssh` runs the "server" side locally in a sandbox folder; `docker`,
// `gh` and `pnpm` are fakes; and the "container" is a real fleet-runner server over TLS from the
// built package, so the signed status, submit and claim are the real ones.
// Each stage run starts a real TLS server and polls it, so give every test room.
vi.setConfig({ testTimeout: 120_000 });
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
# Run the remote command locally, in the sandbox "server". FAKE_SSH_FAIL_MATCH makes any call whose
# command or input contains that text fail like a lost connection.
while [ "$1" = -o ]; do shift 2; done
shift
cmd="$1"
in="$(mktemp)"; cat > "$in"
if [ -n "$FAKE_SSH_FAIL_MATCH" ] && { grep -q -e "$FAKE_SSH_FAIL_MATCH" "$in" || printf '%s' "$cmd" | grep -q -e "$FAKE_SSH_FAIL_MATCH"; }; then
  rm -f "$in"; echo "ssh: connection lost" >&2; exit 255
fi
# The switch is the one script that copies the state folder: remember this ssh so a test can kill
# only the client side while the server side keeps running.
if grep -q -e 'cp -a' "$in"; then echo $$ > "$FAKE_STATE/switch-ssh.pid"; fi
if grep -q -e 'staged and smoke-tested' "$in"; then echo $$ > "$FAKE_STATE/record-ssh.pid"; fi
sh -c 'readlink -f "$(command -v sh)" 2>/dev/null || command -v sh' > "$FAKE_STATE/remote-sh"
sh -c "$cmd" < "$in"; rc=$?
# Run it, then lose the connection before the acknowledgement arrives.
if [ -n "$FAKE_SSH_FAIL_AFTER_MATCH" ] && { grep -q -e "$FAKE_SSH_FAIL_AFTER_MATCH" "$in" 2>/dev/null || printf '%s' "$cmd" | grep -q -e "$FAKE_SSH_FAIL_AFTER_MATCH"; }; then rm -f "$in"; exit 255; fi
rm -f "$in"; exit $rc
`;

// compose stop/up/ps and the few engine calls the scripts make. Containers are real fleet-runner
// servers (fake-server.mjs) so the signed calls are the real ones.
const FAKE_DOCKER = `#!/bin/bash
S="$FAKE_STATE"; mkdir -p "$S/images"
echo "docker $*" >> "$S/docker.log"
# Like Compose, a variable in the calling shell wins over the env file.
envget() { n="$1"; if [ -n "\${!n}" ]; then printf '%s' "\${!n}"; else sed -n "s/^$n=//p" "$ENVFILE" | tail -n 1; fi; }
case "$1" in
  compose)
    shift; project=""; ENVFILE=""
    while [ "$#" -gt 0 ]; do
      case "$1" in -p) project="$2"; shift 2 ;; --env-file) ENVFILE="$2"; shift 2 ;; -f) shift 2 ;; *) break ;; esac
    done
    cmd="$1"; shift
    pidf="$S/$project.pid"
    # Compose interpolates the whole file for every subcommand: a missing required variable fails.
    if [ -z "$(envget FLEET_REVISION)" ] || [ -z "$(envget FLEET_IMAGE)" ]; then
      echo "required variable FLEET_REVISION is missing a value" >&2; exit 1
    fi
    stop() { if [ -f "$pidf" ]; then kill "$(cat "$pidf")" 2>/dev/null; while kill -0 "$(cat "$pidf")" 2>/dev/null; do sleep 0.1; done; rm -f "$pidf"; fi; }
    case "$cmd" in
      config)
        root="$(envget FLEET_STAGE_ROOT)"; port="$(envget FLEET_HOST_PORT)"
        [ -z "$FAKE_CONFIG_LIE" ] || port=1
        cat <<OUT
name: $project
services:
  fleet-runner:
    volumes:
      - type: bind
        source: $root/state
        target: /var/lib/fleet-runner/state
      - type: bind
        source: $root/output
        target: /var/lib/fleet-runner/output
      - type: bind
        source: $root/public-keys
        target: /run/fleet-runner/public-keys
      - type: bind
        source: $root/tls
        target: /run/fleet-runner/tls
    ports:
      - mode: ingress
        host_ip: $(envget FLEET_LAN_IP)
        target: 8787
        published: "$port"
        protocol: tcp
OUT
        if [ -n "$FAKE_CONFIG_EXTRA_PORT" ]; then
          printf '      - mode: ingress\n        host_ip: 0.0.0.0\n        target: 22\n        published: "2222"\n'
        fi
        ;;
      stop) stop ;;
      up)
        rev="$(envget FLEET_REVISION)"; [ -n "$rev" ] || { echo "FLEET_REVISION unset" >&2; exit 1; }
        stop
        sleep "\${FAKE_PRE_UP_SLEEP:-0}"
        build="$rev"
        case ",$FAKE_BAD_REV," in *",$rev,"*) build="0000000000000000000000000000000000000000" ;; esac
        # A real container belongs to the engine, not to the caller's process group: give the fake
        # one its own group (job control), so it does not keep a fenced script's group alive.
        set -m
        FAKE_ROOT="$(envget FLEET_STAGE_ROOT)" FAKE_PORT="$(envget FLEET_HOST_PORT)" FAKE_BUILD="$build" \\
          nohup node "$FAKE_SERVER" >> "$S/server.log" 2>&1 &
        set +m
        echo $! > "$pidf"; echo "$(envget FLEET_IMAGE)" > "$S/$project.image"
        sleep "\${FAKE_UP_SLEEP:-0}"
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
  ps)
    if printf '%s\n' "$@" | grep -q -e '^-q$'; then
      project="$(printf '%s\n' "$@" | sed -n 's/^label=com.docker.compose.project=//p')"
      pidf="$S/$project.pid"
      if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then echo "cid-$project"; fi
    else
      cat "$S/ps.txt" 2>/dev/null || true
    fi ;;
  stop)
    [ -z "$FAKE_STOP_FAILS" ] || { echo "cannot stop" >&2; exit 1; }
    for a in "$@"; do
      case "$a" in cid-*)
        pidf="$S/\${a#cid-}.pid"
        if [ -f "$pidf" ]; then kill "$(cat "$pidf")" 2>/dev/null; while kill -0 "$(cat "$pidf")" 2>/dev/null; do sleep 0.1; done; rm -f "$pidf"; fi ;;
      esac
    done ;;
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
    FAKE_MV_SLEEP: "",
    FAKE_MV_FAIL_RECORD: "",
    FAKE_CONFIG_LIE: "",
    FAKE_CONFIG_EXTRA_PORT: "",
    FAKE_UP_SLEEP: "0",
    FAKE_PRE_UP_SLEEP: "0",
    FAKE_SSH_FAIL_AFTER_MATCH: "",
    FLEET_FENCE_WAIT: "30",
    FAKE_SSH_FAIL_MATCH: "",
    FAKE_STOP_FAILS: "",
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
// The pass record is one file, written by one rename: the last revision that passed, and the one
// staged (promotable) now.
const stateValue = (key: "last_passed" | "staged_ok"): string => {
  try {
    const text = readFileSync(join(box.nasDeploy, "stage-state"), "utf8");
    return new RegExp(`^${key}=(.*)$`, "m").exec(text)?.[1] ?? "";
  } catch {
    return "";
  }
};
const isStaged = (rev: string): boolean => stateValue("staged_ok") === rev;
const upCount = (): number => {
  try {
    return (readFileSync(fakeState("docker.log"), "utf8").match(/ up -d /g) ?? []).length;
  } catch {
    return 0;
  }
};
// Wait until a run that started after `before` is inside its `docker compose up` (the fake's
// start-up delay), which is the window where killing a client or a shell matters.
async function waitForUp(before: number): Promise<void> {
  for (let i = 0; i < 200 && upCount() <= before; i += 1) {
    await new Promise((ok) => setTimeout(ok, 50));
  }
  if (upCount() <= before) throw new Error("compose up never started");
}
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
  // The server-side `sh` is dash when there is one (a Linux runner's /bin/sh is dash; the server's
  // is bash): dash is the stricter shell, and rejects, for one, `kill -0 -- -pgid`.
  if (existsSync("/bin/dash")) symlinkSync("/bin/dash", join(bin, "sh"));
  if (spawnSync("sh", ["-c", "command -v setsid"]).status !== 0) {
    writeFileSync(
      join(bin, "setsid"),
      `#!/bin/bash\nexec perl -MPOSIX -e 'POSIX::setsid(); exec { $ARGV[0] } @ARGV' -- "$@"\n`,
    );
    chmodSync(join(bin, "setsid"), 0o755);
  }
  writeFileSync(
    join(bin, "mv"),
    `#!/bin/bash
# FAKE_MV_SLEEP slows the rename that publishes stage-state, to open a window for a test.
case "$*" in *stage-state.new*)
  [ -z "$FAKE_MV_SLEEP" ] || sleep "$FAKE_MV_SLEEP"
  # Only the write that names a staged revision fails; clearing and rolling back still work.
  if [ -n "$FAKE_MV_FAIL_RECORD" ]; then
    for a in "$@"; do case "$a" in *stage-state.new) grep -q '^staged_ok=[0-9a-f]' "$a" && { echo "mv: disk error" >&2; exit 1; } ;; esac; done
  fi ;;
esac
exec /bin/mv "$@"
`,
  );
  chmodSync(join(bin, "mv"), 0o755);
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
    expect(isStaged(a)).toBe(true);
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
    expect(isStaged(a)).toBe(false);
    expect(isStaged(b)).toBe(true);
    expect(readdirSync(box.nasRoot).some((f) => f.startsWith("state.pre-"))).toBe(true);
    expect(readdirSync(box.nasDeploy).some((f) => f.startsWith("fleet-staging.env.pre-"))).toBe(
      true,
    );
    expect(r.out).toContain(`last revision that passed in the test copy: ${a.slice(0, 7)}`);
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
    expect(isStaged(a)).toBe(false);
    expect(isStaged(b)).toBe(false);
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

  it("stops the failed container by its project label, even though the env file has no revision (HIGH 1)", () => {
    prepare();
    const [a] = box.revs as [string];
    const r = stage([a, "--release", release(a)], { FAKE_BAD_REV: a, FLEET_READY_TRIES: "3" });
    expect(r.status).toBe(1);
    // The fake compose, like the real one, refuses every subcommand when the env file lacks the
    // required revision, so only a label-based stop can have worked.
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(readFileSync(fakeState("docker.log"), "utf8")).toContain("docker stop");
    expect(readdirSync(box.nasRoot).some((f) => f.startsWith("state.failed-"))).toBe(true);
  });

  it("never reports PASS when the stop fails: a container left running is a FAIL (HIGH 1)", () => {
    prepare();
    const [a] = box.revs as [string];
    const r = stage([a, "--release", release(a)], {
      FAKE_BAD_REV: a,
      FLEET_READY_TRIES: "3",
      FAKE_STOP_FAILS: "1",
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL could not stop the test copy");
    expect(r.out).toContain("FAIL could not confirm the test copy is stopped");
    expect(r.out).not.toContain("PASS the test copy is back");
    // The state folder was not swapped under a container that is still running.
    expect(readdirSync(box.nasRoot).some((f) => f.startsWith("state.failed-"))).toBe(false);
  });

  it("rolls back and stops when the connection is lost after the smoke test passed (HIGH 2)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    // Recording the pass is the last call; losing the connection there must not leave b running or
    // promotable.
    const r = stage([b, "--release", release(b)], {
      FAKE_SSH_FAIL_MATCH: "staged and smoke-tested",
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL could not record the pass");
    expect(r.out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    expect(isStaged(b)).toBe(false);
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(stateValue("last_passed")).toBe(a);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
  });

  it("reports FAIL, not PASS, when the previous revision does not come back either (HIGH 2)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    const r = stage([b, "--release", release(b)], {
      FAKE_BAD_REV: `${a},${b}`,
      FLEET_READY_TRIES: "3",
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL the test copy did not come back cleanly");
    expect(r.out).not.toContain("PASS the test copy is back");
    // Even then nothing is left running.
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
  });

  it("rolls back and stops when the run is terminated in the middle of the switch (HIGH 2)", async () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    const dir = release(b);
    const child = spawn("bash", [join(scriptsIn(box), "fleet-stage.sh"), b, "--release", dir], {
      cwd: box.repo,
      env: { ...process.env, ...stageEnv({ FAKE_UP_SLEEP: "3" }) },
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    const closed = new Promise<number | null>((ok) => child.on("close", ok));
    // b's container has started (the fake `up` is sleeping): terminate the script, as Ctrl-C would.
    for (let i = 0; i < 100 && !existsSync(fakeState("fleet-runner-staging.pid")); i += 1) {
      await new Promise((ok) => setTimeout(ok, 100));
    }
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(true);
    child.kill("SIGTERM");
    const status = await closed;
    expect(status).not.toBe(0);
    expect(out).toContain(`rolling back to ${a.slice(0, 7)}`);
    expect(out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(isStaged(b)).toBe(false);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
  }, 60_000);

  it("puts back the last revision that PASSED, not whatever the env file holds (MEDIUM 3)", () => {
    prepare();
    const [a, b, c] = box.revs as [string, string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    // A partial earlier run left the env file naming a revision that never passed.
    const envFile = join(box.nasDeploy, "fleet-staging.env");
    writeFileSync(
      envFile,
      `${readFileSync(envFile, "utf8").replace(/^FLEET_(REVISION|IMAGE)=.*\n/gm, "")}FLEET_REVISION=${c}\nFLEET_IMAGE=fleet-runner:${c}\n`,
    );
    const r = stage([b, "--release", release(b)], { FAKE_BAD_REV: b, FLEET_READY_TRIES: "3" });
    expect(r.status).toBe(1);
    expect(r.out).toContain(`last revision that passed in the test copy: ${a.slice(0, 7)}`);
    expect(r.out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    const env = readFileSync(envFile, "utf8");
    expect(env).toContain(`FLEET_REVISION=${a}`);
    expect(env).not.toContain(c);
    // A failed run does not move the record.
    expect(stateValue("last_passed")).toBe(a);
  });

  it("holds a lock for the whole run, names every backup by run ID, and refuses a second run (MEDIUM 3)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    // Another run holds the lock: refused, and the other run's lock is left alone.
    mkdirSync(join(box.nasDeploy, ".stage-lock"));
    writeFileSync(join(box.nasDeploy, ".stage-lock", "owner"), "someone-else");
    const refused = stage([a, "--release", release(a)]);
    expect(refused.status).toBe(1);
    expect(refused.out).toContain("another stage run holds the lock (someone-else)");
    expect(existsSync(join(box.nasDeploy, ".stage-lock", "owner"))).toBe(true);
    expect(existsSync(join(box.nasDeploy, "releases", a))).toBe(false);
    rmSync(join(box.nasDeploy, ".stage-lock"), { recursive: true });
    // A normal run releases its own lock, and its backups carry its run ID.
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    expect(stage([b, "--release", release(b)]).status).toBe(0);
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
    const backups = readdirSync(box.nasDeploy).filter((f) =>
      f.startsWith("fleet-staging.env.pre-"),
    );
    expect(backups).toHaveLength(2);
    for (const f of backups) expect(f).toMatch(/pre-\d{8}T\d{6}Z-\d+$/);
    expect(new Set(backups).size).toBe(2);
  });

  it("verifies on this machine every time, and refuses a server copy that is not the verified release (MEDIUM 4)", () => {
    prepare();
    const [a] = box.revs as [string];
    const good = release(a);
    expect(stage([a, "--release", good]).status).toBe(0);
    // A tampered local release is refused even though the server already holds a good copy.
    const bad = join(box.root, "release-bad");
    cpSync(good, bad, { recursive: true });
    writeFileSync(join(bad, "fleet-runner-image.tar"), "tampered");
    let r = stage([a, "--release", bad]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive checksum");
    // A server copy that differs from the verified release is refused, never trusted for itself.
    const remote = join(box.nasDeploy, "releases", a, "release.json");
    writeFileSync(remote, readFileSync(remote, "utf8").replace('"layers": 0', '"layers": 7'));
    r = stage([a, "--release", good]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("is not the release just verified");
    // The identical copy is accepted without being sent again.
    writeFileSync(remote, readFileSync(join(good, "release.json"), "utf8"));
    r = stage([a, "--release", good]);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain("the server already holds exactly this release");
  });

  it("refuses when the server env file and the private config disagree (MEDIUM 5)", () => {
    prepare();
    const [a] = box.revs as [string];
    const dir = release(a);
    const envFile = join(box.nasDeploy, "fleet-staging.env");
    const original = readFileSync(envFile, "utf8");
    for (const [key, wrong] of [
      ["FLEET_HOST_PORT", "1"],
      ["FLEET_STAGE_ROOT", "/somewhere/else"],
      ["FLEET_LAN_IP", "192.0.2.1"],
    ] as const) {
      writeFileSync(envFile, original.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${wrong}`));
      const r = stage([a, "--release", dir]);
      expect(r.status, key).toBe(1);
      expect(r.out, key).toContain(`${key} differs from the private config`);
      expect(existsSync(join(box.nasDeploy, "releases", a)), key).toBe(false);
      // Setup refuses it too, instead of leaving it as it is.
      expect(setup().out, key).toContain(`${key} differs from the private config`);
    }
  });

  it("refuses an env file that points the container at production's root while the config names the marked test root (HIGH)", () => {
    prepare();
    const [a] = box.revs as [string];
    const dir = release(a);
    // Production's root exists, holds its own data, and is declared in the private config.
    const prodRoot = join(box.root, "nas/production-root");
    mkdirSync(join(prodRoot, "state"), { recursive: true });
    writeFileSync(join(prodRoot, "state", "fleet.sqlite"), "production data");
    writeFileSync(box.conf, `${readFileSync(box.conf, "utf8")}NAS_PROD_ROOT=${prodRoot}\n`, {
      mode: 0o600,
    });
    // Compose would read the server env file, so this is what the container would actually open.
    const envFile = join(box.nasDeploy, "fleet-staging.env");
    writeFileSync(
      envFile,
      readFileSync(envFile, "utf8").replace(
        /^FLEET_STAGE_ROOT=.*$/m,
        `FLEET_STAGE_ROOT=${prodRoot}`,
      ),
    );
    const r = stage([a, "--release", dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FLEET_STAGE_ROOT differs from the private config");
    expect(existsSync(join(box.nasDeploy, "releases", a))).toBe(false);
    expect(readFileSync(join(prodRoot, "state", "fleet.sqlite"), "utf8")).toBe("production data");
    expect(readFileSync(fakeState("docker.log"), "utf8")).not.toContain("compose");
  });

  it("does not report success when the final stop fails: nothing is promotable (MEDIUM)", () => {
    prepare();
    const [a] = box.revs as [string];
    const r = stage([a, "--release", release(a)], { FAKE_STOP_FAILS: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL could not stop the test copy");
    expect(r.out).not.toContain("PASS " + a.slice(0, 7) + " is staged");
    expect(isStaged(a)).toBe(false);
    expect(stateValue("last_passed")).toBe("");
  });

  it("does not back up the state while the previous service may still be writing (MEDIUM)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    // a is left running, as --keep-running does; the stop before b's backup fails.
    expect(stage([a, "--release", release(a), "--keep-running"]).status).toBe(0);
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(true);
    const backupsBefore = readdirSync(box.nasRoot).filter((f) => f.startsWith("state.pre-"));
    const r = stage([b, "--release", release(b)], { FAKE_STOP_FAILS: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL could not stop the test copy");
    // No new backup was taken: the copy of the state is only made once nothing is running.
    expect(readdirSync(box.nasRoot).filter((f) => f.startsWith("state.pre-"))).toEqual(
      backupsBefore,
    );
    expect(isStaged(b)).toBe(false);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
  });

  it("works when the private config exports its STAGE_* settings, in the smoke test and in a rollback (MEDIUM)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    writeFileSync(
      box.conf,
      readFileSync(box.conf, "utf8")
        .split("\n")
        .map((l) => (/^(STAGE_|NAS_|PROD_)[A-Z_]*=/.test(l) ? `export ${l}` : l))
        .join("\n"),
      { mode: 0o600 },
    );
    expect(readFileSync(box.conf, "utf8")).toContain("export STAGE_HOST=");
    expect(readFileSync(box.conf, "utf8")).toContain("export STAGE_KEYS_DIR=");
    const first = stage([a, "--release", release(a)]);
    expect(first.status, first.out).toBe(0);
    expect(first.out).not.toContain("unbound variable");
    // The readiness wait inside a rollback needs the same variables.
    const r = stage([b, "--release", release(b)], { FAKE_BAD_REV: b, FLEET_READY_TRIES: "3" });
    expect(r.status).toBe(1);
    expect(r.out).not.toContain("unbound variable");
    expect(r.out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
  });

  it("refuses an env file Compose could read differently: export, duplicate keys, quotes (HIGH)", () => {
    prepare();
    const [a] = box.revs as [string];
    const dir = release(a);
    const prodRoot = join(box.root, "nas/production-root");
    mkdirSync(prodRoot, { recursive: true });
    const envFile = join(box.nasDeploy, "fleet-staging.env");
    const original = readFileSync(envFile, "utf8");
    const variants: [string, string][] = [
      // The test root first, then an `export` of production's root that Compose lets win.
      ["export", `${original}export FLEET_STAGE_ROOT=${prodRoot}\n`],
      ["duplicate", `${original}FLEET_STAGE_ROOT=${prodRoot}\n`],
      ["quoted", original.replace(/^FLEET_HOST_PORT=(.*)$/m, 'FLEET_HOST_PORT="$1"')],
      ["interpolated", `${original}FLEET_WORKERS=\${"$"}{HOME}\n`],
    ];
    for (const [name, text] of variants) {
      writeFileSync(envFile, text);
      const r = stage([a, "--release", dir]);
      expect(r.status, name).toBe(1);
      expect(r.out, name).toContain("fleet-staging.env is not one plain KEY=value per line");
      expect(existsSync(join(box.nasDeploy, "releases", a)), name).toBe(false);
      expect(setup().out, name).toContain("not one plain KEY=value per line");
    }
    // And the file setup and the stage script write themselves passes.
    writeFileSync(envFile, original);
    expect(stage([a, "--release", dir]).status).toBe(0);
    expect(readFileSync(envFile, "utf8")).toMatch(/^FLEET_REVISION=[0-9a-f]{40}$/m);
  });

  it("waits for a switch still running on the server after the client side is killed, then rolls back (MEDIUM)", async () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    // The server side of the switch sleeps 4 s before it would start b.
    rmSync(fakeState("switch-ssh.pid"), { force: true });
    const upBefore = upCount();
    const child = spawn(
      "bash",
      [join(scriptsIn(box), "fleet-stage.sh"), b, "--release", release(b)],
      {
        cwd: box.repo,
        env: { ...process.env, ...stageEnv({ FAKE_PRE_UP_SLEEP: "4" }) },
      },
    );
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    const closed = new Promise<number | null>((ok) => child.on("close", ok));
    // Wait until Compose has really begun: that is the window where a lost client matters.
    await waitForUp(upBefore);
    // Kill only the client's ssh, as Ctrl-C does; the server's script keeps running.
    process.kill(Number(readFileSync(fakeState("switch-ssh.pid"), "utf8")), "SIGKILL");
    const status = await closed;
    expect(status).not.toBe(0);
    // Wait out the orphaned switch, whatever it would have done after the rollback.
    await new Promise((ok) => setTimeout(ok, 6000));
    expect(out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    // The untested revision never ran after the rollback finished.
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    expect(isStaged(b)).toBe(false);
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
  }, 90_000);

  it("keeps the lock, and does not claim a rollback, when the server-side switch will not end (MEDIUM)", async () => {
    prepare();
    const [a] = box.revs as [string];
    rmSync(fakeState("switch-ssh.pid"), { force: true });
    // The server side sleeps 8 s but the rollback will wait only 2.
    const upBefore = upCount();
    const child = spawn(
      "bash",
      [join(scriptsIn(box), "fleet-stage.sh"), a, "--release", release(a)],
      {
        cwd: box.repo,
        env: { ...process.env, ...stageEnv({ FAKE_PRE_UP_SLEEP: "8", FLEET_FENCE_WAIT: "2" }) },
      },
    );
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    const closed = new Promise<number | null>((ok) => child.on("close", ok));
    // Wait until Compose has really begun: that is the window where a lost client matters.
    await waitForUp(upBefore);
    process.kill(Number(readFileSync(fakeState("switch-ssh.pid"), "utf8")), "SIGKILL");
    expect(await closed).not.toBe(0);
    expect(out).toContain("process group");
    expect(out).toContain("is still running after 2 seconds; the lock is kept");
    expect(out).toContain("the stage lock is kept");
    expect(out).not.toContain("PASS the test copy is back");
    // The next run is refused until a person has looked.
    expect(existsSync(join(box.nasDeploy, ".stage-lock", "owner"))).toBe(true);
    const next = stage([a, "--release", release(a)]);
    expect(next.out).toContain("another stage run holds the lock");
    // Let the orphaned server-side script finish before the sandbox is removed.
    for (
      let i = 0;
      i < 150 && existsSync(join(box.nasDeploy, ".stage-lock", "fenced.pid"));
      i += 1
    ) {
      await new Promise((ok) => setTimeout(ok, 100));
    }
  }, 90_000);

  it("removes a pass record whose acknowledgement was lost, and restores last-passed (MEDIUM)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    // The record is written on the server, then the connection drops before the reply.
    const r = stage([b, "--release", release(b)], {
      FAKE_SSH_FAIL_AFTER_MATCH: "staged and smoke-tested",
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL could not record the pass");
    expect(r.out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    expect(isStaged(b)).toBe(false);
    expect(stateValue("last_passed")).toBe(a);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    // Neither half of the half-written pass is left behind.
    expect(existsSync(join(box.nasDeploy, "stage-state.new"))).toBe(false);
    // With nothing having passed before, the rollback leaves no last-passed at all.
  });

  it("ignores FLEET_* and COMPOSE_* variables in the server shell: Compose would prefer them to the env file (MEDIUM)", () => {
    prepare();
    const [a] = box.revs as [string];
    const prodRoot = join(box.root, "nas/production-root");
    mkdirSync(join(prodRoot, "state"), { recursive: true });
    writeFileSync(join(prodRoot, "state", "fleet.sqlite"), "production data");
    // A server profile that exports what deployment.md once told operators to set by hand.
    const r = stage([a, "--release", release(a)], {
      FLEET_HOST_PORT: "1",
      FLEET_STAGE_ROOT: prodRoot,
      FLEET_LAN_IP: "192.0.2.1",
      FLEET_IMAGE: "someone-elses-image",
      FLEET_REVISION: "0".repeat(40),
      COMPOSE_PROJECT_NAME: "production",
    });
    expect(r.status, r.out).toBe(0);
    // It ran on the test copy's own port and folders, and production's data was never opened.
    expect(r.out).toContain(`PASS status ready, build ${a.slice(0, 7)}`);
    expect(readFileSync(join(prodRoot, "state", "fleet.sqlite"), "utf8")).toBe("production data");
    expect(readdirSync(join(prodRoot, "state"))).toEqual(["fleet.sqlite"]);
  });

  it("checks the resolved compose config right before it starts anything (MEDIUM)", () => {
    prepare();
    const [a] = box.revs as [string];
    // The compose file would resolve to another port than the config says.
    const r = stage([a, "--release", release(a)], { FAKE_CONFIG_LIE: "1", FLEET_READY_TRIES: "2" });
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      "FAIL the resolved compose config is not the test copy own folders, port and name",
    );
    // Nothing was started, and the rollback left it at rest.
    expect(readFileSync(fakeState("docker.log"), "utf8")).not.toContain(" up ");
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(isStaged(a)).toBe(false);
  });

  it("waits out a child that survives the switch shell being killed, then rolls back (MEDIUM)", async () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    const upBefore = upCount();
    const child = spawn(
      "bash",
      [join(scriptsIn(box), "fleet-stage.sh"), b, "--release", release(b)],
      {
        cwd: box.repo,
        // The compose child sleeps 4 s before it would start b.
        env: { ...process.env, ...stageEnv({ FAKE_PRE_UP_SLEEP: "4" }) },
      },
    );
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    const closed = new Promise<number | null>((ok) => child.on("close", ok));
    const pidFile = join(box.nasDeploy, ".stage-lock", "fenced.pid");
    await waitForUp(upBefore);
    // A hangup takes down the connection, the server-side wrapper and the fenced shell, but not the
    // Compose child that shell started: kill exactly those. Only the process group still names
    // the survivor; the fenced shell's own process ID is gone.
    const shellPid = Number(readFileSync(pidFile, "utf8"));
    spawnSync("pkill", ["-9", "-f", `sh -s -- .*${box.nasDeploy}`]);
    process.kill(shellPid, "SIGKILL");
    expect(await closed).not.toBe(0);
    await new Promise((ok) => setTimeout(ok, 6000));
    expect(out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    // The child finished starting b before the rollback went on, and the rollback then stopped it.
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    expect(isStaged(b)).toBe(false);
    expect(stateValue("last_passed")).toBe(a);
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
  }, 90_000);

  it("fences the recording of the pass: a client lost around it cannot publish a rolled-back revision (MEDIUM)", async () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    rmSync(fakeState("record-ssh.pid"), { force: true });
    const child = spawn(
      "bash",
      [join(scriptsIn(box), "fleet-stage.sh"), b, "--release", release(b)],
      {
        cwd: box.repo,
        // The rename that publishes the pass takes 3 s on the server.
        env: { ...process.env, ...stageEnv({ FAKE_MV_SLEEP: "3" }) },
      },
    );
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (out += d.toString()));
    const closed = new Promise<number | null>((ok) => child.on("close", ok));
    for (let i = 0; i < 300 && !existsSync(fakeState("record-ssh.pid")); i += 1) {
      await new Promise((ok) => setTimeout(ok, 100));
    }
    expect(existsSync(fakeState("record-ssh.pid"))).toBe(true);
    // The connection is lost while the record step is mid-rename on the server.
    process.kill(Number(readFileSync(fakeState("record-ssh.pid"), "utf8")), "SIGKILL");
    expect(await closed).not.toBe(0);
    await new Promise((ok) => setTimeout(ok, 5000));
    // Whatever order things ran in, the end state is the rolled-back one, never b promotable.
    expect(out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    expect(isStaged(b)).toBe(false);
    expect(stateValue("last_passed")).toBe(a);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
  }, 120_000);

  it("runs the server-side scripts under dash when there is one, so a dash-only syntax error cannot come back (MEDIUM)", () => {
    prepare();
    const [a] = box.revs as [string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    if (existsSync("/bin/dash")) {
      expect(readFileSync(fakeState("remote-sh"), "utf8")).toContain("dash");
    }
  });

  it("fails and rolls back when writing stage-state fails: no PASS after an unchecked write (MEDIUM)", () => {
    prepare();
    const [a, b] = box.revs as [string, string];
    expect(stage([a, "--release", release(a)]).status).toBe(0);
    // The disk refuses the write that would mark b as staged. The body runs with -e, so the failed
    // write ends it, and nothing reports a pass.
    const r = stage([b, "--release", release(b)], { FAKE_MV_FAIL_RECORD: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL could not record the pass");
    expect(r.out).not.toContain(`PASS ${b.slice(0, 7)} is staged`);
    expect(r.out).not.toContain("PASS recorded");
    expect(r.out).toContain(`PASS the test copy is back on ${a.slice(0, 7)} and stopped`);
    expect(isStaged(b)).toBe(false);
    expect(stateValue("last_passed")).toBe(a);
    expect(readFileSync(join(box.nasDeploy, "fleet-staging.env"), "utf8")).toContain(
      `FLEET_REVISION=${a}`,
    );
    expect(existsSync(fakeState("fleet-runner-staging.pid"))).toBe(false);
    expect(existsSync(join(box.nasDeploy, ".stage-lock"))).toBe(false);
  });

  it("refuses a resolved config that publishes any extra port (low)", () => {
    prepare();
    const [a] = box.revs as [string];
    const r = stage([a, "--release", release(a)], {
      FAKE_CONFIG_EXTRA_PORT: "1",
      FLEET_READY_TRIES: "2",
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      "FAIL the resolved compose config is not the test copy own folders, port and name",
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
