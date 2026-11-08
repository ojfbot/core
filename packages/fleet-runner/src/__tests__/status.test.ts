import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateToken } from "../auth.js";
import { fleetClient } from "../client.js";
import { JobStore } from "../jobs.js";
import { fleetServer } from "../server.js";
import { statusView, validObservation } from "../status.js";
import { runPresence } from "../presence.js";
import { consoleServer, CONSOLE_HTML } from "../console.js";
let dir: string,
  store: JobStore,
  server: ReturnType<typeof fleetServer>,
  endpoint: string,
  now: number;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "fleet-status-"));
  for (const id of ["owner", "observer", "yuri", "yojimbo"]) generateToken(join(dir, id));
  now = 100_000;
  store = new JobStore(":memory:", { now: () => now });
  server = fleetServer(store, { registry: dir, outDir: join(dir, "out") });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});
const client = (id: string) => fleetClient(endpoint, id, join(dir, id));
const observation = {
  schemaVersion: 1 as const,
  phase: "idle" as const,
  eligibility: "eligible" as const,
  handlers: ["read-vision" as const],
  busy: false,
};
it("separates process presence from job authority and makes observations stale after 30 seconds", async () => {
  const before = store.events(0);
  await client("yuri").presence(observation);
  const fresh = await client("observer").status();
  expect(fresh.workers.find((w) => w.id === "yuri")).toMatchObject({
    freshness: "fresh",
    phase: "idle",
    eligibility: "eligible",
  });
  expect(store.events(0)).toEqual(before);
  now += 30_001;
  const stale = await client("observer").status();
  expect(stale.workers.find((w) => w.id === "yuri")).toMatchObject({
    freshness: "stale",
    phase: "unknown",
    eligibility: "unknown",
    busy: null,
  });
  expect(stale.backup.state).toBe("unqualified");
  expect(stale.revision).not.toBe(fresh.revision);
});
it("observer reads bounded redacted views but cannot mutate queue, controls or presence", async () => {
  const observer = client("observer");
  const payload = "secret-reader-canary";
  const privatePath = "/private/synthetic-only-canary";
  const { key } = store.enqueue({
    kind: "secret-kind-canary",
    inputs: [privatePath],
    params: { content: payload },
    payload: { image: privatePath },
  });
  const before = store.events(0);
  for (const action of [
    () => observer.claim([], []),
    () => observer.enqueue({ kind: "synthetic", inputs: [], payload: null }),
    () => observer.control("yuri", "pause"),
    () => observer.presence(observation),
  ])
    await expect(action()).rejects.toMatchObject({ status: 403 });
  expect(store.events(0)).toEqual(before);
  const snapshot = await observer.status();
  const text = JSON.stringify(snapshot);
  for (const canary of [payload, privatePath, key, "secret-kind-canary"])
    expect(text).not.toContain(canary);
  expect(snapshot.events[0]!.trace).toMatch(/^t_/);
  expect(snapshot.kinds[0]!.kind).toBe("other");
  for (const view of ["status", "workers", "events", "logs", "doctor"] as const)
    expect(statusView(snapshot, view)).toMatchObject({ revision: snapshot.revision });
  await expect(client("yuri").status()).rejects.toMatchObject({ status: 403 });
});
it("checks owner pause in the claim transaction and drains an existing lease without cancelling it", async () => {
  const owner = client("owner"),
    worker = client("yuri");
  store.enqueue({ kind: "read-vision", inputs: [], payload: null });
  await owner.control("yuri", "pause");
  expect(await worker.claim([], ["read-vision"])).toBeNull();
  await owner.control("yuri", "resume");
  const held = (await worker.claim([], ["read-vision"]))!;
  expect(held).not.toBeNull();
  await owner.control("yuri", "drain");
  expect(await worker.heartbeat(held)).toBe(true);
  await worker.presence({ ...observation, phase: "running", busy: true });
  const status = await owner.status();
  expect(status.workers.find((w) => w.id === "yuri")).toMatchObject({
    phase: "draining",
    eligibility: "operator-paused",
  });
  const bytes = Buffer.from("synthetic\n");
  const { createHash } = await import("node:crypto");
  expect(await worker.complete(held, bytes, createHash("sha256").update(bytes).digest("hex"))).toBe(
    true,
  );
  expect(store.get(held.key)!.status).toBe("done");
});
it("rejects content, arbitrary diagnostics and unsupported schemas in worker observations", async () => {
  for (const b of [
    { ...observation, content: "secret-canary" },
    { ...observation, errorCode: "secret-canary" },
    { ...observation, handlers: ["secret-canary"] },
    { ...observation, schemaVersion: 2 },
  ]) {
    expect(validObservation(b)).toBe(false);
    await expect(client("yuri").presence(b as typeof observation)).rejects.toMatchObject({
      status: 400,
    });
  }
  expect((await client("owner").status()).workers.every((w) => w.freshness === "unknown")).toBe(
    true,
  );
});
it("keeps the console loopback-only/read-only, blocks cross-site and never embeds signing material", async () => {
  const viewer = consoleServer(client("observer"), () => now);
  await new Promise<void>((resolve) => viewer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(viewer.address() as { port: number }).port}`;
  try {
    expect((await fetch(url + "/snapshot")).status).toBe(200);
    expect(
      (await fetch(url + "/snapshot", { headers: { origin: "https://untrusted.invalid" } })).status,
    ).toBe(403);
    expect((await fetch(url + "/snapshot", { method: "POST" })).status).toBe(405);
    expect(CONSOLE_HTML).toContain("textContent");
    expect(CONSOLE_HTML).not.toContain("innerHTML");
    expect(CONSOLE_HTML).not.toContain(readFileSync(join(dir, "observer"), "utf8"));
  } finally {
    await new Promise<void>((resolve) => viewer.close(() => resolve()));
  }
});
it("sends independent process heartbeats at ten-second intervals without any job methods", async () => {
  const stop = new AbortController();
  let clock = 0;
  const ticks: number[] = [];
  const presence = vi.fn(async () => {
    ticks.push(clock);
    return { received: true };
  });
  await runPresence({ presence }, () => observation, stop.signal, 10_000, {
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
      if (clock > 20_000) stop.abort();
    },
  });
  expect(ticks).toEqual([0, 10_000, 20_000]);
});

it("replays bounded opaque events with stable cursors and no payload or raw key", async () => {
  const keys = [];
  for (let i = 0; i < 105; i++)
    keys.push(store.enqueue({ kind: "read-vision", inputs: [], params: { i }, payload: null }).key);
  const a = await client("observer").statusEvents();
  expect(a.events).toHaveLength(100);
  expect(a.hasMore).toBe(true);
  const b = await client("observer").statusEvents(a.cursor);
  expect(b.events).toHaveLength(5);
  expect(b.hasMore).toBe(false);
  expect(new Set([...a.events, ...b.events].map((e) => e.seq)).size).toBe(105);
  expect(await client("observer").statusEvents(a.cursor)).toEqual(b);
  expect(JSON.stringify(a)).not.toContain(keys[0]);
  await expect(client("observer").statusEvents(-1)).rejects.toMatchObject({ status: 400 });
});

it("migrates v3 without losing records and blocks a pre-upgrade open writer from bypassing pause", async () => {
  const { createRequire } = await import("node:module");
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
  const file = join(dir, "migration.sqlite");
  const initial = new JobStore(file);
  const { key } = initial.enqueue({ kind: "read-vision", inputs: [], payload: null });
  initial.close();
  const old = new DatabaseSync(file);
  old.exec(
    "DROP TRIGGER jobs_paused_claim; DROP TABLE fleet_controls; DROP TABLE fleet_presence; DROP TABLE fleet_status_meta; PRAGMA user_version=3;",
  );
  const current = new JobStore(file);
  current.controlWorker("yuri", "pause");
  expect(() =>
    old
      .prepare(
        "UPDATE jobs SET status='claimed',worker='yuri',fence=fence+1,lease_expires=999999,rev=rev+1 WHERE key=?",
      )
      .run(key),
  ).toThrow("worker claims paused");
  expect(current.get(key)!.status).toBe("ready");
  expect(old.prepare("PRAGMA user_version").get()).toEqual({ user_version: 4 });
  current.close();
  old.close();
});
