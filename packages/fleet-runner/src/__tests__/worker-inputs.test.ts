import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateToken } from "../auth.js";
import { fleetClient, FleetHttpError } from "../client.js";
import { pinsHold, runDeclaredWorker, stageInputs, verifyJobInputs } from "../declared-worker.js";
import { readInput } from "../inputs.js";
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
let inputDelayMs = 0;
// The installed command is a program plus a script; both are pinned.
const NODE_PIN = { path: process.execPath, sha256: sha(readFileSync(process.execPath)) };

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
          const send = () => {
            res.writeHead(answer.statusCode ?? 502, answer.headers);
            res.end(body);
          };
          if (inputDelayMs > 0 && req.url?.startsWith("/inputs/") && req.method === "GET")
            setTimeout(send, inputDelayMs);
          else send();
        });
      },
    );
    req.pipe(upstream);
  });
  endpoint = await listen(proxy);
  controller = new AbortController();
  corruptNext = 0;
  inputDelayMs = 0;
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
    pollMs: 10,
    kinds: {
      shout: {
        capabilities: [],
        command: [process.execPath, handler],
        pins: pins ? [{ path: handler, sha256: sha(readFileSync(handler)) }, NODE_PIN] : [],
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
    await delay(10);
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
  expect(sha(readFileSync(join(dir, "staged", "blobs", hash)))).toBe(hash);
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
  expect(sha(readFileSync(join(dir, "staged", "blobs", hash)))).toBe(hash);
});

it("replaces a damaged cached input instead of trusting it", async () => {
  const { hash, key } = await admit();
  const cached = join(dir, "staged", "blobs");
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
  expect(existsSync(join(staged, "blobs", stranger))).toBe(false);
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
  expect(readdirSync(join(dir, "staged", "jobs"))).toEqual([]); // nothing left behind
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
  expect(base.kinds.shout?.pins).toHaveLength(2);
  expect(() =>
    parseWorkerSettings(raw({ pins: [{ path: "relative", sha256: "a".repeat(64) }] })),
  ).toThrow();
  expect(() => parseWorkerSettings(raw({ pins: [{ path: "/x", sha256: "nope" }] }))).toThrow(
    "invalid-handler-pin",
  );
  expect(() => parseWorkerSettings({ ...raw({}), inputDir: "relative" })).toThrow();
  expect(parseWorkerSettings(raw({})).inputDir).toBeUndefined();
});

const handlerPin = (file: string) => ({ path: file, sha256: sha(readFileSync(file)) });

it("checks the pin last: a handler swapped while inputs download never runs", async () => {
  inputDelayMs = 600;
  const { key } = await admit();
  const handler = handlerFile();
  const done = start(settings(true, handler));
  await waitFor(() => store.events(0).some((e) => e.key === key && e.type === "claimed"));
  chmodSync(handler, 0o700);
  writeFileSync(handler, `${HANDLER}// swapped during the download\n`);
  chmodSync(handler, 0o500);
  await waitFor(() => store.events(0).some((e) => e.key === key && e.type === "retry"));
  controller.abort();
  await done;
  expect(store.get(key)).toMatchObject({
    status: "ready",
    output: null,
    error: "handler-pin-mismatch",
  });
  expect(store.events(0).some((e) => e.key === key && e.type === "completed")).toBe(false);
  expect(readdirSync(join(dir, "staged", "jobs"))).toEqual([]);
});

it("treats a pinned file that others can write, or a link, as changed", async () => {
  const file = handlerFile();
  const pin = handlerPin(file);
  expect(await pinsHold([pin])).toBe(true);
  chmodSync(file, 0o770);
  expect(await pinsHold([pin])).toBe(false);
  chmodSync(file, 0o500);
  expect(await pinsHold([pin])).toBe(true);
  const link = join(dir, "link.cjs");
  symlinkSync(file, link);
  expect(await pinsHold([{ path: link, sha256: pin.sha256 }])).toBe(false);
});

it("refuses pins that leave part of the command unpinned", () => {
  const handler = handlerFile();
  const parse = (pins: object[]) =>
    parseWorkerSettings({
      schemaVersion: 1,
      endpoint,
      worker: "worker",
      tokenFile: join(dir, "worker"),
      outDir: join(dir, "attempts"),
      statusFile: join(dir, "status.json"),
      kinds: {
        shout: { capabilities: [], command: [process.execPath, handler, "label"], pins },
      },
    });
  expect(() => parse([handlerPin(handler)])).toThrow("pins-must-cover-command"); // not the program
  expect(() => parse([NODE_PIN])).toThrow("pins-must-cover-command"); // not the script
  expect(() => parse([handlerPin(handler), NODE_PIN])).not.toThrow();
});

it("replaces a symlink in the input cache and never reads through it", async () => {
  const { hash, key } = await admit();
  const decoy = join(dir, "decoy");
  writeFileSync(decoy, INPUT); // the right bytes, but reached through a link
  const blobs = join(dir, "staged", "blobs");
  mkdirSync(blobs, { recursive: true, mode: 0o700 });
  symlinkSync(decoy, join(blobs, hash));
  expect(() => readInput(blobs, hash)).toThrow("invalid-input");
  const done = start();
  await waitFor(() => store.get(key)?.status === "done");
  controller.abort();
  await done;
  expect(lstatSync(join(blobs, hash)).isSymbolicLink()).toBe(false);
  expect(lstatSync(join(blobs, hash)).isFile()).toBe(true);
  expect(readFileSync(decoy)).toEqual(INPUT);
});

it("notices a staged input swapped for a link or other bytes before the handler starts", async () => {
  const { hash, key } = await admit();
  const mine = fleetClient(endpoint, "worker", join(dir, "worker"));
  const claim = await mine.claim([], ["shout"]);
  expect(claim?.key).toBe(key);
  const jobDir = await stageInputs(mine, claim!, join(dir, "swap"), controller.signal);
  expect(() => verifyJobInputs(jobDir, [hash])).not.toThrow();
  const decoy = join(dir, "decoy");
  writeFileSync(decoy, INPUT);
  rmSync(join(jobDir, hash));
  symlinkSync(decoy, join(jobDir, hash));
  expect(() => verifyJobInputs(jobDir, [hash])).toThrow(
    expect.objectContaining({ code: "input-unavailable" }),
  );
  rmSync(join(jobDir, hash));
  writeFileSync(join(jobDir, hash), "other bytes");
  expect(() => verifyJobInputs(jobDir, [hash])).toThrow(
    expect.objectContaining({ code: "input-unavailable" }),
  );
});

it("refuses an input folder that is a link or that others can write", async () => {
  const { key } = await admit();
  const mine = fleetClient(endpoint, "worker", join(dir, "worker"));
  const claim = await mine.claim([], ["shout"]);
  expect(claim?.key).toBe(key);
  const real = join(dir, "real");
  mkdirSync(real, { mode: 0o700 });
  symlinkSync(real, join(dir, "linked"));
  await expect(
    stageInputs(mine, claim!, join(dir, "linked"), controller.signal),
  ).rejects.toMatchObject({ code: "unsafe-input-dir", retryable: false });
  chmodSync(real, 0o770);
  await expect(stageInputs(mine, claim!, real, controller.signal)).rejects.toMatchObject({
    code: "unsafe-input-dir",
  });
});

it("gives each job its own input folder, removed afterwards", async () => {
  // This handler reports the names it can see in its input folder.
  const lister = join(dir, "lister.cjs");
  writeFileSync(
    lister,
    `const { readdirSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
let raw = "";
process.stdin.on("data", (c) => (raw += c)).on("end", () => {
  const { job, outDir, inputDir } = JSON.parse(raw);
  const out = readdirSync(inputDir).sort().join("\\n") + "\\n";
  const file = job.key + "." + job.fence + ".jsonl";
  writeFileSync(outDir + "/" + file, out);
  process.stdout.write(JSON.stringify({ file, sha256: createHash("sha256").update(out).digest("hex") }));
});
`,
    { mode: 0o500 },
  );
  const first = await owner().uploadInput(Buffer.from("first job input"));
  const second = await owner().uploadInput(Buffer.from("second job input"));
  const keys = [];
  for (const [n, input] of [first, second].entries())
    keys.push(
      (await owner().enqueue({ kind: "shout", inputs: [input], params: { n }, payload: null })).key,
    );
  const done = start(settings(true, lister));
  await waitFor(() => keys.every((key) => store.get(key)?.status === "done"));
  controller.abort();
  await done;
  const seen = (key: string) =>
    readFileSync(join(dir, "accepted", store.get(key)!.outputFile!), "utf8");
  expect(seen(keys[0]!)).toBe(`${first}\n`);
  expect(seen(keys[1]!)).toBe(`${second}\n`);
  expect(readdirSync(join(dir, "staged", "jobs"))).toEqual([]);
  expect(readdirSync(join(dir, "staged", "blobs")).sort()).toEqual([first, second].sort());
});
