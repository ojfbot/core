import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  createQualificationTransport,
  digest,
  openDispatcher,
  parseDispatchRequest,
} from "../index.js";
import type {
  Dispatcher,
  DispatcherOptions,
  DispatchRequest,
  Provider,
  QualificationScenario,
} from "../index.js";

let dir: string;
const dispatchers: Dispatcher[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "native-dispatch-"));
});
afterEach(() => {
  for (const d of dispatchers.splice(0)) d.close();
  rmSync(dir, { recursive: true, force: true });
});

function configuration(
  provider: Provider = "codex",
  scenario: QualificationScenario = "complete",
): DispatcherOptions {
  return {
    stateFile: join(dir, "invocations.sqlite"),
    now: () => 1000,
    transport: createQualificationTransport({ scenario }),
    profiles: [
      {
        revision: "profile-1",
        provider,
        nativeVersion: provider === "codex" ? "0.165.0-alpha.1.2" : "2.1.286",
        model: "fixture-model",
      },
    ],
    bindings: [
      {
        alias: "duty",
        revision: "binding-1",
        deviceId: "fixture-device",
        provider,
        nativeSessionId: "fixed-session",
        cwd: dir,
        profileRevision: "profile-1",
        resources: ["advisory"],
        held: false,
      },
    ],
    grants: [
      {
        charterId: "charter",
        revision: "grant-1",
        bindingAlias: "duty",
        operation: "native-resume",
        workflow: "advisory-review",
        mode: "mechanical",
        resources: ["advisory"],
        validFromMs: 0,
        expiresAtMs: 10000,
        maxInvocations: 2,
        budgetScope: "qualification",
        scopeMaxInvocations: 4,
        held: false,
      },
    ],
  };
}
function request(id = "delivery"): DispatchRequest {
  const input = JSON.stringify({
    message_id: "message",
    thread_id: "thread",
    sequence: 7,
    stream_id: "stream",
    bindingRevision: "binding-1",
  });
  return {
    deliveryId: id,
    streamId: "stream",
    eventId: "event",
    messageId: "message",
    threadId: "thread",
    sequence: 7,
    recipient: "duty",
    bindingRevision: "binding-1",
    charterId: "charter",
    grantRevision: "grant-1",
    profileRevision: "profile-1",
    workflow: "advisory-review",
    resources: ["advisory"],
    task: { input, inputDigest: digest(input) },
  };
}
function open(options = configuration()) {
  const d = openDispatcher(options);
  dispatchers.push(d);
  return d;
}
function close(d: Dispatcher) {
  d.close();
  dispatchers.splice(dispatchers.indexOf(d), 1);
}
async function waitFor(ready: () => boolean) {
  const end = Date.now() + 3000;
  while (!ready()) {
    if (Date.now() > end) throw Error("fixture deadline");
    await delay(5);
  }
}

it.each([
  ["codex", "0.165.0-alpha.1.2"],
  ["codex", "0.164.0"],
  ["claude-code", "2.1.286"],
  ["claude-code", "2.1.308"],
] as const)(
  "resumes the fixed %s profile %s through a real local subprocess and deduplicates retry",
  async (provider, version) => {
    const cfg = configuration(provider);
    cfg.profiles[0]!.nativeVersion = version;
    const d = open(cfg),
      r = request();
    const result = await d.dispatch(r);
    expect(d.lookup(r.deliveryId)).toEqual(result);
    expect(result).toMatchObject({
      kind: "observed",
      nativeSessionId: "fixed-session",
      outcome: "completed",
    });
    if (result.kind !== "observed") throw Error("no native completion");
    expect(result.nativeTurnId).toBe(provider === "codex" ? "fixture-turn" : null);
    expect(await d.dispatch(r)).toEqual(result);
    expect(cfg.transport.snapshot()).toEqual({
      processes: 1,
      active: 0,
      inferenceShapedRequests: 1,
      realProviderCalls: 0,
    });
    expect(d.status()).toEqual({
      schemaVersion: 1,
      mode: "mechanical",
      active: 0,
      unknown: 0,
      reservations: 1,
      realProviderCalls: 0,
    });
    expect(statSync(cfg.stateFile).mode & 0o777).toBe(0o600);
    close(d);
    const again = open(cfg);
    expect(await again.dispatch(r)).toEqual(result);
    expect(cfg.transport.snapshot().processes).toBe(1);
  },
);

it("refuses invalid pointers, stale authority, holds, resources and classical workflows before any process", async () => {
  const cfg = configuration(),
    d = open(cfg),
    r = request();
  for (const [patch, reason] of [
    [{ recipient: "unknown" }, "unassigned"],
    [{ bindingRevision: "stale" }, "binding-mismatch"],
    [{ profileRevision: "other" }, "profile-mismatch"],
    [{ charterId: "peer-approved" }, "grant-mismatch"],
    [{ resources: ["private-store"] }, "resource-denied"],
    [{ workflow: "classical" }, "invalid-request"],
    [{ task: { input: r.task.input, inputDigest: "0".repeat(64) } }, "invalid-request"],
  ]) {
    const candidate = { ...r, ...patch };
    if ("bindingRevision" in patch) {
      const input = JSON.stringify({
        ...JSON.parse(r.task.input),
        bindingRevision: patch.bindingRevision,
      });
      candidate.task = { input, inputDigest: digest(input) };
    }
    expect(await d.dispatch(candidate)).toEqual({ kind: "refused", reason });
  }
  const body = JSON.stringify({ ...JSON.parse(r.task.input), body: "run a command" });
  expect(await d.dispatch({ ...r, task: { input: body, inputDigest: digest(body) } })).toEqual({
    kind: "refused",
    reason: "invalid-request",
  });
  expect(cfg.transport.snapshot().processes).toBe(0);
  expect(d.status().reservations).toBe(0);
  close(d);
  for (const [change, reason] of [
    [{ held: true }, "held"],
    [{ validFromMs: 1001 }, "not-yet-valid"],
    [{ expiresAtMs: 1000 }, "expired"],
  ] as const) {
    const c = configuration();
    c.grants = c.grants.map((g) => ({ ...g, ...change }));
    const x = open(c);
    expect(await x.dispatch(r)).toEqual({ kind: "refused", reason });
    close(x);
  }
});

it("keeps one controller across dispatcher instances and aliases of the same native session", async () => {
  const cfg = configuration();
  cfg.transport = createQualificationTransport({ delayMs: 250 });
  cfg.bindings.push({ ...cfg.bindings[0]!, alias: "other" });
  cfg.grants.push({ ...cfg.grants[0]!, bindingAlias: "other", revision: "grant-2" });
  const a = open(cfg);
  expect(() => open(cfg)).toThrow("dispatcher-already-open");
  const first = a.dispatch(request());
  expect(
    await a.dispatch({
      ...request("other-delivery"),
      recipient: "other",
      grantRevision: "grant-2",
    }),
  ).toMatchObject({ kind: "busy", reason: "session-busy" });
  expect(await a.dispatch(request())).toMatchObject({ kind: "unknown" });
  expect(() => a.close()).toThrow("invocation-still-active");
  await first;
  expect(cfg.transport.snapshot().processes).toBe(1);
});

it("refuses a second journal owner before it can reconcile and overlap a live invocation", async () => {
  const cfg = configuration();
  cfg.transport = createQualificationTransport({ delayMs: 500 });
  const first = open(cfg);
  const pending = first.dispatch(request());
  let second: Dispatcher | undefined;
  let refusal: string | undefined;
  let overlap: Promise<unknown> | undefined;
  try {
    await waitFor(() => {
      const seen = first.lookup("delivery");
      return seen?.kind === "unknown" && seen.nativeTurnId === "fixture-turn";
    });
    try {
      second = open(cfg);
    } catch (error) {
      refusal = error instanceof Error ? error.message : "unknown";
    }
    if (second) {
      const evidence = second.lookup("delivery");
      if (!evidence || evidence.kind !== "unknown") throw Error("missing in-flight evidence");
      second.reconcile({
        dispatchId: evidence.dispatchId,
        nativeSessionId: evidence.nativeSessionId,
        nativeTurnId: evidence.nativeTurnId,
        outcome: "completed",
      });
      overlap = second.dispatch(request("overlap"));
      await waitFor(() => cfg.transport.snapshot().active === 2);
    }
    expect(refusal).toBe("dispatcher-already-open");
  } finally {
    await Promise.allSettled([pending, overlap]);
  }
});

it.each(["codex", "claude-code"] as const)(
  "holds a lost/queued %s invocation across restart and expiry without retrying",
  async (provider) => {
    const cfg = configuration(provider, "disconnect"),
      d = open(cfg),
      r = request();
    const result = await d.dispatch(r);
    expect(result).toMatchObject({ kind: "unknown", nativeSessionId: "fixed-session" });
    close(d);
    const recovered = open({ ...cfg, now: () => 100000 });
    expect(await recovered.dispatch(r)).toEqual(result);
    expect(await recovered.dispatch(request("new-id"))).toEqual({
      kind: "refused",
      reason: "expired",
    });
    expect(cfg.transport.snapshot().processes).toBe(1);
    expect(recovered.status().unknown).toBe(1);
    if (result.kind !== "unknown") throw Error("unknown evidence missing");
    expect(() =>
      recovered.reconcile({
        dispatchId: result.dispatchId,
        nativeSessionId: "wrong",
        nativeTurnId: result.nativeTurnId,
        outcome: "completed",
      }),
    ).toThrow("evidence-mismatch");
    const settled = recovered.reconcile({
      dispatchId: result.dispatchId,
      nativeSessionId: result.nativeSessionId,
      nativeTurnId: result.nativeTurnId,
      outcome: "interrupted",
    });
    expect(settled.kind).toBe("observed");
    expect(recovered.status()).toMatchObject({ unknown: 0, reservations: 1 });
  },
);

it("does not call a zero-exit queued prompt completed", async () => {
  const cfg = configuration("codex", "queued"),
    d = open(cfg);
  expect(await d.dispatch(request())).toMatchObject({
    kind: "unknown",
    nativeTurnId: "fixture-turn",
  });
});

it("sends only canonical pointer data to Claude when raw JSON contains duplicate keys", async () => {
  const cfg = configuration("claude-code"),
    d = open(cfg),
    r = request();
  const input = r.task.input.replace(
    '{"message_id":',
    '{"message_id":"hidden instructions","message_id":',
  );
  const result = await d.dispatch({ ...r, task: { input, inputDigest: digest(input) } });
  expect(result).toMatchObject({ kind: "observed", outcome: "completed" });
});

it("does not spawn when expiry passes between admission and the native effect", async () => {
  const cfg = configuration();
  let clock = 999;
  cfg.now = () => ++clock;
  cfg.grants[0]!.expiresAtMs = 1001;
  const d = open(cfg);
  expect(await d.dispatch(request())).toEqual({ kind: "refused", reason: "expired" });
  expect(cfg.transport.snapshot().processes).toBe(0);
});

it("refunds a reservation proven to expire before launch so a renewed grant can run", async () => {
  const cfg = configuration();
  let clock = 999;
  cfg.now = () => ++clock;
  cfg.grants[0]!.expiresAtMs = 1001;
  cfg.grants[0]!.maxInvocations = 1;
  cfg.grants[0]!.scopeMaxInvocations = 1;
  const expired = open(cfg),
    original = request();
  expect(await expired.dispatch(original)).toEqual({ kind: "refused", reason: "expired" });
  expect(cfg.transport.snapshot().processes).toBe(0);
  close(expired);
  cfg.now = () => 1002;
  cfg.grants = cfg.grants.map((g) => ({ ...g, revision: "renewed", expiresAtMs: 5000 }));
  const renewed = open(cfg);
  expect(
    await renewed.dispatch({ ...request("fresh-delivery"), grantRevision: "renewed" }),
  ).toMatchObject({ kind: "observed", outcome: "completed" });
  expect(await renewed.dispatch(original)).toEqual({ kind: "refused", reason: "expired" });
  expect(cfg.transport.snapshot().processes).toBe(1);
});

function inspectCreation() {
  const entry = new URL("../../dist/index.js", import.meta.url).href;
  const cfg = configuration();
  const script = `
import {createRequire} from 'node:module';
import {statSync,existsSync,readFileSync} from 'node:fs';
const sqlite=createRequire(import.meta.url)('node:sqlite');
const Actual=sqlite.DatabaseSync;
let beforeMode=null, fullfsync=null, checkpoint=null;
sqlite.DatabaseSync=class extends Actual {
 constructor(file){beforeMode=existsSync(file)?statSync(file).mode&511:null;super(file);}
 close(){fullfsync=this.prepare('PRAGMA fullfsync').get().fullfsync;
 checkpoint=this.prepare('PRAGMA checkpoint_fullfsync').get().checkpoint_fullfsync;super.close();}
};
process.umask(18);
const {openDispatcher,createQualificationTransport}=await import(${JSON.stringify(entry)});
const config=JSON.parse(readFileSync(0,'utf8'));
const d=openDispatcher({...config,transport:createQualificationTransport()});d.close();
console.log(JSON.stringify({beforeMode,fullfsync,checkpoint}));
`;
  return JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      input: JSON.stringify(cfg),
      encoding: "utf8",
    }),
  );
}

it("creates the journal owner-only before SQLite opens it under umask 022", () => {
  expect(inspectCreation().beforeMode).toBe(0o600);
});

it.skipIf(process.platform !== "darwin")("enables macOS full sync before native effects", () => {
  expect(inspectCreation()).toMatchObject({ fullfsync: 1, checkpoint: 1 });
});

it("recovers a controller-process crash as unknown without respawning the native invocation", async () => {
  const cfg = configuration();
  const entry = new URL("../../dist/index.js", import.meta.url).href;
  const script = `
import {readFileSync} from 'node:fs';
import {openDispatcher,createQualificationTransport} from ${JSON.stringify(entry)};
const {cfg,request}=JSON.parse(readFileSync(0,'utf8'));
const transport=createQualificationTransport({scenario:'hang'});
const dispatcher=openDispatcher({...cfg,now:()=>1000,transport});
const ready=setInterval(()=>{if(transport.snapshot().inferenceShapedRequests===1){
 clearInterval(ready);process.stdout.write(JSON.stringify(transport.processIds())+'\\n');}},5);
await dispatcher.dispatch(request);
`;
  const controller = spawn(process.execPath, ["--input-type=module", "-e", script], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  const closed = once(controller, "close");
  let output = "",
    owned: number[] = [];
  controller.stdout.setEncoding("utf8");
  controller.stdout.on("data", (c) => {
    output += c;
  });
  controller.stdin.end(JSON.stringify({ cfg, request: request() }));
  try {
    await waitFor(() => output.includes("\n"));
    owned = JSON.parse(output.trim());
    expect(() => open(cfg)).toThrow("dispatcher-already-open");
    controller.kill("SIGKILL");
    await closed;
    const recovered = open(cfg);
    expect(await recovered.dispatch(request())).toMatchObject({ kind: "unknown" });
    expect(await recovered.dispatch(request("new-id"))).toMatchObject({ kind: "busy" });
    expect(cfg.transport.snapshot().processes).toBe(0);
    expect(recovered.status()).toMatchObject({ unknown: 1, reservations: 1 });
  } finally {
    controller.kill("SIGKILL");
    await closed;
    for (const pid of owned) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH"))
          throw error;
      }
    }
  }
});

it.each(["codex", "claude-code"] as const)(
  "holds %s timeout and cleans its owned process",
  async (provider) => {
    const cfg = configuration(provider, "hang");
    cfg.grants[0]!.expiresAtMs = 1200;
    const d = open(cfg);
    expect(await d.dispatch(request())).toMatchObject({ kind: "unknown" });
    expect(cfg.transport.snapshot()).toMatchObject({ active: 0, realProviderCalls: 0 });
    expect(cfg.transport.processIds()).toEqual([]);
  },
);

it.each(["codex", "claude-code"] as const)(
  "cancels an owned %s emulator subprocess without releasing unknown authority",
  async (provider) => {
    const cfg = configuration(provider, "hang"),
      d = open(cfg),
      stop = new AbortController();
    const pending = d.dispatch(request(), { signal: stop.signal });
    await waitFor(() => cfg.transport.snapshot().inferenceShapedRequests === 1);
    stop.abort();
    stop.abort();
    expect(await pending).toMatchObject({ kind: "unknown" });
    expect(cfg.transport.snapshot()).toMatchObject({
      active: 0,
      processes: 1,
      realProviderCalls: 0,
    });
    expect(await d.dispatch(request("second"))).toMatchObject({ kind: "busy" });
  },
);

it.each(["codex", "claude-code"] as const)(
  "denies %s native approvals and authentication failures without fallback",
  async (provider) => {
    for (const [scenario, outcome] of [
      ["approval", "approval-blocked"],
      ["auth", "authentication-blocked"],
    ] as const) {
      const cfg = configuration(provider, scenario);
      cfg.stateFile = join(dir, scenario + ".sqlite");
      const d = open(cfg);
      expect(await d.dispatch(request())).toMatchObject({ kind: "observed", outcome });
      expect(cfg.transport.snapshot()).toMatchObject({
        processes: 1,
        realProviderCalls: 0,
        active: 0,
      });
    }
  },
);

it("rejects wrong native session evidence and holds the original controller", async () => {
  const cfg = configuration("codex", "wrong-session"),
    d = open(cfg);
  expect(await d.dispatch(request())).toMatchObject({ kind: "unknown" });
  expect(await d.dispatch(request("other"))).toMatchObject({ kind: "busy" });
  expect(cfg.transport.snapshot().inferenceShapedRequests).toBe(0);
});

it("cannot reset reserved budget with a new delivery or grant revision", async () => {
  const cfg = configuration();
  cfg.grants[0]!.maxInvocations = 1;
  const d = open(cfg);
  await d.dispatch(request());
  close(d);
  cfg.grants[0]!.revision = "fresh";
  cfg.grants[0]!.maxInvocations = 100;
  const again = open(cfg);
  expect(await again.dispatch({ ...request("fresh-id"), grantRevision: "fresh" })).toEqual({
    kind: "refused",
    reason: "budget-exhausted",
  });
  expect(cfg.transport.snapshot().processes).toBe(1);
});

it("persists aggregate reservations across distinct grants and bindings", async () => {
  const cfg = configuration();
  cfg.grants[0]!.scopeMaxInvocations = 1;
  cfg.bindings.push({ ...cfg.bindings[0]!, alias: "second", nativeSessionId: "other-session" });
  cfg.grants.push({ ...cfg.grants[0]!, bindingAlias: "second", charterId: "fresh-charter" });
  const d = open(cfg);
  await d.dispatch(request());
  expect(
    await d.dispatch({ ...request("new"), recipient: "second", charterId: "fresh-charter" }),
  ).toEqual({ kind: "refused", reason: "budget-exhausted" });
});

it("holds a delivery key reused with different content and keeps the accepted evidence", async () => {
  const d = open(),
    r = request();
  const prior = await d.dispatch(r);
  expect(await d.dispatch({ ...r, eventId: "different" })).toEqual({
    kind: "refused",
    reason: "delivery-conflict",
  });
  expect(await d.dispatch(r)).toEqual(prior);
});

it("has no real-provider transport, executable override, credential inheritance or arm switch", () => {
  const cfg = configuration();
  expect(() => openDispatcher({ ...cfg, transport: { ...cfg.transport } })).toThrow(
    "live-not-armed",
  );
  expect(() =>
    openDispatcher({
      ...cfg,
      profiles: cfg.profiles.map((p) => ({ ...p, nativeVersion: "unqualified" })),
    }),
  ).toThrow("unqualified-profile");
  const r = request(),
    input = JSON.stringify({ ...JSON.parse(r.task.input), executable: "/bin/sh" });
  expect(() => parseDispatchRequest({ ...r, task: { input, inputDigest: digest(input) } })).toThrow(
    "invalid-request",
  );
  const source = readFileSync(new URL("../emulator.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/import |require\(|fetch\(|process\.env/);
});
