import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateToken, signer } from "../auth.js";
import { JobStore } from "../jobs.js";
import type { Claim } from "../jobs.js";
import { fleetServer } from "../server.js";

let dir: string;
let store: JobStore;
let server: Server;
let clock: number;
let base: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "fleet-http-"));
  for (const name of ["owner", "worker", "other"]) generateToken(join(dir, name));
  clock = 1_000;
  store = new JobStore(":memory:", { now: () => clock, leaseMs: 100 });
  server = fleetServer(store, { registry: dir, outDir: dir });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing listener");
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function request(id: string, target: string, data?: unknown) {
  const body = data === undefined ? undefined : JSON.stringify(data);
  const method = body === undefined ? "GET" : "POST";
  const authorization = signer(id, join(dir, id))(method, target, Buffer.from(body ?? ""));
  return fetch(base + target, {
    method,
    ...(body === undefined ? {} : { body }),
    headers: { authorization },
  });
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("missing listener"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

it("requires a registered signature, rejects replay, and reserves admission for owner", async () => {
  expect((await fetch(base + "/report")).status).toBe(401);
  expect((await request("worker", "/enqueue", { kind: "noop", inputs: [] })).status).toBe(403);
  const authorize = signer("owner", join(dir, "owner"));
  const authorization = authorize("GET", "/report", Buffer.alloc(0));
  expect((await fetch(base + "/events", { headers: { authorization } })).status).toBe(401);
  expect((await fetch(base + "/report", { headers: { authorization } })).status).toBe(200);
  expect((await fetch(base + "/report", { headers: { authorization } })).status).toBe(401);
});

it("rejects a previously accepted signature after the server and store restart", async () => {
  // Transpile the tested source (including a proof mutant), not a potentially stale dist tree.
  for (const name of ["auth", "jobs", "inputs", "status", "status-server", "server"]) {
    const source = readFileSync(fileURLToPath(new URL(`../${name}.ts`, import.meta.url)), "utf8");
    writeFileSync(
      join(dir, `${name}.js`),
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    );
  }
  writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
  const entry = join(dir, "process-proof.mjs");
  writeFileSync(
    entry,
    `
    import { JobStore } from "./jobs.js";
    import { fleetServer } from "./server.js";
    import { dirname, join } from "node:path";
    const dir = dirname(process.argv[1]);
    const store = new JobStore(join(dir, "process-replay.sqlite"));
    const server = fleetServer(store, { registry: dir, outDir: join(dir, "process-output") });
    server.listen(0, "127.0.0.1", () => console.log(server.address().port));
    process.once("SIGTERM", () => server.close(() => store.close()));
  `,
  );
  const launch = async () => {
    const child = spawn(process.execPath, [entry], { stdio: ["ignore", "pipe", "ignore"] });
    const lines = createInterface({ input: child.stdout! });
    const [line] = await once(lines, "line");
    lines.close();
    return { child, endpoint: `http://127.0.0.1:${Number(line)}` };
  };
  const authorization = signer("owner", join(dir, "owner"))("GET", "/report", Buffer.alloc(0));
  const first = await launch();
  try {
    expect((await fetch(first.endpoint + "/report", { headers: { authorization } })).status).toBe(
      200,
    );
  } finally {
    first.child.kill("SIGTERM");
    await once(first.child, "exit");
  }
  const second = await launch();
  try {
    expect((await fetch(second.endpoint + "/report", { headers: { authorization } })).status).toBe(
      401,
    );
    const fresh = signer("owner", join(dir, "owner"))("GET", "/report", Buffer.alloc(0));
    expect(
      (await fetch(second.endpoint + "/report", { headers: { authorization: fresh } })).status,
    ).toBe(200);
  } finally {
    second.child.kill("SIGTERM");
    await once(second.child, "exit");
  }
}, 15_000);

it("serializes one signed nonce across server instances sharing the store", async () => {
  await close(server);
  store.close();

  const database = join(dir, "shared-replay.sqlite");
  store = new JobStore(database, { now: () => clock, leaseMs: 100 });
  server = fleetServer(store, { registry: dir, outDir: dir });
  base = await listen(server);

  const secondStore = new JobStore(database, { now: () => clock, leaseMs: 100 });
  const secondServer = fleetServer(secondStore, { registry: dir, outDir: dir });
  try {
    const secondBase = await listen(secondServer);
    const authorization = signer("owner", join(dir, "owner"))("GET", "/report", Buffer.alloc(0));
    const responses = await Promise.all([
      fetch(base + "/report", { headers: { authorization } }),
      fetch(secondBase + "/report", { headers: { authorization } }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  } finally {
    await close(secondServer);
    secondStore.close();
  }
});

it("does not consume a nonce when its signature is invalid", async () => {
  const authorization = signer("owner", join(dir, "owner"))("GET", "/report", Buffer.alloc(0));
  const signatureStart = authorization.lastIndexOf(".") + 1;
  const replacement = authorization.charAt(signatureStart) === "A" ? "B" : "A";
  const invalidAuthorization =
    authorization.slice(0, signatureStart) + replacement + authorization.slice(signatureStart + 1);

  expect(
    (await fetch(base + "/report", { headers: { authorization: invalidAuthorization } })).status,
  ).toBe(401);
  expect((await fetch(base + "/report", { headers: { authorization } })).status).toBe(200);
});

it("fences uploads, validates the digest, and records an immutable accepted file", async () => {
  const spec = { kind: "noop", inputs: ["synthetic"], requires: ["test"] };
  expect((await request("owner", "/enqueue", { ...spec, payload: "unexpected" })).status).toBe(400);
  const admitted = (await (await request("owner", "/enqueue", spec)).json()) as { key: string };
  const claim = (id: string) =>
    request(id, "/claim", { caps: ["test"], kinds: ["noop"] }).then((res) =>
      res.json(),
    ) as Promise<Claim>;
  const first = await claim("worker");
  expect(await (await request("other", "/heartbeat", first)).json()).toBe(false);
  expect(await (await request("worker", "/heartbeat", first)).json()).toBe(true);
  expect(await (await request("worker", "/release", first)).json()).toBe(true);
  const second = await claim("worker");
  clock += 101;
  const third = await claim("other");
  const output = Buffer.from("synthetic result");
  const sha256 = createHash("sha256").update(output).digest("hex");
  const upload = { output: output.toString("base64"), sha256 };
  expect(await (await request("worker", "/complete", { ...second, ...upload })).json()).toBe(false);
  expect(await (await request("worker", "/complete", { ...third, ...upload })).json()).toBe(false);
  expect(
    (await request("other", "/complete", { ...third, ...upload, sha256: "0".repeat(64) })).status,
  ).toBe(400);
  expect(await (await request("other", "/complete", { ...third, ...upload })).json()).toBe(true);
  expect(await (await request("other", "/complete", { ...third, ...upload })).json()).toBe(true);
  const file = join(dir, `${admitted.key}.${third.fence}.jsonl`);
  expect(readFileSync(file)).toEqual(output);
  const report = () => request("owner", `/report?verify=${admitted.key}`).then((res) => res.json());
  expect(await report()).toMatchObject({
    verified: true,
    period: { byWorker: { other: { completed: 1 } } },
  });
  const events = (await (await request("owner", "/events?after=1")).json()) as {
    seq: number;
    type: string;
  }[];
  expect(events[0]?.seq).toBe(2);
  expect(events.filter(({ type }) => type === "completed")).toHaveLength(1);
  writeFileSync(file, "changed");
  expect(await report()).toMatchObject({ verified: false });
});
