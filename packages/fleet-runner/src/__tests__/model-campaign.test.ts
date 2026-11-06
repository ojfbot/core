import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { JobStore, jobKey } from "../jobs.js";
import type { JobEvent, JobRow, JobSpec } from "../jobs.js";

const LEASE_MS = 10;
const SEEDS = 1_000;
const STEPS = 64;
const WORKERS = ["worker-a", "worker-b"] as const;
const JOB: JobSpec = {
  kind: "model-probe",
  inputs: ["input-digest"],
  code: "model-campaign-v1",
  payload: null,
  maxAttempts: 3,
};
const JOB_KEY = jobKey(JOB);
const totalCoverage = {
  accepted: 0,
  stale: 0,
  expired: 0,
  retry: 0,
  released: 0,
  terminalFailure: 0,
};

type Worker = (typeof WORKERS)[number];
type RefStatus = "ready" | "claimed" | "done" | "failed";
type RefEventType = JobEvent["type"];
type Token = { worker: Worker; fence: number };

interface ReferenceState {
  status: RefStatus;
  attempts: number;
  fence: number;
  worker: Worker | null;
  leaseExpires: number | null;
  output: string | null;
  outputFile: string | null;
  error: string | null;
}

interface ReferenceEvent {
  seq: number;
  ts: number;
  key: string;
  type: RefEventType;
  worker: Worker | null;
  fence: number;
}

type Operation =
  | { kind: "tick"; amount: number }
  | { kind: "enqueue" }
  | { kind: "claim"; worker: Worker }
  | { kind: "heartbeat"; token: Token }
  | { kind: "release"; token: Token }
  | { kind: "complete"; token: Token; result: string }
  | { kind: "fail"; token: Token; retryable: boolean };

function randomFor(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function operationSequence(seed: number): Operation[] {
  const random = randomFor(seed);
  let claimCalls = 0;
  const choose = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)]!;
  const sequence: Operation[] = [];
  for (let index = 0; index < STEPS; index += 1) {
    const choice = Math.floor(random() * 7);
    if (choice === 0) sequence.push({ kind: "tick", amount: choose([0, 1, 9, 10, 11, 23]) });
    else if (choice === 1) sequence.push({ kind: "enqueue" });
    else if (choice === 2) {
      sequence.push({ kind: "claim", worker: choose(WORKERS) });
      claimCalls += 1;
    } else {
      const token = { worker: choose(WORKERS), fence: Math.floor(random() * (claimCalls + 1)) };
      if (choice === 3) sequence.push({ kind: "heartbeat", token });
      else if (choice === 4) sequence.push({ kind: "release", token });
      else if (choice === 5)
        sequence.push({ kind: "complete", token, result: `result-${seed}-${index}` });
      else sequence.push({ kind: "fail", token, retryable: random() < 0.75 });
    }
  }
  return sequence;
}

function emptyReference(): ReferenceState {
  return {
    status: "ready",
    attempts: 0,
    fence: 0,
    worker: null,
    leaseExpires: null,
    output: null,
    outputFile: null,
    error: null,
  };
}

function held(state: ReferenceState, now: number, token: Token): boolean {
  return (
    state.status === "claimed" &&
    state.worker === token.worker &&
    state.fence === token.fence &&
    state.leaseExpires !== null &&
    state.leaseExpires > now
  );
}

function appendEvent(
  events: ReferenceEvent[],
  now: number,
  type: RefEventType,
  worker: Worker | null,
  fence: number,
): void {
  events.push({ seq: events.length + 1, ts: now, key: JOB_KEY, type, worker, fence });
}

function sweepReference(state: ReferenceState, events: ReferenceEvent[], now: number): void {
  if (state.status !== "claimed" || state.leaseExpires === null || state.leaseExpires > now) return;
  const worker = state.worker;
  if (worker === null) throw new Error("claimed model state has no worker");
  state.status = state.attempts < JOB.maxAttempts! ? "ready" : "failed";
  state.error = state.status === "failed" ? "lease-expired" : null;
  state.worker = null;
  state.leaseExpires = null;
  appendEvent(events, now, "lease-expired", worker, state.fence);
}

function applyReference(
  state: ReferenceState,
  events: ReferenceEvent[],
  op: Operation,
  now: number,
): unknown {
  if (op.kind === "tick") return undefined;
  if (op.kind === "enqueue") {
    const created = events.length === 0;
    if (created) appendEvent(events, now, "enqueued", null, 0);
    return { key: JOB_KEY, created };
  }
  if (op.kind === "claim") {
    sweepReference(state, events, now);
    if (state.status !== "ready") return undefined;
    state.status = "claimed";
    state.attempts += 1;
    state.fence += 1;
    state.worker = op.worker;
    state.leaseExpires = now + LEASE_MS;
    appendEvent(events, now, "claimed", op.worker, state.fence);
    return {
      key: JOB_KEY,
      fence: state.fence,
      worker: op.worker,
      leaseExpires: state.leaseExpires,
    };
  }

  const { token } = op;
  if (op.kind === "heartbeat") {
    if (!held(state, now, token)) return false;
    state.leaseExpires = now + LEASE_MS;
    return true;
  }
  if (op.kind === "release") {
    if (!held(state, now, token)) return false;
    state.status = "ready";
    state.attempts -= 1;
    state.worker = null;
    state.leaseExpires = null;
    appendEvent(events, now, "released", token.worker, token.fence);
    return true;
  }
  if (op.kind === "complete") {
    if (!held(state, now, token)) {
      appendEvent(events, now, "rejected-stale", token.worker, token.fence);
      return false;
    }
    state.status = "done";
    state.output = op.result;
    state.outputFile = `${token.fence}.jsonl`;
    state.error = null;
    state.leaseExpires = null;
    appendEvent(events, now, "completed", token.worker, token.fence);
    return true;
  }
  if (!held(state, now, token)) {
    appendEvent(events, now, "rejected-stale", token.worker, token.fence);
    return false;
  }
  const retry = op.retryable && state.attempts < JOB.maxAttempts!;
  state.status = retry ? "ready" : "failed";
  state.error = `failure-${token.fence}`;
  state.worker = null;
  state.leaseExpires = null;
  appendEvent(events, now, retry ? "retry" : "failed", token.worker, token.fence);
  return true;
}

function visibleRow(state: ReferenceState): Omit<JobRow, "kind"> {
  return {
    key: JOB_KEY,
    status: state.status,
    attempts: state.attempts,
    fence: state.fence,
    worker: state.worker,
    output: state.output,
    outputFile: state.outputFile,
    error: state.error,
  };
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function expectedTrace(seed: number): unknown[] {
  let now = seed * 100;
  const state = emptyReference();
  const events: ReferenceEvent[] = [];
  appendEvent(events, now, "enqueued", null, 0);
  const trace: unknown[] = [];
  for (const op of operationSequence(seed)) {
    if (op.kind === "tick") now += op.amount;
    const result = applyReference(state, events, op, now);
    trace.push({ result, row: visibleRow(state), events: events.map((event) => ({ ...event })) });
  }
  return trace;
}

function actualResult(store: JobStore, op: Operation): unknown {
  switch (op.kind) {
    case "tick":
      return undefined;
    case "enqueue":
      return store.enqueue(JOB);
    case "claim": {
      const claim = store.claim(op.worker, []);
      return (
        claim && {
          key: claim.key,
          fence: claim.fence,
          worker: op.worker,
          leaseExpires: claim.leaseExpires,
        }
      );
    }
    case "heartbeat":
      return store.heartbeat(JOB_KEY, op.token.fence, op.token.worker);
    case "release":
      return store.release(JOB_KEY, op.token.fence, op.token.worker);
    case "complete":
      return store.complete(JOB_KEY, op.token.fence, op.token.worker, {
        file: `${op.token.fence}.jsonl`,
        sha256: op.result,
      });
    case "fail":
      return store.fail(
        JOB_KEY,
        op.token.fence,
        op.token.worker,
        `failure-${op.token.fence}`,
        op.retryable,
      );
    default: {
      const exhaustive: never = op;
      return exhaustive;
    }
  }
}

describe("independent one-job queue model campaign", () => {
  it("pins the precomputed reference campaign digest", () => {
    const transcript = Array.from({ length: SEEDS }, (_, index) => expectedTrace(index + 1));
    expect(hash(transcript)).toBe(
      "fb1066a84fea9af7da5ed1777605fd1f91b686c02d0ae34ed38bff233a1ae384",
    );
  });

  it.each(Array.from({ length: SEEDS }, (_, index) => index + 1))(
    "matches seeded 64-step reference model (seed %i)",
    (seed) => {
      let now = seed * 100;
      const store = new JobStore(":memory:", { now: () => now, leaseMs: LEASE_MS });
      const state = emptyReference();
      const events: ReferenceEvent[] = [];
      const coverage = {
        accepted: 0,
        stale: 0,
        expired: 0,
        retry: 0,
        released: 0,
        terminalFailure: 0,
      };
      try {
        expect(store.enqueue(JOB)).toEqual({ key: JOB_KEY, created: true });
        appendEvent(events, now, "enqueued", null, 0);
        let step = 0;
        for (const op of operationSequence(seed)) {
          step += 1;
          if (op.kind === "tick") now += op.amount;
          const expected = applyReference(state, events, op, now);
          const actual = actualResult(store, op);
          const actualState = store.get(JOB_KEY);
          const actualEvents = store.events(0);
          const label = `seed=${seed} step=${step} op=${JSON.stringify(op)} expected=${JSON.stringify({ result: expected, row: visibleRow(state) })} actual=${JSON.stringify({ result: actual, row: actualState })}`;
          expect(actual, label).toEqual(expected);
          expect(actualState, label).toMatchObject(visibleRow(state));
          expect(actualEvents, label).toEqual(events);
          expect(actualState?.attempts, label).toBeGreaterThanOrEqual(0);
          expect(actualState?.attempts, label).toBeLessThanOrEqual(JOB.maxAttempts!);
          expect(
            events.filter(({ type }) => type === "completed").length,
            label,
          ).toBeLessThanOrEqual(1);
          if (op.kind === "complete" && actual === true) coverage.accepted += 1;
          if (op.kind === "complete" && actual === false) coverage.stale += 1;
          if (events.some(({ type }) => type === "lease-expired")) coverage.expired += 1;
          if (op.kind === "fail" && actual === true && state.status === "ready")
            coverage.retry += 1;
          if (op.kind === "release" && actual === true) coverage.released += 1;
          if (op.kind === "fail" && actual === true && state.status === "failed")
            coverage.terminalFailure += 1;
        }
      } finally {
        store.close();
      }
      totalCoverage.accepted += coverage.accepted;
      totalCoverage.stale += coverage.stale;
      totalCoverage.expired += coverage.expired;
      totalCoverage.retry += coverage.retry;
      totalCoverage.released += coverage.released;
      totalCoverage.terminalFailure += coverage.terminalFailure;
    },
  );

  afterAll(() => {
    for (const count of Object.values(totalCoverage)) expect(count).toBeGreaterThan(0);
  });
});
