import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, signer } from "../auth.js";
import { fleetClient } from "../client.js";
import { JobStore, writeOutput } from "../jobs.js";
import type { Claim } from "../jobs.js";
import { fleetServer } from "../server.js";
import { workOnce } from "../worker.js";

const MAX_BODY = 16 * 1024 * 1024;
let dir: string;
let dbPath: string;
let outDir: string;
let store: JobStore;
let server: Server;
let clock: number;
let endpoint: string;

function openServer() {
  server = fleetServer(store, { registry: dir, outDir });
}

async function listen() {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test listener");
  endpoint = `http://127.0.0.1:${address.port}`;
}

async function closeServer() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function rawRequest(id: string, target: string, bytes: Buffer) {
  const method = "POST";
  const authorization = signer(id, join(dir, id))(method, target, bytes);
  return fetch(endpoint + target, {
    method,
    body: new Uint8Array(bytes),
    headers: { authorization, "content-type": "application/json" },
  });
}

function oversizedRequest(id: string, target: string, declaredBytes: Buffer): Promise<number> {
  const authorization = signer(id, join(dir, id))("POST", target, declaredBytes);
  return new Promise((resolve, reject) => {
    const request = httpRequest(endpoint + target, {
      method: "POST",
      headers: {
        authorization,
        "content-length": String(declaredBytes.length),
        "content-type": "application/json",
      },
    });
    request.once("response", (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    request.once("error", reject);
    // The server rejects from Content-Length before reading a body; sending 16 MiB is unnecessary.
    request.end();
  });
}

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "fleet-fault-contract-"));
  for (const id of ["owner", "worker-a", "worker-b"]) generateToken(join(dir, id));
  dbPath = join(dir, "jobs.sqlite");
  outDir = join(dir, "accepted");
  clock = 10_000;
  store = new JobStore(dbPath, { now: () => clock, leaseMs: 100 });
  openServer();
  await listen();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await closeServer();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("public signed fault contracts", () => {
  it("retries a completion after its response is lost following commit", async () => {
    const owner = fleetClient(endpoint, "owner", join(dir, "owner"));
    const worker = fleetClient(endpoint, "worker-a", join(dir, "worker-a"));
    const { key } = await owner.enqueue({ kind: "noop", inputs: ["synthetic"], payload: null });
    const bytes = Buffer.from("committed once, acknowledged on retry\n");
    let completeRequests = 0;
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await realFetch(input, init);
      if (new URL(String(input)).pathname === "/complete" && completeRequests++ === 0) {
        await response.arrayBuffer();
        throw new Error("simulated response lost after server commit");
      }
      return response;
    });

    await expect(
      workOnce(worker, {
        caps: [],
        outDir: join(dir, "attempts"),
        handlers: {
          noop: async (claim: Claim, context: { outDir: string }) =>
            writeOutput(context.outDir, claim, bytes),
        },
      }),
    ).resolves.toBe("completed");

    const events = await owner.events();
    expect(completeRequests).toBe(2);
    expect(events.filter(({ type }) => type === "completed")).toHaveLength(1);
    expect(await owner.verify(key)).toMatchObject({ verified: true });
    const row = store.get(key);
    expect(row).toMatchObject({ status: "done", output: sha(bytes) });
    expect(row?.outputFile).toBe(`${key}.1.jsonl`);
    if (!row?.outputFile) throw new Error("accepted output file is missing");
    expect(readFileSync(join(outDir, row.outputFile))).toEqual(bytes);
  });

  it("serializes two concurrent signed claims for one queued job", async () => {
    const owner = fleetClient(endpoint, "owner", join(dir, "owner"));
    const workerA = fleetClient(endpoint, "worker-a", join(dir, "worker-a"));
    const workerB = fleetClient(endpoint, "worker-b", join(dir, "worker-b"));
    await owner.enqueue({ kind: "noop", inputs: ["race"], payload: null });

    const claims = await Promise.all([workerA.claim([], ["noop"]), workerB.claim([], ["noop"])]);
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(claims.filter((claim) => claim === null)).toHaveLength(1);
    expect((await owner.events()).filter(({ type }) => type === "claimed")).toHaveLength(1);
  });

  it("reopens safely after an artifact write rolls back before the job commit", async () => {
    const owner = fleetClient(endpoint, "owner", join(dir, "owner"));
    const worker = fleetClient(endpoint, "worker-a", join(dir, "worker-a"));
    const { key } = await owner.enqueue({ kind: "noop", inputs: ["crash-window"], payload: null });
    const first = await worker.claim([], ["noop"]);
    if (!first) throw new Error("expected initial claim");
    const bytes = Buffer.from("written before simulated process crash\n");

    expect(() =>
      store.complete(key, first.fence, "worker-a", () => {
        writeOutput(outDir, first, bytes);
        throw new Error("simulated crash before database commit");
      }),
    ).toThrow("simulated crash before database commit");
    expect(store.get(key)).toMatchObject({
      status: "claimed",
      fence: first.fence,
      output: null,
      outputFile: null,
    });
    expect(readdirSync(outDir)).toEqual([`${key}.${first.fence}.jsonl`]);

    await closeServer();
    store.close();
    store = new JobStore(dbPath, { now: () => clock, leaseMs: 100 });
    openServer();
    await listen();
    const reopenedOwner = fleetClient(endpoint, "owner", join(dir, "owner"));
    const reopenedWorker = fleetClient(endpoint, "worker-a", join(dir, "worker-a"));
    expect(store.get(key)).toMatchObject({
      status: "claimed",
      fence: first.fence,
      output: null,
      outputFile: null,
    });
    expect(await reopenedOwner.verify(key)).toMatchObject({ verified: false });

    clock += 101; // The previous process stopped renewing the lease while the job was reopened.
    const second = await reopenedWorker.claim([], ["noop"]);
    if (!second) throw new Error("expected claim after reopen");
    expect(second.fence).toBe(first.fence + 1);
    expect(await reopenedWorker.complete(second, bytes, sha(bytes))).toBe(true);
    const accepted = store.get(key);
    expect(accepted).toMatchObject({
      status: "done",
      fence: second.fence,
      output: sha(bytes),
      outputFile: `${key}.${second.fence}.jsonl`,
    });
    if (!accepted?.outputFile) throw new Error("accepted output file is missing after reopen");
    expect(readFileSync(join(outDir, accepted.outputFile))).toEqual(bytes);
    expect(existsSync(join(outDir, `${key}.${first.fence}.jsonl`))).toBe(true); // Unreferenced orphan, never a dangling accepted output.
    expect(await reopenedOwner.verify(key)).toMatchObject({ verified: true });
  });

  it("rejects malformed and oversized signed bodies", async () => {
    const malformed = await rawRequest("worker-a", "/claim", Buffer.from("{"));
    expect(malformed.status).toBe(400);

    const oversized = await oversizedRequest(
      "worker-a",
      "/claim",
      Buffer.alloc(MAX_BODY + 1, 0x20),
    );
    expect(oversized).toBe(413);
  });
});
