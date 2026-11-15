import {
  appendFileSync,
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  digest,
  openDispatcher,
  createQualificationTransport,
  prepareSupervisedSubscriptionCanary,
  openSupervisedSubscriptionCanary,
  SUBSCRIPTION_CANARY_FIXTURE,
  SUBSCRIPTION_CANARY_FIXTURE_SHA256,
} from "../index.js";
import { supervisedCommand } from "../supervised-native.js";
import {
  checkBinary,
  checkNativeProfile,
  managedPreferenceAbsent,
  readPrivateFile,
} from "../supervised-files.js";
import type { Dispatcher, PreparedSupervisedCanary, DispatchRequest } from "../index.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});
vi.mock("../supervised-files.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../supervised-files.js")>();
  return {
    ...actual,
    checkBinary: vi.fn(actual.checkBinary),
    checkNativeProfile: vi.fn(actual.checkNativeProfile),
    readPrivateFile: vi.fn(actual.readPrivateFile),
  };
});
const qualification = vi.mocked(checkNativeProfile).getMockImplementation();
if (!qualification) throw Error("missing profile qualification seam");
const qualifyOriginal = qualification;
const binaryOriginal = vi.mocked(checkBinary).getMockImplementation();
if (!binaryOriginal) throw Error("missing binary verifier");
const readOriginal = vi.mocked(readPrivateFile).getMockImplementation();
if (!readOriginal) throw Error("missing private reader");
let dir: string,
  acl = false;
const active: Dispatcher[] = [];
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const realProcess = process;
const native = vi.mocked(spawnSync).getMockImplementation();
if (!native) throw Error("missing native fixture seam");
const spawnOriginal = native;
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "supervised-fixture-")));
  acl = false;
  vi.spyOn(Date, "now").mockReturnValue(1001);
  // The journal/transport contract tests explicitly simulate qualified synthetic providers.
  vi.mocked(checkNativeProfile).mockImplementation(() => {});
  vi.stubGlobal(
    "process",
    new Proxy(realProcess, {
      get(target, key) {
        return key === "platform" ? "darwin" : Reflect.get(target, key);
      },
    }),
  );
  vi.mocked(spawnSync).mockImplementation((file, args, options) => {
    if (file === "/bin/ls")
      return {
        pid: 0,
        output: [],
        status: 0,
        signal: null,
        stdout: "drwx------ 1 fixture\n" + (acl ? " 0: user:other allow write\n" : ""),
        stderr: "",
      };
    if (file === "/usr/bin/defaults")
      return {
        pid: 0,
        output: [],
        status: 1,
        signal: null,
        stdout: "",
        stderr: args?.[2]
          ? `The domain/default pair of (${args[1]}, ${args[2]}) does not exist\n`
          : `Domain ${args?.[1]} does not exist\n`,
      };
    return spawnOriginal(file, args, options);
  });
});
afterEach(() => {
  for (const d of active.splice(0)) d.close();
  vi.unstubAllGlobals();
  vi.mocked(spawnSync).mockImplementation(spawnOriginal);
  vi.mocked(checkNativeProfile).mockImplementation(qualifyOriginal);
  vi.mocked(checkBinary).mockImplementation(binaryOriginal);
  vi.mocked(readPrivateFile).mockImplementation(readOriginal);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

// Synthetic providers only. These subprocesses have no provider SDK, network or credentials.
const program = `
const fs = require('node:fs');
const args = process.argv.slice(2), claude = process.argv[1].includes('claude');
if (args.includes('--version')) {console.log(claude?'2.1.286 (Claude Code)':'codex-cli 0.165.0-alpha.1.2');process.exit(0);}
if (args.includes('--print-startup-config')) {console.log(JSON.stringify({appServerVersion:'0.165.0-alpha.1.2',configRequirements:{requirements:null}}));process.exit(0);}
if (args.includes('--help')) { console.log('--ignore-user-config --ignore-rules --json --safe-mode --setting-sources --tools --strict-mcp-config --session-id --json-schema --permission-prompts'); process.exit(0); }
let data=''; process.stdin.on('data',x=>data+=x); process.stdin.on('end',()=>{
 const x=JSON.parse(data), expected=claude?args[args.indexOf('--session-id')+1]:args[args.length-2], id=fs.existsSync('REPLACE_MODE')?'00000000-0000-4000-8000-000000009999':expected;
 fs.appendFileSync(${JSON.stringify("REPLACE_COUNT")},'1');
 fs.writeFileSync('REPLACE_ENV',JSON.stringify({HOME:process.env.HOME,CODEX_HOME:process.env.CODEX_HOME,TMPDIR:process.env.TMPDIR,USER:process.env.USER,LOGNAME:process.env.LOGNAME}));
 const out={ack:{messageId:x.pointer.message_id,bindingRevision:x.pointer.bindingRevision,fixtureDigest:x.advisoryFixture.sha256},result:{text:'The observations remain separate.'}};
 const emit=m=>console.log(JSON.stringify(m));
 if(claude){emit({type:'system',subtype:'init',session_id:id,model:args[args.indexOf('--model')+1],tools:[],mcp_servers:[]});emit({type:'result',session_id:id,is_error:false,structured_output:out});}
 else {emit({type:'thread.started',thread_id:id});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(out)}});emit({type:'turn.completed'});}
});
`;
function plan(): PreparedSupervisedCanary {
  const profiles = ["codex", "claude-code"].map((provider) => {
    const binary = join(dir, provider === "codex" ? "codex-fixture" : "claude-fixture");
    const js = binary + ".cjs";
    writeFileSync(
      js,
      program
        .replace("REPLACE_COUNT", join(dir, "launch-count"))
        .replace("REPLACE_ENV", join(dir, "child-environment.json"))
        .replace("REPLACE_MODE", join(dir, "wrong-session")),
    );
    writeFileSync(binary, `#!/bin/sh\nexec '${process.execPath}' '${js}' "$@"\n`, { mode: 0o700 });
    return {
      provider,
      revision: provider + "-1",
      binaryRealPath: binary,
      binarySHA256: createHash("sha256").update(readFileSync(binary)).digest("hex"),
      nativeVersion: provider === "codex" ? "0.165.0-alpha.1.2" : "2.1.286",
      model: provider + "-model",
      effort: "low",
      authMode: "existing-subscription",
      customizationPolicy: "none",
    };
  });
  const bindings = profiles.map((p, i) => {
    const cwd = join(dir, "empty-" + i);
    mkdirSync(cwd, { mode: 0o700 });
    return {
      alias: p.provider + "-duty",
      revision: "binding-" + i,
      deviceId: "fixture-device",
      provider: p.provider,
      profileRevision: p.revision,
      nativeSessionId: uuid(i + 1),
      sessionPolicy: p.provider === "codex" ? "existing-fixed" : "initial-fixed",
      cwd,
      resources: ["advisory"],
    };
  });
  return prepareSupervisedSubscriptionCanary({
    schemaVersion: 1,
    revision: "plan-1",
    windowId: "window-1",
    deviceId: "fixture-device",
    profiles,
    bindings,
    fixture: { utf8: SUBSCRIPTION_CANARY_FIXTURE, sha256: SUBSCRIPTION_CANARY_FIXTURE_SHA256 },
    limits: { topLevelTurns: 2, windowMs: 1800000, requestTimeoutMs: 120000 },
    declaredUnproved: ["dollars", "outputTokens", "providerInternalRequests"],
    supervision: { kind: "owner-attended", codexHostFileReadRiskAccepted: true },
    environment: {
      HOME: process.env.HOME,
      CODEX_HOME: process.env.CODEX_HOME ?? null,
      TMPDIR: process.env.TMPDIR ?? null,
    },
  });
}
function options(prepared = plan()) {
  return {
    prepared,
    stateFile: join(dir, "state.sqlite"),
    runtimeApprovalFile: join(dir, "approval.json"),
    deviceId: "fixture-device",
  };
}
function approve(o: ReturnType<typeof options>) {
  writeFileSync(
    o.runtimeApprovalFile,
    JSON.stringify({
      kind: "owner-approved-supervised-canary",
      planDigest: o.prepared.planDigest,
      windowId: o.prepared.plan.windowId,
      deviceId: o.deviceId,
      startsAtMs: 1000,
      expiresAtMs: 1801000,
      ownerNativeApprovalRef: "synthetic-only",
      invocationStateFile: o.stateFile,
    }),
    { mode: 0o600 },
  );
}
function request(p: PreparedSupervisedCanary, index: number, n = index + 10): DispatchRequest {
  const b = p.plan.bindings[index];
  if (!b) throw Error("binding");
  const pointer = {
    message_id: uuid(n),
    thread_id: uuid(90),
    stream_id: uuid(80),
    sequence: n,
    bindingRevision: b.revision,
  };
  const input = JSON.stringify(pointer);
  return {
    deliveryId: digest("delivery-" + n),
    eventId: uuid(n + 100),
    messageId: pointer.message_id,
    threadId: pointer.thread_id,
    streamId: pointer.stream_id,
    sequence: n,
    recipient: b.alias,
    bindingRevision: b.revision,
    charterId: p.plan.windowId,
    grantRevision: digest(JSON.stringify([p.planDigest, b.alias])),
    profileRevision: b.profileRevision,
    workflow: "advisory-review",
    resources: ["advisory"],
    task: { input, inputDigest: digest(input) },
  };
}
function open(o: ReturnType<typeof options>) {
  const r = openSupervisedSubscriptionCanary(o);
  if (r.kind !== "ready") throw Error(JSON.stringify(r));
  active.push(r.dispatcher);
  return r.dispatcher;
}

it("requires the explicit supervised risk and never upgrades a prepared object by boolean", () => {
  const p = plan();
  expect(p.liveEligible).toBe(false);
  expect(() =>
    prepareSupervisedSubscriptionCanary({
      ...p.plan,
      supervision: { kind: "owner-attended", codexHostFileReadRiskAccepted: false },
    }),
  ).toThrow("invalid-supervised-plan");
});
it("holds an unqualified Codex binary/model tuple even when declared version and static controls match", () => {
  const p = plan();
  const codex = p.plan.profiles.find((x) => x.provider === "codex");
  if (!codex) throw Error("fixture");
  expect(() => qualifyOriginal(codex)).toThrow("native-profile-unqualified");
  vi.mocked(checkNativeProfile).mockImplementation(qualifyOriginal);
  const o = options(p);
  approve(o);
  expect(openSupervisedSubscriptionCanary(o)).toMatchObject({
    kind: "held",
    holds: ["native-profile-unqualified"],
  });
});
const revokedCodexProfiles = [
  {
    nativeVersion: "0.165.0-alpha.1.2",
    binarySHA256: "d84a54b031085f01e3ad915ea7c72ebea4dcf69e90f0d1e0e4a637e8280991d2",
  },
  {
    nativeVersion: "0.164.0",
    binarySHA256: "d8990e3ee7acfbc26f91265b12a1a83f0fee40d0e0f8f1f40a37d4ec21f499cf",
  },
] as const;
function revokedPlan(pin: (typeof revokedCodexProfiles)[number]) {
  const p = plan();
  const profiles = p.plan.profiles.map((profile) =>
    profile.provider === "codex" ? { ...profile, ...pin, model: "gpt-6.1-sol" } : profile,
  );
  const codex = profiles.find((profile) => profile.provider === "codex");
  if (!codex) throw Error("fixture");
  const fixture = codex.binaryRealPath + ".cjs";
  writeFileSync(
    fixture,
    readFileSync(fixture, "utf8").replaceAll("0.165.0-alpha.1.2", pin.nativeVersion),
  );
  return prepareSupervisedSubscriptionCanary({ ...p.plan, profiles });
}
it.each(revokedCodexProfiles)(
  "revokes subscription Codex $nativeVersion before any native probe",
  (pin) => {
    const p = revokedPlan(pin).plan.profiles.find((profile) => profile.provider === "codex");
    if (!p) throw Error("fixture");
    expect(() => qualifyOriginal(p)).toThrow("native-profile-unqualified");
    expect(spawnSync).not.toHaveBeenCalled();
  },
);
it.each(revokedCodexProfiles)(
  "holds the public opener for revoked subscription Codex $nativeVersion before creating a journal",
  (pin) => {
    const prepared = revokedPlan(pin),
      o = options(prepared);
    approve(o);
    // Synthetic files stand in for the declared pins; the production qualification gate stays real.
    vi.mocked(checkBinary).mockImplementation(() => {});
    vi.mocked(checkNativeProfile).mockImplementation(qualifyOriginal);
    expect(track(openSupervisedSubscriptionCanary(o))).toMatchObject({
      kind: "held",
      holds: ["native-profile-unqualified"],
    });
    expect(existsSync(o.stateFile)).toBe(false);
    expect(existsSync(join(dir, "launch-count"))).toBe(false);
    expect(vi.mocked(spawnSync).mock.calls.filter(([file]) => file !== "/bin/ls")).toEqual([]);
  },
);
const defaultsMetadata = "2026-11-14 20:50:44.116 defaults[32951:443163311] \n";
it.each([
  {
    name: "legacy domain",
    provider: "claude-code",
    text: (domain: string) => `Domain ${domain} does not exist\n`,
  },
  {
    name: "legacy key",
    provider: "codex",
    text: (domain: string, key: string | undefined) =>
      `The domain/default pair of (${domain}, ${key}) does not exist\n`,
  },
  {
    name: "timestamped legacy domain",
    provider: "claude-code",
    text: (domain: string) => `${defaultsMetadata}Domain ${domain} does not exist\n`,
  },
  {
    name: "timestamped legacy key",
    provider: "codex",
    text: (domain: string, key: string | undefined) =>
      `${defaultsMetadata}The domain/default pair of (${domain}, ${key}) does not exist\n`,
  },
  {
    name: "quoted domain",
    provider: "claude-code",
    text: (domain: string) => `Error: Domain '${domain}' not found.\n`,
  },
  {
    name: "quoted key",
    provider: "codex",
    text: (domain: string, key: string | undefined) =>
      `Error: Could not find key '${key}' in domain '${domain}'.\n`,
  },
] as const)("accepts exact managed-preference absence: $name", ({ provider, text }) => {
  const domain = provider === "codex" ? "com.openai.codex" : "com.anthropic.claudecode";
  const keys =
    provider === "codex" ? ["config_toml_base64", "requirements_toml_base64"] : [undefined];
  for (const key of keys)
    expect(
      managedPreferenceAbsent({ domain, key, result: { status: 1, stderr: text(domain, key) } }),
    ).toBe(true);
});
it.each([
  { name: "generic absence", text: "Domain does not exist" },
  {
    name: "wrong legacy domain",
    text: "The domain/default pair of (other.domain, config_toml_base64) does not exist",
  },
  {
    name: "wrong legacy key",
    text: "The domain/default pair of (com.openai.codex, other_key) does not exist",
  },
  { name: "wrong quoted domain", text: "Error: Domain 'other.domain' not found." },
  {
    name: "wrong quoted key",
    text: "Error: Could not find key 'other_key' in domain 'com.openai.codex'.",
  },
  { name: "unexpected diagnostic", text: "Error: Could not read preferences." },
  {
    name: "additional diagnostic",
    text: "Domain com.openai.codex does not exist\nError: Permission denied.",
  },
  {
    name: "unknown metadata prefix",
    text: "unknown defaults[1:2]\nDomain com.openai.codex does not exist",
  },
  { name: "present setting", text: "Domain com.openai.codex does not exist", status: 0 },
  {
    name: "timeout",
    text: "Domain com.openai.codex does not exist",
    status: null,
    error: new Error("ETIMEDOUT"),
  },
  {
    name: "spawn error",
    text: "Domain com.openai.codex does not exist",
    status: 1,
    error: new Error("EIO"),
  },
])("holds unproved managed-preference absence: $name", (test) => {
  const status = "status" in test ? test.status : 1;
  const error = "error" in test ? test.error : undefined;
  expect(
    managedPreferenceAbsent({
      domain: "com.openai.codex",
      key: "config_toml_base64",
      result: { status, error, stderr: test.text },
    }),
  ).toBe(false);
});
it("holds missing, foreign-device, loose, ACL-bearing, expired and wrong-plan approval without launching a provider", () => {
  const o = options();
  expect(openSupervisedSubscriptionCanary(o)).toMatchObject({
    kind: "held",
    holds: ["runtime-approval-missing"],
  });
  approve(o);
  expect(openSupervisedSubscriptionCanary({ ...o, deviceId: "other-device" })).toMatchObject({
    kind: "held",
    holds: ["device-mismatch"],
  });
  chmodSync(o.runtimeApprovalFile, 0o620);
  expect(openSupervisedSubscriptionCanary(o)).toMatchObject({
    kind: "held",
    holds: ["runtime-approval-invalid"],
  });
  chmodSync(o.runtimeApprovalFile, 0o600);
  acl = true;
  expect(openSupervisedSubscriptionCanary(o)).toMatchObject({
    kind: "held",
    holds: ["acl-unqualified"],
  });
  acl = false;
  vi.mocked(Date.now).mockReturnValue(1801000);
  expect(openSupervisedSubscriptionCanary(o)).toMatchObject({
    kind: "held",
    holds: ["window-not-active"],
  });
  vi.mocked(Date.now).mockReturnValue(1001);
  const wrong = JSON.parse(readFileSync(o.runtimeApprovalFile, "utf8"));
  wrong.planDigest = "0".repeat(64);
  writeFileSync(o.runtimeApprovalFile, JSON.stringify(wrong));
  expect(openSupervisedSubscriptionCanary(o)).toMatchObject({
    kind: "held",
    holds: ["runtime-approval-invalid"],
  });
});
it("runs only synthetic providers through the shared engine; identical retries and restarts reuse evidence", async () => {
  const o = options();
  approve(o);
  const d = open(o);
  for (const i of [0, 1]) {
    const r = request(o.prepared, i),
      result = await d.dispatch(r);
    expect(result).toMatchObject({ kind: "observed", outcome: "completed" });
    expect(d.agentProposal(r.deliveryId)).toMatchObject({
      source: "supervised-native",
      verifiedWork: false,
    });
    expect(await d.dispatch(r)).toEqual(result);
    expect(await d.dispatch(request(o.prepared, i, i + 50))).toEqual({
      kind: "refused",
      reason: "budget-exhausted",
    });
  }
  expect(readFileSync(join(dir, "launch-count"), "utf8")).toBe("11");
  expect(d.status()).toMatchObject({
    mode: "supervised",
    realProviderCalls: null,
    reservations: 2,
    unknown: 0,
  });
  d.close();
  active.splice(active.indexOf(d), 1);
  const again = open(o);
  expect(await again.dispatch(request(o.prepared, 0))).toMatchObject({ kind: "observed" });
  expect(readFileSync(join(dir, "launch-count"), "utf8")).toBe("11");
});
it("keeps uncertain native effects spent across retry and restart without manufacturing a reply", async () => {
  const o = options();
  approve(o);
  writeFileSync(join(dir, "wrong-session"), "1");
  const d = open(o),
    r = request(o.prepared, 0),
    first = await d.dispatch(r);
  expect(first).toMatchObject({
    kind: "unknown",
    nativeSessionId: o.prepared.plan.bindings[0]?.nativeSessionId,
  });
  expect(d.agentProposal(r.deliveryId)).toBeUndefined();
  expect(await d.dispatch(r)).toEqual(first);
  d.close();
  active.splice(active.indexOf(d), 1);
  const again = open(o);
  expect(await again.dispatch(r)).toEqual(first);
  expect(await again.dispatch(request(o.prepared, 1, 99))).toMatchObject({
    kind: "busy",
    reason: "session-busy",
  });
  expect(readFileSync(join(dir, "launch-count"), "utf8")).toBe("1");
});
it("rechecks an owner window after opening and does not launch after expiry", async () => {
  const o = options();
  approve(o);
  const d = open(o);
  vi.mocked(Date.now).mockReturnValue(1801000);
  expect(await d.dispatch(request(o.prepared, 0))).toEqual({ kind: "refused", reason: "expired" });
  expect(d.status().reservations).toBe(0);
});
it("does not arm the public mechanical entry with a supervised grant", async () => {
  const o = options();
  const b = o.prepared.plan.bindings[0],
    p = o.prepared.plan.profiles[0];
  if (!b || !p) throw Error("fixture");
  const d = openDispatcher({
    stateFile: join(dir, "mechanical.sqlite"),
    transport: createQualificationTransport(),
    bindings: [{ ...b, held: false }],
    profiles: [p],
    now: () => 1001,
    grants: [
      {
        charterId: o.prepared.plan.windowId,
        revision: digest(JSON.stringify([o.prepared.planDigest, b.alias])),
        bindingAlias: b.alias,
        operation: "native-resume",
        workflow: "advisory-review",
        mode: "supervised",
        resources: ["advisory"],
        validFromMs: 1000,
        expiresAtMs: 1801000,
        maxInvocations: 1,
        budgetScope: "supervised-test",
        scopeMaxInvocations: 2,
        held: false,
      },
    ],
  });
  active.push(d);
  expect(d.status()).toMatchObject({ mode: "mechanical", realProviderCalls: 0 });
  expect(await d.dispatch(request(o.prepared, 0))).toEqual({
    kind: "refused",
    reason: "live-not-armed",
  });
  expect(d.status().reservations).toBe(0);
});
function track(result: ReturnType<typeof openSupervisedSubscriptionCanary>) {
  if (result.kind === "ready") active.push(result.dispatcher);
  return result;
}

it("uses wall-clock expiry even if a caller supplies an old injected clock", () => {
  const o = options();
  approve(o);
  vi.mocked(Date.now).mockReturnValue(1801000);
  const oldClock = { ...o, now: () => 1001 };
  expect(track(openSupervisedSubscriptionCanary(oldClock))).toMatchObject({
    kind: "held",
    holds: ["window-not-active"],
  });
});
it("binds the approved journal path and refuses a fresh budget file", () => {
  const o = options();
  approve(o);
  expect(
    track(openSupervisedSubscriptionCanary({ ...o, stateFile: join(dir, "fresh-budget.sqlite") })),
  ).toMatchObject({ kind: "held", holds: ["runtime-approval-invalid"] });
});
it("refuses approval changes during slow native preflight even if all window fields still match", () => {
  const o = options();
  approve(o);
  vi.mocked(checkNativeProfile).mockImplementationOnce(() => {
    const a = JSON.parse(readFileSync(o.runtimeApprovalFile, "utf8"));
    a.ownerNativeApprovalRef = "replacement";
    writeFileSync(o.runtimeApprovalFile, JSON.stringify(a));
  });
  expect(track(openSupervisedSubscriptionCanary(o))).toMatchObject({
    kind: "held",
    holds: ["runtime-approval-invalid"],
  });
});
it("refuses revoked approval before reserving any work", async () => {
  const o = options();
  approve(o);
  const d = open(o);
  rmSync(o.runtimeApprovalFile);
  expect(await d.dispatch(request(o.prepared, 0))).toEqual({ kind: "refused", reason: "held" });
  expect(d.status().reservations).toBe(0);
  expect(existsSync(join(dir, "launch-count"))).toBe(false);
});
it("rejects environment drift between preparation and opening", () => {
  const o = options();
  approve(o);
  vi.stubEnv("HOME", join(dir, "different-home"));
  expect(track(openSupervisedSubscriptionCanary(o))).toMatchObject({
    kind: "held",
    holds: ["environment-mismatch"],
  });
});
it("rejects environment drift after opening before a native effect", async () => {
  const o = options();
  approve(o);
  const d = open(o);
  vi.stubEnv("CODEX_HOME", join(dir, "different-codex-home"));
  expect(await d.dispatch(request(o.prepared, 0))).toEqual({ kind: "refused", reason: "held" });
  expect(d.status().reservations).toBe(0);
  expect(existsSync(join(dir, "launch-count"))).toBe(false);
});
it("launches with the approved paths and identity captured at opening, omitting null paths", async () => {
  vi.stubEnv("CODEX_HOME", undefined);
  vi.stubEnv("TMPDIR", undefined);
  vi.stubEnv("USER", "fixture-user");
  vi.stubEnv("LOGNAME", "fixture-login");
  const o = options();
  expect(o.prepared.plan.environment).toEqual({
    HOME: process.env.HOME,
    CODEX_HOME: null,
    TMPDIR: null,
  });
  approve(o);
  const d = open(o);
  vi.stubEnv("USER", "changed-user");
  vi.stubEnv("LOGNAME", "changed-login");
  expect(await d.dispatch(request(o.prepared, 0))).toMatchObject({
    kind: "observed",
    outcome: "completed",
  });
  expect(JSON.parse(readFileSync(join(dir, "child-environment.json"), "utf8"))).toEqual({
    HOME: o.prepared.plan.environment.HOME,
    USER: "fixture-user",
    LOGNAME: "fixture-login",
  });
});
it("admits only one active invocation across the device window", async () => {
  const o = options();
  approve(o);
  const d = open(o),
    first = d.dispatch(request(o.prepared, 0));
  try {
    expect(await d.dispatch(request(o.prepared, 1))).toMatchObject({
      kind: "busy",
      reason: "session-busy",
    });
  } finally {
    await first;
  }
  expect(readFileSync(join(dir, "launch-count"), "utf8")).toBe("1");
  expect(await d.dispatch(request(o.prepared, 1))).toMatchObject({
    kind: "observed",
    outcome: "completed",
  });
});
it("rechecks the binary immediately before spawn after schema validation", async () => {
  const o = options();
  approve(o);
  const d = open(o),
    p = o.prepared.plan.profiles[0];
  if (!p) throw Error("fixture");
  vi.mocked(readPrivateFile).mockImplementation((path, max) => {
    const bytes = readOriginal(path, max);
    if (path.includes("native-output-schema-")) appendFileSync(p.binaryRealPath, "\n# drift\n");
    return bytes;
  });
  expect(await d.dispatch(request(o.prepared, 0))).toMatchObject({ kind: "unknown" });
  expect(existsSync(join(dir, "launch-count"))).toBe(false);
});
it.each(["model", "binarySHA256"])("keeps a revoked tuple held when only %s changes", (field) => {
  const p = plan().plan.profiles[0];
  if (!p) throw Error("fixture");
  const measured = {
    ...p,
    model: "gpt-6.1-sol",
    binarySHA256: "d84a54b031085f01e3ad915ea7c72ebea4dcf69e90f0d1e0e4a637e8280991d2",
  };
  expect(() => qualifyOriginal(measured)).toThrow("native-profile-unqualified");
  const changed =
    field === "model"
      ? { ...measured, model: "other-model" }
      : { ...measured, binarySHA256: "0".repeat(64) };
  expect(() => qualifyOriginal(changed)).toThrow("native-profile-unqualified");
});

it("fixes provider argv without auto fallback or prompt instructions as permissions", () => {
  const p = plan();
  for (const b of p.plan.bindings) {
    const profile = p.plan.profiles.find((x) => x.revision === b.profileRevision);
    if (!profile) throw Error("profile");
    const args = supervisedCommand(b, profile, join(dir, "schema"));
    expect(args).not.toContain("--continue");
    expect(args).not.toContain("--fallback-model");
    if (b.provider === "codex") {
      expect(args).toContain("read-only");
      expect(args[args.indexOf("-C") + 1]).toBe(b.cwd);
      expect(args).toContain("never");
      expect(args).toContain('model_provider="openai"');
      expect(args).toContain("--ignore-user-config");
      expect(args).toContain('web_search="disabled"');
      expect(args).toContain("features.browser_use=false");
    } else {
      expect(args.slice(0, 3)).toEqual(["--print", "--session-id", b.nativeSessionId]);
      expect(args).toContain("--safe-mode");
      expect(args).toContain("--tools");
    }
  }
});
