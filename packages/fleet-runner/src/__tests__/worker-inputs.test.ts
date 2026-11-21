import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateToken } from "../auth.js";
import { fleetClient, FleetHttpError } from "../client.js";
import { runDeclaredWorker, stageInputs } from "../declared-worker.js";
import { JobStore } from "../jobs.js";
import { fleetServer } from "../server.js";
import { parseWorkerSettings } from "../worker-settings.js";

const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const INPUT = Buffer.from("synthetic input for a mac worker\n");

// Stands in for an installed handler: reads staged inputs by hash, uppercases them.
const HANDLER = `
const { readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
let raw = "";
process.stdin.on("data", (c) => (raw += c)).on("end", () => {
  const { job, outDir, inputDir } = JSON.parse(raw);
  const out = job.inputs.map((h) => readFileSync(inputDir + "/" + h, "utf8").toUpperCase()).join("");
  const file = job.key + "." + job.fence + ".jsonl";
  writeFileSync(outDir + "/" + file, out);
  process.stdout.write(JSON.stringify({ file, sha256: createHash("sha256").update(out).digest("hex") }));
});
`;

let dir: string;
let store: JobStore;
let server: Server;
let proxy: Server | undefined;
let endpoint: string;
let serviceEndpoint: string;
let controller: AbortController;
let corruptNext = 0;

const listen = (s: Server) =>
  new Promise<string>((ok, fail) => {
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      if (!address || typeof address === "string") return fail(Error("no listener"));
      ok(`http://127.0.0.1:${address.port}`);
    });
  });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "worker-inputs-"));
  for (const id of ["owner", "worker", "other"]) generateToken(join(dir, id));
  store = new JobStore(join(dir, "jobs.sqlite"));
  server = fleetServer(store, {
    registry: dir,
    outDir: join(dir, "accepted"),
    inputDir: join(dir, "service-inputs"),
    workers: ["worker", "other"],
  });
  serviceEndpoint = await listen(server);
  // A pass-through that can damage the next input responses, like a flaky link.
  proxy = createServer((req, res) => {
    const upstream = request(
      new URL(req.url ?? "/", serviceEndpoint),
      { method: req.method, headers: req.headers },
      (answer) => {
        const parts: Buffer[] = [];
        answer.on("data", (c: Buffer) => parts.push(c));
        answer.on("end", () => {
          const body = Buffer.concat(parts);
          if (
            corruptNext > 0 &&
            req.url?.startsWith("/inputs/") &&
            req.method === "GET" &&
            body.length
          ) {
            corruptNext -= 1;
            body[0] = body[0]! ^ 0xff;
          }
          res.writeHead(answer.statusCode ?? 502, answer.headers);
          res.end(body);
        });
      },
    );
    req.pipe(upstream);
  });
  endpoint = await listen(proxy);
  controller = new AbortController();
  corruptNext = 0;
});

afterEach(async () => {
  controller.abort();
  await new Promise<void>((ok) => proxy!.close(() => ok()));
  await new Promise<void>((ok) => server.close(() => ok()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function handlerFile() {
  const file = join(dir, "handler.cjs");
  writeFileSync(file, HANDLER, { mode: 0o500 });
  return file;
}

function settings(pins = true, handler = handlerFile()) {
  return parseWorkerSettings({
    schemaVersion: 1,
    endpoint,
    worker: "worker",
    tokenFile: join(dir, "worker"),
    outDir: join(dir, "attempts"),
    inputDir: join(dir, "staged"),
    statusFile: join(dir, "status.json"),
    pollMs: 40,
    kinds: {
      shout: {
        capabilities: [],
        command: [process.execPath, handler],
        pins: pins ? [{ path: handler, sha256: sha(readFileSync(handler)) }] : [],
      },
    },
  });
}

const owner = () => fleetClient(endpoint, "owner", join(dir, "owner"));
const admit = async () => {
  const hash = await owner().uploadInput(INPUT);
  const { key } = await owner().enqueue({ kind: "shout", inputs: [hash], payload: null });
  return { hash, key };
};
const waitFor = async (ready: () => boolean) => {
  const end = Date.now() + 8_000;
  while (!ready()) {
    if (Date.now() >= end) throw Error("condition did not become true");
    await delay(25);
  }
};
const start = (s = settings()) => runDeclaredWorker(s, controller.signal);

it("runs a NAS-admitted job with no manual staging and submits hash-checked bytes", async () => {
  const { hash, key } = await admit();
  expect(existsSync(join(dir, "staged"))).toBe(false); // nothing was copied by hand
  const done = start();
  await waitFor(() => store.get(key)?.status === "done");
  controller.abort();
  await done;
  const expected = INPUT.toString().toUpperCase();
  const row = store.get(key)!;
  expect(row.output).toBe(sha(expected));
  expect(readFileSync(join(dir, "accepted", row.outputFile!), "utf8")).toBe(expected);
  expect(sha(readFileSync(join(dir, "staged", hash)))).toBe(hash);
  expect(
    store
      .events(0)
      .filter((e) => e.key === key)
      .map((e) => e.type),
  ).toEqual(["enqueued", "claimed", "completed"]);
});

it("never runs the handler on a corrupted download and succeeds on a clean retry", async () => {
  const { hash, key } = await admit();
  corruptNext = 1;
  const done = start();
  await waitFor(() => store.get(key)?.status === "done");
  controller.abort();
  await done;
  const types = store
    .events(0)
    .filter((e) => e.key === key)
    .map((e) => e.type);
  expect(types).toEqual(["enqueued", "claimed", "retry", "claimed", "completed"]);
  expect(store.get(key)?.output).toBe(sha(INPUT.toString().toUpperCase()));
  expect(sha(readFileSync(join(dir, "staged", hash)))).toBe(hash);
});

it("replaces a damaged cached input instead of trusting it", async () => {
  const { hash, key } = await admit();
  const cached = join(dir, "staged");
  mkdirSync(cached, { recursive: true, mode: 0o700 });
  writeFileSync(join(cached, hash), "damaged");
  const done = start();
  await waitFor(() => store.get(key)?.status === "done");
  controller.abort();
  await done;
  expect(sha(readFileSync(join(cached, hash)))).toBe(hash);
});

it("refuses a blob the held job does not name, another worker's job, and a job not held", async () => {
  const { hash, key } = await admit();
  const stranger = await owner().uploadInput(Buffer.from("not part of any job"));
  const mine = fleetClient(endpoint, "worker", join(dir, "worker"));
  const theirs = fleetClient(endpoint, "other", join(dir, "other"));
  await expect(mine.downloadInput({ key, fence: 1 }, hash)).rejects.toMatchObject({ status: 403 });
  const claim = await mine.claim([], ["shout"]);
  expect(claim?.key).toBe(key);
  await expect(mine.downloadInput(claim!, stranger)).rejects.toMatchObject({ status: 403 });
  await expect(theirs.downloadInput(claim!, hash)).rejects.toMatchObject({ status: 403 });
  expect(await mine.downloadInput(claim!, hash)).toEqual(INPUT);
  // The service reports a refusal as non-retryable, so a worker fails the attempt for good.
  const staged = join(dir, "refused");
  await expect(
    stageInputs(mine, { ...claim!, inputs: [stranger] }, staged, controller.signal),
  ).rejects.toMatchObject({ code: "input-refused", retryable: false });
  expect(existsSync(join(staged, stranger))).toBe(false);
  expect(new FleetHttpError(403).retryable).toBe(false);
});

it("withdraws a handler whose pinned file changed, at start", async () => {
  const { key } = await admit();
  const handler = handlerFile();
  const s = settings(true, handler);
  chmodSync(handler, 0o700);
  writeFileSync(handler, `${HANDLER}// tampered\n`);
  const done = start(s);
  await delay(300);
  expect(store.get(key)?.status).toBe("ready"); // never claimed
  controller.abort();
  await done;
  expect(JSON.parse(readFileSync(join(dir, "status.json"), "utf8")).kinds).toEqual([]);
  expect(existsSync(join(dir, "staged"))).toBe(false);
});

it("withdraws a handler changed while running: the claim is retried, nothing is submitted", async () => {
  const handler = handlerFile();
  const done = start(settings(true, handler));
  await waitFor(() => existsSync(join(dir, "status.json"))); // startup pin check has passed
  chmodSync(handler, 0o700);
  writeFileSync(handler, `${HANDLER}// tampered\n`);
  const { key } = await admit();
  await waitFor(() => store.events(0).some((e) => e.key === key && e.type === "retry"));
  await delay(300);
  controller.abort();
  await done;
  const types = store
    .events(0)
    .filter((e) => e.key === key)
    .map((e) => e.type);
  expect(types).toEqual(["enqueued", "claimed", "retry"]); // not claimed again: kind withdrawn
  expect(store.get(key)).toMatchObject({
    status: "ready",
    output: null,
    error: "handler-pin-mismatch",
  });
  expect(existsSync(join(dir, "staged"))).toBe(false);
});

it("validates pin and input directory settings", () => {
  const base = settings();
  const raw = (extra: object) => ({
    schemaVersion: 1,
    endpoint,
    worker: "worker",
    tokenFile: join(dir, "worker"),
    outDir: join(dir, "attempts"),
    statusFile: join(dir, "status.json"),
    kinds: { shout: { capabilities: [], command: [process.execPath], ...extra } },
  });
  expect(base.kinds.shout?.pins).toHaveLength(1);
  expect(() =>
    parseWorkerSettings(raw({ pins: [{ path: "relative", sha256: "a".repeat(64) }] })),
  ).toThrow();
  expect(() => parseWorkerSettings(raw({ pins: [{ path: "/x", sha256: "nope" }] }))).toThrow(
    "invalid-handler-pin",
  );
  expect(() => parseWorkerSettings({ ...raw({}), inputDir: "relative" })).toThrow();
  expect(parseWorkerSettings(raw({})).inputDir).toBeUndefined();
});
