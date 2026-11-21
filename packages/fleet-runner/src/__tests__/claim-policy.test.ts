import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateToken } from "../auth.js";
import { fleetClient } from "../client.js";
import {
  decideClaim,
  kindUnavailable,
  localClock,
  parseClaimPolicy,
  parsePowerSource,
  parseRequirements,
  type PowerSource,
} from "../claim-policy.js";
import { runDeclaredWorker } from "../declared-worker.js";
import { JobStore } from "../jobs.js";
import { fleetServer } from "../server.js";
import { parseWorkerSettings } from "../worker-settings.js";

const at = (iso: string) => Date.parse(iso);
const policy = (extra: object = {}) =>
  parseClaimPolicy({ timezone: "America/New_York", power: "ac-only", ...extra });

describe("claim rules", () => {
  it("refuses battery and unknown power, and allows AC", () => {
    const p = policy();
    const now = at("2026-06-10T15:00:00Z");
    expect(decideClaim(p, "ac", now)).toEqual({ allowed: true, reason: "ok" });
    expect(decideClaim(p, "battery", now)).toEqual({ allowed: false, reason: "power-battery" });
    expect(decideClaim(p, "unknown", now)).toEqual({ allowed: false, reason: "power-unknown" });
    expect(decideClaim(policy({ power: "any" }), "battery", now).allowed).toBe(true);
  });

  it("reads the macOS battery report and treats anything else as unknown", () => {
    expect(parsePowerSource("Now drawing from 'AC Power'\n -InternalBattery-0")).toBe("ac");
    expect(parsePowerSource("Now drawing from 'Battery Power'\n")).toBe("battery");
    expect(parsePowerSource("")).toBe("unknown");
    expect(parsePowerSource("Now drawing from 'UPS Power'")).toBe("unknown");
  });

  it("applies windows on the local wall clock, including across midnight", () => {
    // Weekdays 09:00-17:00 and Friday 22:00 to Saturday 02:00, New York time.
    const p = policy({
      windows: [
        { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
        { days: [5], start: "22:00", end: "02:00" },
      ],
    });
    const ok = (iso: string) => decideClaim(p, "ac", at(iso)).allowed;
    expect(ok("2026-06-10T15:00:00Z")).toBe(true); // Wed 11:00 EDT
    expect(ok("2026-06-10T21:00:00Z")).toBe(false); // Wed 17:00 EDT, end is exclusive
    expect(ok("2026-06-10T12:59:00Z")).toBe(false); // Wed 08:59 EDT
    expect(ok("2026-06-13T03:00:00Z")).toBe(true); // Fri 23:00 EDT
    expect(ok("2026-06-13T05:59:00Z")).toBe(true); // Sat 01:59 EDT, still Friday's window
    expect(ok("2026-06-13T06:00:00Z")).toBe(false); // Sat 02:00 EDT
    expect(ok("2026-06-14T15:00:00Z")).toBe(false); // Sun 11:00 EDT
  });

  it("follows daylight saving changes instead of a fixed UTC offset", () => {
    // Sunday 2026-03-08: clocks jump from 02:00 to 03:00 in New York.
    const spring = policy({ windows: [{ days: [0], start: "01:30", end: "03:30" }] });
    const ok = (p: ReturnType<typeof policy>, iso: string) => decideClaim(p, "ac", at(iso)).allowed;
    expect(localClock(at("2026-03-08T06:45:00Z"), "America/New_York")).toEqual({
      day: 0,
      minute: 105,
    }); // 01:45 EST
    expect(ok(spring, "2026-03-08T06:45:00Z")).toBe(true); // 01:45 EST
    expect(ok(spring, "2026-03-08T07:10:00Z")).toBe(true); // 03:10 EDT, 25 minutes later
    expect(ok(spring, "2026-03-08T07:40:00Z")).toBe(false); // 03:40 EDT; a fixed offset would say 02:40
    // Sunday 2026-11-01: 01:00 to 02:00 happens twice.
    const fall = policy({ windows: [{ days: [0], start: "01:00", end: "02:00" }] });
    expect(ok(fall, "2026-11-01T05:30:00Z")).toBe(true); // 01:30 EDT
    expect(ok(fall, "2026-11-01T06:30:00Z")).toBe(true); // 01:30 EST, the repeated hour
    expect(ok(fall, "2026-11-01T07:10:00Z")).toBe(false); // 02:10 EST
  });

  it("honours an exception only until it expires, and never for unknown power", () => {
    const base = {
      windows: [{ days: [1], start: "09:00", end: "10:00" }],
      exceptions: [
        { allow: "outside-window", until: "2026-06-10T16:00:00Z" },
        { allow: "on-battery", until: "2026-06-10T16:00:00-04:00" },
      ],
    };
    const p = policy(base);
    const before = at("2026-06-10T15:00:00Z"); // Wed, outside the Monday window
    const after = at("2026-06-10T21:00:00Z"); // 17:00 EDT
    expect(decideClaim(p, "ac", before)).toEqual({ allowed: true, reason: "ok" });
    expect(decideClaim(p, "ac", after)).toEqual({ allowed: false, reason: "exception-expired" });
    expect(decideClaim(p, "battery", before)).toEqual({ allowed: true, reason: "ok" });
    expect(decideClaim(p, "battery", at("2026-06-10T21:00:00Z"))).toEqual({
      allowed: false,
      reason: "exception-expired",
    });
    expect(decideClaim(p, "unknown", before)).toEqual({ allowed: false, reason: "power-unknown" });
    expect(decideClaim(p, "ac", at("2026-06-10T16:00:00Z")).reason).toBe("exception-expired");
  });

  it("holds back only kinds this host cannot honestly run", () => {
    const host = {
      platform: "darwin",
      arch: "arm64",
      fileExists: (file: string) => file === "/model/present",
      gpuBusy: () => true,
    };
    expect(kindUnavailable({}, undefined, host)).toBeUndefined();
    expect(kindUnavailable({ platform: "linux" }, undefined, host)).toBe("unsupported-platform");
    expect(kindUnavailable({ arch: "x64" }, undefined, host)).toBe("unsupported-arch");
    expect(kindUnavailable({ files: ["/model/present", "/model/absent"] }, undefined, host)).toBe(
      "missing-file",
    );
    expect(kindUnavailable({ platform: "darwin", files: ["/model/present"] }, "gpu", host)).toBe(
      "gpu-busy",
    );
    expect(kindUnavailable({}, "other", host)).toBeUndefined();
  });

  it("validates settings strictly", () => {
    for (const bad of [
      {},
      { timezone: "Not/AZone" },
      { timezone: "UTC", power: "sometimes" },
      { timezone: "UTC", extra: 1 },
      { timezone: "UTC", windows: [{ days: [7], start: "09:00", end: "10:00" }] },
      { timezone: "UTC", windows: [{ days: [], start: "09:00", end: "10:00" }] },
      { timezone: "UTC", windows: [{ days: [1], start: "9:00", end: "10:00" }] },
      { timezone: "UTC", windows: [{ days: [1], start: "09:00", end: "09:00" }] },
      { timezone: "UTC", exceptions: [{ allow: "anything", until: "2026-01-01T00:00:00Z" }] },
      { timezone: "UTC", exceptions: [{ allow: "on-battery", until: "2026-01-01 00:00" }] },
      { timezone: "UTC", exceptions: [{ allow: "on-battery", until: "2026-01-01T00:00:00" }] },
      { timezone: "UTC", gpuBusyFile: "relative" },
    ])
      expect(() => parseClaimPolicy(bad)).toThrow("invalid-claim-policy");
    expect(() => parseRequirements({ files: ["relative"] })).toThrow("invalid-kind-requirements");
    expect(() => parseRequirements({ cpu: "m1" })).toThrow("invalid-kind-requirements");
    expect(parseRequirements(undefined)).toEqual({});
  });
});

const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
const HANDLER = `
const { writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
let raw = "";
process.stdin.on("data", (c) => (raw += c)).on("end", () => {
  const { job, outDir } = JSON.parse(raw);
  const out = job.kind + "\\n";
  const file = job.key + "." + job.fence + ".jsonl";
  writeFileSync(outDir + "/" + file, out);
  process.stdout.write(JSON.stringify({ file, sha256: createHash("sha256").update(out).digest("hex") }));
});
`;

describe("worker against a real local service", () => {
  let dir: string;
  let store: JobStore;
  let server: Server;
  let endpoint: string;
  let controller: AbortController;
  let power: PowerSource;
  let clock: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "claim-policy-"));
    for (const id of ["owner", "worker"]) generateToken(join(dir, id));
    writeFileSync(join(dir, "handler.cjs"), HANDLER, { mode: 0o500 });
    store = new JobStore(join(dir, "jobs.sqlite"));
    server = fleetServer(store, {
      registry: dir,
      outDir: join(dir, "accepted"),
      inputDir: join(dir, "service-inputs"),
      workers: ["worker"],
    });
    endpoint = await new Promise<string>((ok, fail) => {
      server.once("error", fail);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") return fail(Error("no listener"));
        ok(`http://127.0.0.1:${address.port}`);
      });
    });
    controller = new AbortController();
    power = "ac";
    clock = at("2026-06-10T15:00:00Z"); // Wednesday 11:00 in New York
  });

  afterEach(async () => {
    controller.abort();
    await new Promise<void>((ok) => server.close(() => ok()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const settings = (extra: object, kinds: Record<string, object> = { shout: {} }) =>
    parseWorkerSettings({
      schemaVersion: 1,
      endpoint,
      worker: "worker",
      tokenFile: join(dir, "worker"),
      outDir: join(dir, "attempts"),
      statusFile: join(dir, "status.json"),
      pollMs: 10,
      ...extra,
      kinds: Object.fromEntries(
        Object.entries(kinds).map(([kind, more]) => [
          kind,
          { capabilities: [], command: [process.execPath, join(dir, "handler.cjs")], ...more },
        ]),
      ),
    });
  const owner = () => fleetClient(endpoint, "owner", join(dir, "owner"));
  const admit = async (kind: string) =>
    (await owner().enqueue({ kind, inputs: [], payload: null })).key;
  const start = (s: ReturnType<typeof settings>) =>
    runDeclaredWorker(s, controller.signal, { power: async () => power, now: () => clock });
  const status = () => {
    try {
      return JSON.parse(readFileSync(join(dir, "status.json"), "utf8"));
    } catch {
      return {}; // not written yet, or caught mid-rename
    }
  };
  const waitFor = async (ready: () => boolean) => {
    const end = Date.now() + 8_000;
    while (!ready()) {
      if (Date.now() >= end) throw Error("condition did not become true");
      await delay(10);
    }
  };
  const claimed = (key: string) =>
    store.events(0).some((e) => e.key === key && e.type === "claimed");

  it("makes zero claims on battery or unknown power, reports why, and runs once on AC", async () => {
    const key = await admit("shout");
    power = "battery";
    const done = start(settings({ policy: { timezone: "America/New_York" } }));
    await waitFor(() => status().claiming?.reason === "power-battery");
    await delay(150); // many polls
    expect(claimed(key)).toBe(false);
    expect(status()).toMatchObject({
      state: "paused",
      kinds: ["shout"],
      claiming: { allowed: false, reason: "power-battery" },
    });
    power = "unknown";
    await waitFor(() => status().claiming?.reason === "power-unknown");
    await delay(100);
    expect(claimed(key)).toBe(false);
    power = "ac";
    await waitFor(() => store.get(key)?.status === "done");
    controller.abort();
    await done;
    expect(store.get(key)?.output).toBe(sha("shout\n"));
  });

  it("refuses outside the window and after an exception expires, and runs when the window opens", async () => {
    const key = await admit("shout");
    clock = at("2026-06-10T23:00:00Z"); // 19:00 EDT, after hours
    const s = settings({
      policy: {
        timezone: "America/New_York",
        windows: [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }],
        exceptions: [{ allow: "outside-window", until: "2026-06-10T22:00:00Z" }],
      },
    });
    const done = start(s);
    await waitFor(() => status().claiming?.reason === "exception-expired");
    await delay(100);
    expect(claimed(key)).toBe(false);
    clock = at("2026-06-11T14:00:00Z"); // Thursday 10:00 EDT
    await waitFor(() => store.get(key)?.status === "done");
    controller.abort();
    await done;
  });

  it("holds back a busy GPU kind only, and offers only kinds this host can really run", async () => {
    const busy = join(dir, "gpu-busy");
    writeFileSync(busy, "");
    const s = settings(
      { policy: { timezone: "UTC", gpuBusyFile: busy } },
      {
        shout: { resource: "gpu" },
        plain: {},
        foreign: { requires: { platform: "no-such-os" } },
        lacking: { requires: { files: [join(dir, "model-weights")] } },
      },
    );
    const gpuKey = await admit("shout");
    const plainKey = await admit("plain");
    const foreignKey = await admit("foreign");
    const lackingKey = await admit("lacking");
    const done = start(s);
    await waitFor(() => store.get(plainKey)?.status === "done");
    await delay(100);
    expect(claimed(gpuKey)).toBe(false);
    expect(claimed(foreignKey)).toBe(false);
    expect(claimed(lackingKey)).toBe(false);
    expect(status()).toMatchObject({
      kinds: ["plain"],
      unavailable: {
        shout: "gpu-busy",
        foreign: "unsupported-platform",
        lacking: "missing-file",
      },
    });
    rmSync(busy); // the GPU is free again
    await waitFor(() => store.get(gpuKey)?.status === "done");
    controller.abort();
    await done;
    expect(claimed(foreignKey) || claimed(lackingKey)).toBe(false);
    expect(status().unavailable).toEqual({
      foreign: "unsupported-platform",
      lacking: "missing-file",
    });
  });

  it("claims as before when no policy is configured", async () => {
    power = "battery";
    const key = await admit("shout");
    const done = start(settings({}));
    await waitFor(() => store.get(key)?.status === "done");
    controller.abort();
    await done;
    expect(status().claiming).toEqual({ allowed: true, reason: "ok" });
  });

  it("resumes claiming after the owner lifts a pause, with or without a policy", async () => {
    for (const extra of [{}, { policy: { timezone: "UTC" } }]) {
      const run = new AbortController();
      await owner().control("worker", "pause");
      const key = await owner().enqueue({
        kind: "shout",
        inputs: [],
        params: { policy: "policy" in extra },
        payload: null,
      });
      const done = runDeclaredWorker(settings(extra), run.signal, {
        power: async () => power,
        now: () => clock,
      });
      await waitFor(() => status().claiming?.reason === "service-paused");
      await delay(100);
      expect(claimed(key.key)).toBe(false);
      await owner().control("worker", "resume");
      await waitFor(() => store.get(key.key)?.status === "done");
      expect(status().claiming).toEqual({ allowed: true, reason: "ok" });
      run.abort();
      await done;
    }
  });

  it("stops claiming when the clock or power probe fails", async () => {
    const key = await admit("shout");
    const done = runDeclaredWorker(settings({ policy: { timezone: "UTC" } }), controller.signal, {
      power: async () => {
        throw Error("probe failed");
      },
      now: () => clock,
    });
    await waitFor(() => status().claiming?.reason === "policy-error");
    await delay(100);
    expect(claimed(key)).toBe(false);
    controller.abort();
    await done;
  });
});
