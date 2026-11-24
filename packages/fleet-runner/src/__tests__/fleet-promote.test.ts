import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Slice 4 of the release pipeline: the promote script's refusals, without a server or Docker. The
// real scripts run from a sandbox git repo; `ssh` runs the "server" side locally in a sandbox
// folder; `docker` only records that it was called, so a refusal that reached it would show. Every
// refusal must leave production exactly as it was: no engine call, no spent approval, no lock left.
// The switch, health check and undo are proven against a throwaway production on the server (PR).
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface Box {
  root: string;
  repo: string;
  bin: string;
  conf: string;
  stageDeploy: string;
  prodDeploy: string;
  revs: string[];
}
let box: Box;

function run(cwd: string, command: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const FAKE_SSH = `#!/bin/bash
# Run the remote command locally, in the sandbox "server", and note that the server was reached.
while [ "$1" = -o ]; do shift 2; done
shift
echo call >> "$FAKE_STATE/ssh.log"
sh -c "$1"
`;
const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$FAKE_STATE/docker.log"
exit 1
`;

// The approval's record: the same words with other case or spacing are the same yes.
const approvalSha = (text: string) =>
  createHash("sha256").update(text.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");

function promote(args: string[], env: Record<string, string> = {}) {
  return run(
    box.repo,
    "bash",
    [join(box.repo, "packages/fleet-runner/scripts/fleet-promote.sh"), ...args],
    {
      PATH: `${box.bin}:${process.env.PATH ?? ""}`,
      FLEET_STAGE_CONF: box.conf,
      FAKE_STATE: join(box.root, "fake"),
      FLEET_PROMOTE_FAULT: "",
      ...env,
    },
  );
}
const fake = (name: string) => join(box.root, "fake", name);
const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const setStaged = (rev: string) =>
  writeFileSync(join(box.stageDeploy, "stage-state"), `last_passed=${rev}\nstaged_ok=${rev}\n`);

// Nothing of production changed: the engine was never called, no approval was spent, no lock left.
function expectUntouched() {
  expect(read(fake("docker.log"))).toBe("");
  expect(read(join(box.prodDeploy, "promote.log"))).not.toContain(" started ");
  expect(existsSync(join(box.prodDeploy, ".promote-lock"))).toBe(false);
}

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "fleet-promote-box-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const stageKeys = join(root, "stage-keys");
  const prodKeys = join(root, "prod-keys");
  const nas = join(root, "nas");
  const stageDeploy = join(nas, "stage-deploy");
  const prodDeploy = join(nas, "prod-deploy");
  const prodRoot = join(nas, "prod-root");
  for (const d of [
    bin,
    stageKeys,
    prodKeys,
    join(root, "fake"),
    stageDeploy,
    join(nas, "stage-root"),
  ]) {
    mkdirSync(d, { recursive: true });
  }
  for (const d of ["state", "output", "inputs", "public-keys", "tls"])
    mkdirSync(join(prodRoot, d), { recursive: true });
  chmodSync(stageKeys, 0o700);
  chmodSync(prodKeys, 0o700);
  writeFileSync(join(prodKeys, "observer.token"), "not a real key\n");
  writeFileSync(join(prodKeys, "ca.crt"), "not a real certificate\n");
  const target = join(repo, "packages/fleet-runner");
  mkdirSync(target, { recursive: true });
  cpSync(join(pkg, "scripts"), join(target, "scripts"), { recursive: true });
  cpSync(join(pkg, "deploy"), join(target, "deploy"), { recursive: true });
  const git = (...a: string[]) => {
    const r = run(repo, "git", a, {
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
  writeFileSync(join(repo, "second.txt"), "second");
  git("add", "-A");
  git("commit", "-q", "-m", "second");
  revs.push(git("rev-parse", "HEAD"));
  writeFileSync(join(bin, "ssh"), FAKE_SSH);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  chmodSync(join(bin, "ssh"), 0o755);
  chmodSync(join(bin, "docker"), 0o755);
  const conf = join(root, "stage.conf");
  writeFileSync(
    conf,
    [
      "NAS_SSH=fake-server",
      `NAS_STAGE_DIR=${stageDeploy}`,
      `NAS_STAGE_ROOT=${join(nas, "stage-root")}`,
      "STAGE_LAN_IP=127.0.0.1",
      "STAGE_PORT=18789",
      "STAGE_HOST=localhost",
      `STAGE_KEYS_DIR=${stageKeys}`,
      "PROD_PORT=18788",
      "PROD_CONTAINER=fleet-hand-started",
      `NAS_PROD_DIR=${prodDeploy}`,
      `NAS_PROD_ROOT=${prodRoot}`,
      `PROD_KEYS_DIR=${prodKeys}`,
      "",
    ].join("\n"),
  );
  chmodSync(conf, 0o600);
  box = { root, repo, bin, conf, stageDeploy, prodDeploy, revs };
  setStaged(revs[1]);
});

afterEach(() => {
  rmSync(box.root, { recursive: true, force: true });
});

describe("fleet-promote.sh refuses", () => {
  it("without the owner's approval, before reaching the server", () => {
    for (const args of [
      [box.revs[1]],
      [box.revs[1], "--owner-approved", ""],
      [box.revs[1], "--owner-approved", "  "],
    ]) {
      const r = promote(args);
      expect(r.status, args.join(" ")).toBe(3);
      expect(r.out).toContain("REFUSED promote changes production and needs the owner's yes");
    }
    expect(read(fake("ssh.log"))).toBe("");
    expectUntouched();
  });

  it("an approval that does not name the revision, before reaching the server", () => {
    const rev = box.revs[1];
    for (const approval of [
      "yes, ship it",
      `yes ${rev.slice(0, 6)}`,
      `yes, promote ${box.revs[0].slice(0, 12)}`,
    ]) {
      const r = promote([rev, "--owner-approved", approval]);
      expect(r.status, approval).toBe(1);
      expect(r.out).toContain(
        `the owner's approval must name the revision it approves (${rev.slice(0, 7)})`,
      );
    }
    expect(read(fake("ssh.log"))).toBe("");
    expectUntouched();
  });

  it("an approval of more than one line", () => {
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}\nand also something else`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("--owner-approved must be one line");
    expectUntouched();
  });

  it("a revision that is not the one staged, or when nothing is staged", () => {
    const [other, rev] = box.revs;
    setStaged(other);
    let r = promote([rev, "--owner-approved", `Yes, put ${rev.slice(0, 7)} live`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(`${rev.slice(0, 7)} is not staged`);
    writeFileSync(join(box.stageDeploy, "stage-state"), `last_passed=${rev}\nstaged_ok=\n`);
    r = promote([rev, "--owner-approved", `Yes, put ${rev.slice(0, 7)} live`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(`${rev.slice(0, 7)} is not staged`);
    expectUntouched();
    // The refusal did not spend the approval: nothing was written to promote.log.
    expect(read(join(box.prodDeploy, "promote.log"))).toBe("");
  });

  it("an approval that was already used, also with other case or spacing", () => {
    const rev = box.revs[1];
    const yes = `Yes, put ${rev.slice(0, 7)} live`;
    mkdirSync(box.prodDeploy, { recursive: true });
    writeFileSync(join(box.prodDeploy, ".fleet-runner-production"), "");
    writeFileSync(
      join(box.prodDeploy, "promote.log"),
      `20261101T000000Z-1 started fleet-hand-started -> ${rev.slice(0, 7)} approval_sha256=${approvalSha(yes)} approval: ${yes}\n`,
    );
    for (const approval of [yes, `  yes,   PUT ${rev.slice(0, 7)} LIVE `]) {
      const r = promote([rev, "--owner-approved", approval]);
      expect(r.status, approval).toBe(1);
      expect(r.out).toContain(
        "this approval was already used (promote.log): each yes covers one promotion",
      );
    }
    expect(read(fake("docker.log"))).toBe("");
    expect(existsSync(join(box.prodDeploy, ".promote-lock"))).toBe(false);
    expect(read(join(box.prodDeploy, "promote.log")).split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("to sign as production's owner", () => {
    const rev = box.revs[1];
    writeFileSync(box.conf, `${read(box.conf)}PROD_STATUS_ID=owner\n`);
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("the promote never signs as production's owner");
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("a forced health failure against anything but a rehearsal production", () => {
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}`], {
      FLEET_PROMOTE_FAULT: "health",
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FLEET_PROMOTE_FAULT is only for a rehearsal production");
    expectUntouched();
  });

  it("when another promote holds the lock", () => {
    const rev = box.revs[1];
    mkdirSync(join(box.prodDeploy, ".promote-lock"), { recursive: true });
    writeFileSync(join(box.prodDeploy, ".fleet-runner-production"), "");
    writeFileSync(join(box.prodDeploy, ".promote-lock/owner"), "someone-else\n");
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("another promote run holds the lock (someone-else)");
    expect(read(join(box.prodDeploy, ".promote-lock/owner"))).toBe("someone-else\n");
    expect(read(fake("docker.log"))).toBe("");
  });

  it("a production deploy folder that is not production's own", () => {
    const rev = box.revs[1];
    mkdirSync(box.prodDeploy, { recursive: true });
    writeFileSync(join(box.prodDeploy, "something.txt"), "not ours");
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("already holds files and is not marked as production deploy folder");
    expectUntouched();
  });
});

describe("the server-side runner", () => {
  // HelpDesk's first promote failed (safely) because a command in a remote script read the rest of
  // the script from ssh's stdin. Every remote script is read whole before it runs.
  it("cannot be swallowed by a command that reads stdin", () => {
    const lib = join(box.repo, "packages/fleet-runner/scripts/lib/fleet-stage-lib.sh");
    const r = run(
      box.repo,
      "bash",
      [
        "-c",
        `. "${lib}"; NAS_SSH=fake-server; nas 'cat >/dev/null
echo "still here $1"' one`,
      ],
      {
        PATH: `${box.bin}:${process.env.PATH ?? ""}`,
        FAKE_STATE: join(box.root, "fake"),
      },
    );
    expect(r.status).toBe(0);
    expect(r.out).toContain("still here one");
  });
});

// The promoted revision brings its own compose.production.yaml, so the config Compose resolves from
// it is checked against an exact allowlist before production is touched.
describe("compose-check.mjs", () => {
  const rev = "b".repeat(40);
  const root = "/srv/fleet-prod";
  const good = () => ({
    name: "fleet-prod",
    networks: { default: { name: "fleet-prod_default", ipam: {} } },
    services: {
      "fleet-runner": {
        cap_drop: ["ALL"],
        command: null,
        entrypoint: null,
        environment: {
          FLEET_BUILD_REF: rev,
          FLEET_INPUT_DIR: "/var/lib/fleet-runner/inputs",
          FLEET_OBSERVERS: "observer",
          FLEET_TLS_CERT: "/run/fleet-runner/tls/server.crt",
          FLEET_TLS_KEY: "/run/fleet-runner/tls/server.key",
          FLEET_WORKERS: "worker-a,worker-b",
        },
        image: `fleet-runner:${rev}`,
        networks: { default: null },
        platform: "linux/amd64",
        ports: [
          {
            mode: "ingress",
            host_ip: "10.0.0.2",
            target: 8787,
            published: "18788",
            protocol: "tcp",
          },
        ],
        read_only: true,
        restart: "unless-stopped",
        security_opt: ["no-new-privileges:true"],
        stop_grace_period: "30s",
        tmpfs: ["/tmp:size=16m,mode=1777"],
        user: "1000:1000",
        volumes: [
          ["state", "/var/lib/fleet-runner/state", false],
          ["output", "/var/lib/fleet-runner/output", false],
          ["inputs", "/var/lib/fleet-runner/inputs", false],
          ["public-keys", "/run/fleet-runner/public-keys", true],
          ["tls", "/run/fleet-runner/tls", true],
        ].map(([name, target, ro]) => ({
          type: "bind",
          source: `${root}/${name}`,
          target,
          ...(ro ? { read_only: true } : {}),
          bind: {},
        })),
      },
    },
  });
  // A fixture that each case tampers with freely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Cfg = any;
  const check = (cfg: Cfg) => {
    const file = join(box.root, "resolved.json");
    writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
    return run(box.root, "node", [
      join(pkg, "scripts/compose-check.mjs"),
      file,
      "fleet-prod",
      root,
      "10.0.0.2",
      "18788",
      "1000:1000",
      rev,
    ]);
  };
  const svc = (cfg: Cfg) => cfg.services["fleet-runner"];

  it("passes production's own shape", () => {
    const r = check(good());
    expect(r.out).toContain(
      "PASS the resolved compose config is exactly production's allowlisted shape",
    );
    expect(r.status).toBe(0);
  });

  const tampered: [string, (cfg: Cfg) => void, string][] = [
    [
      "privileged",
      (c) => {
        svc(c).privileged = true;
      },
      "has privileged, which is not allowed",
    ],
    [
      "an extra cap_add",
      (c) => {
        svc(c).cap_add = ["SYS_ADMIN"];
      },
      "has cap_add, which is not allowed",
    ],
    [
      "an extra volume",
      (c) => {
        svc(c).volumes.push({ type: "bind", source: "/", target: "/host", bind: {} });
      },
      "volumes is not the required value",
    ],
    [
      "a writable key folder",
      (c) => {
        delete svc(c).volumes[3].read_only;
      },
      "volumes is not the required value",
    ],
    [
      "a device",
      (c) => {
        svc(c).devices = [{ source: "/dev/sda", target: "/dev/sda", permissions: "rwm" }];
      },
      "has devices",
    ],
    [
      "host networking",
      (c) => {
        svc(c).network_mode = "host";
      },
      "has network_mode",
    ],
    [
      "another network",
      (c) => {
        c.networks.outside = { external: true };
      },
      "networks has outside",
    ],
    [
      "a writable root file system",
      (c) => {
        svc(c).read_only = false;
      },
      "read_only is not the required value",
    ],
    [
      "no cap_drop",
      (c) => {
        delete svc(c).cap_drop;
      },
      "has no cap_drop",
    ],
    [
      "no no-new-privileges",
      (c) => {
        svc(c).security_opt = [];
      },
      "security_opt is not the required value",
    ],
    [
      "root",
      (c) => {
        svc(c).user = "0:0";
      },
      "user is not the required value",
    ],
    [
      "a second port",
      (c) => {
        svc(c).ports.push({
          mode: "ingress",
          host_ip: "0.0.0.0",
          target: 22,
          published: "2222",
          protocol: "tcp",
        });
      },
      "ports is not the required value",
    ],
    [
      "another image",
      (c) => {
        svc(c).image = "fleet-runner:latest";
      },
      "image is not the required value",
    ],
    [
      "an extra environment variable",
      (c) => {
        svc(c).environment.NODE_OPTIONS = "--inspect=0.0.0.0";
      },
      "environment has NODE_OPTIONS",
    ],
    [
      "another restart policy",
      (c) => {
        svc(c).restart = "always";
      },
      "restart is not the required value",
    ],
    [
      "a top-level volume",
      (c) => {
        c.volumes = { data: {} };
      },
      "the config has volumes",
    ],
    [
      "a second service",
      (c) => {
        c.services.sidecar = { image: "x" };
      },
      "services has sidecar",
    ],
  ];
  it.each(tampered)("refuses %s", (_name, tamper, message) => {
    const cfg = good();
    tamper(cfg);
    const r = check(cfg);
    expect(r.status).toBe(1);
    expect(r.out).toContain(message);
    expect(r.out).not.toContain("PASS");
    // Only key names are printed, never a value from the environment.
    expect(r.out).not.toContain("worker-a");
  });
});
