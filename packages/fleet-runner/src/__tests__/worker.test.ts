import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FleetClient } from "../client.js";
import { writeOutput, type Claim } from "../jobs.js";
import { runWorker, type RemoteWorkerEvent, type ResidentWorkerOptions } from "../worker.js";

let outDir: string;
let controller: AbortController;

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "fleet-worker-"));
  controller = new AbortController();
});

afterEach(async () => {
  controller.abort();
  await rm(outDir, { recursive: true, force: true });
});

const job: Claim = {
  key: "a".repeat(64),
  fence: 1,
  kind: "noop",
  inputs: ["synthetic"],
  params: {},
  code: null,
  payload: null,
  leaseExpires: Date.now() + 300_000,
};

function setup() {
  const client = {
    claim: vi.fn<FleetClient["claim"]>().mockResolvedValue(null),
    complete: vi.fn<FleetClient["complete"]>().mockResolvedValue(true),
    heartbeat: vi.fn<FleetClient["heartbeat"]>().mockResolvedValue(true),
    enqueue: vi.fn<FleetClient["enqueue"]>(),
    release: vi.fn<FleetClient["release"]>(),
    fail: vi.fn<FleetClient["fail"]>(),
    events: vi.fn<FleetClient["events"]>(),
    report: vi.fn<FleetClient["report"]>(),
    verify: vi.fn<FleetClient["verify"]>(),
  } satisfies FleetClient;
  const options: ResidentWorkerOptions = {
    signal: controller.signal,
    pollMs: 1,
    jitterRatio: 0,
    outDir,
    caps: [],
    handlers: { noop: async (job, context) => writeOutput(context.outDir, job, "synthetic") },
  };
  return { client, options };
}

it("checks the claim policy on each pass and fails closed on denial and error", async () => {
  const { client, options } = setup();
  client.claim.mockResolvedValueOnce(job);
  const events: RemoteWorkerEvent[] = [];
  const canClaim = vi
    .fn<() => Promise<boolean>>()
    .mockRejectedValueOnce(new Error("synthetic policy error"))
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);

  await runWorker(client, {
    ...options,
    canClaim,
    onEvent(event) {
      events.push(event);
      if (events.length === 4) controller.abort();
    },
  });

  expect(client.claim).toHaveBeenCalledTimes(1);
  expect(client.complete).toHaveBeenCalledTimes(1);
  expect(canClaim).toHaveBeenCalledTimes(4);
  expect(events).toEqual([
    { type: "policy-error", delayMs: 1 },
    { type: "paused", delayMs: 1 },
    { type: "completed" },
    { type: "paused", delayMs: 1 },
  ]);
});

it("stops without claiming while an asynchronous policy check is pending", async () => {
  const { client, options } = setup();
  let allow!: (allowed: boolean) => void;
  const policy = new Promise<boolean>((resolve) => {
    allow = resolve;
  });
  const running = runWorker(client, { ...options, canClaim: () => policy });

  controller.abort();
  await running;
  allow(true);

  expect(client.claim).not.toHaveBeenCalled();
});

it("drains a claim already in flight and does not take a second job after stop", async () => {
  const { client, options } = setup();
  let grant!: (claim: Claim) => void;
  client.claim.mockReturnValueOnce(
    new Promise<Claim>((resolve) => {
      grant = resolve;
    }),
  );
  const onEvent = vi.fn();
  const running = runWorker(client, { ...options, onEvent });

  expect(client.claim).toHaveBeenCalledTimes(1);
  expect(client.complete).not.toHaveBeenCalled();
  controller.abort();
  grant(job);
  await running;

  expect(client.claim).toHaveBeenCalledTimes(1);
  expect(client.complete).toHaveBeenCalledTimes(1);
  expect(onEvent.mock.calls).toEqual([[{ type: "completed" }]]);
});

it("continues pulling after a stale upload and completes a newer attempt", async () => {
  const { client, options } = setup();
  const reclaimed = { ...job, fence: 2 };
  client.claim.mockResolvedValueOnce(job).mockResolvedValueOnce(reclaimed);
  client.complete.mockResolvedValueOnce(false);
  const events: RemoteWorkerEvent[] = [];

  await runWorker(client, {
    ...options,
    onEvent(event) {
      events.push(event);
      if (event.type === "completed") controller.abort();
    },
  });

  expect(client.complete.mock.calls.map(([claim]) => claim.fence)).toEqual([1, 2]);
  expect(events).toEqual([{ type: "lease-lost", delayMs: 1 }, { type: "completed" }]);
});

it("bounds request backoff and returns to the normal delay after an idle response", async () => {
  const { client, options } = setup();
  const error = new Error("synthetic transport error");
  client.claim
    .mockRejectedValueOnce(error)
    .mockRejectedValueOnce(error)
    .mockRejectedValueOnce(error)
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(error);
  const events: RemoteWorkerEvent[] = [];

  await runWorker(client, {
    ...options,
    maxBackoffMs: 3,
    onEvent(event) {
      events.push(event);
      if (events.length === 6) controller.abort();
    },
  });

  expect(events).toEqual([
    { type: "request-error", delayMs: 1, code: "unexpected-error" },
    { type: "request-error", delayMs: 2, code: "unexpected-error" },
    { type: "request-error", delayMs: 3, code: "unexpected-error" },
    { type: "request-error", delayMs: 3, code: "unexpected-error" },
    { type: "idle", delayMs: 1 },
    { type: "request-error", delayMs: 1, code: "unexpected-error" },
  ]);
});

it("cancels a long idle wait when stopped", async () => {
  const { client, options } = setup();
  let reachedIdle!: () => void;
  const idle = new Promise<void>((resolve) => {
    reachedIdle = resolve;
  });
  const running = runWorker(client, { ...options, pollMs: 60_000, onEvent: reachedIdle });

  await idle;
  controller.abort();
  await running;

  expect(client.claim).toHaveBeenCalledTimes(1);
});

it("retries a transient heartbeat without aborting useful work", async () => {
  const { client, options } = setup();
  client.claim.mockResolvedValueOnce({ ...job, leaseExpires: Date.now() + 5_000 });
  client.heartbeat.mockRejectedValueOnce(new Error("synthetic Wi-Fi roam"));
  options.heartbeatMs = 2;
  options.retryMs = 1;
  options.handlers = {
    noop: async (claim, context) => {
      await vi.waitFor(() => expect(client.heartbeat.mock.calls.length).toBeGreaterThanOrEqual(2));
      expect(context.signal.aborted).toBe(false);
      return writeOutput(context.outDir, claim, "synthetic");
    },
  };
  await runWorker(client, {
    ...options,
    onEvent(e) {
      if (e.type === "completed") controller.abort();
    },
  });
  expect(client.complete).toHaveBeenCalledOnce();
});

it("cancels a handler and releases its claim after the shutdown drain deadline", async () => {
  const { client, options } = setup();
  client.claim.mockResolvedValueOnce(job);
  client.release.mockResolvedValueOnce(true);
  options.handlers = {
    noop: async (_claim, context) => {
      controller.abort();
      await new Promise<void>((resolve) =>
        context.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      throw new Error("synthetic cancellation");
    },
  };
  await runWorker(client, { ...options, shutdownGraceMs: 1 });
  expect(client.release).toHaveBeenCalledOnce();
  expect(client.complete).not.toHaveBeenCalled();
});

it("retains an uncertain upload when the service is unavailable until lease expiry", async () => {
  const { workOnce } = await import("../worker.js");
  const { readdir } = await import("node:fs/promises");
  const { client, options } = setup();
  client.claim.mockResolvedValueOnce({ ...job, leaseExpires: Date.now() + 100 });
  client.complete.mockRejectedValue(new Error("synthetic unavailable server"));
  client.heartbeat.mockRejectedValue(new Error("synthetic unavailable server"));
  expect(await workOnce(client, { ...options, heartbeatMs: 10, retryMs: 2 })).toBe("lease-lost");
  expect(await readdir(outDir)).toContain(`${job.key}.1.jsonl`);
  expect(client.complete.mock.calls.length).toBeGreaterThan(1);
});

it("fails a permanent output rejection rather than retrying until lease expiry", async () => {
  const { workOnce } = await import("../worker.js");
  const { FleetHttpError } = await import("../client.js");
  const { client, options } = setup();
  client.claim.mockResolvedValueOnce(job);
  client.complete.mockRejectedValueOnce(new FleetHttpError(413));
  client.fail.mockResolvedValueOnce(true);
  expect(await workOnce(client, options)).toBe("failed");
  expect(client.fail).toHaveBeenCalledWith(job, "output-rejected", false);
  expect(client.complete).toHaveBeenCalledOnce();
});

it("keeps pulling when an observation callback throws", async () => {
  const { client, options } = setup();
  client.claim.mockResolvedValueOnce(job).mockImplementationOnce(async () => {
    controller.abort();
    return null;
  });
  await runWorker(client, {
    ...options,
    onEvent() {
      throw new Error("synthetic observer error");
    },
  });
  expect(client.complete).toHaveBeenCalledOnce();
  expect(client.claim).toHaveBeenCalledTimes(2);
});
