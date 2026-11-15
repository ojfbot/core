import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  realpathSync,
  rmSync,
  statSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supervisedCommand } from "../../packages/native-dispatch/dist/supervised-native.js";
import {
  checkBinary,
  nativeEnvironment,
} from "../../packages/native-dispatch/dist/supervised-files.js";
import {
  SUBSCRIPTION_CANARY_FIXTURE,
  SUBSCRIPTION_CANARY_FIXTURE_SHA256,
} from "../../packages/native-dispatch/dist/canary.js";
import { ADVISORY_OUTPUT_SCHEMA } from "../../packages/native-dispatch/dist/advisory.js";
const [profileFile, metadataFile, evidenceDirectory, ...extra] = process.argv.slice(2);
if (
  !profileFile ||
  !metadataFile ||
  !evidenceDirectory ||
  extra.length ||
  process.platform !== "darwin"
)
  throw Error(
    "usage: pnpm exec node scripts/native-dispatch/prove-supervised-wire.mjs <owner-profile-or-plan.json> <disposable-metadata.json> <NEW-evidence-directory>; macOS only",
  );
const raw = JSON.parse(readFileSync(profileFile, "utf8"));
const profile = Array.isArray(raw.profiles)
  ? raw.profiles.find((p) => p.provider === "codex")
  : raw;
if (
  !profile ||
  profile.provider !== "codex" ||
  profile.model !== "gpt-6.1-sol" ||
  !["0.164.0", "0.165.0-alpha.1.2"].includes(profile.nativeVersion)
)
  throw Error("unqualified-input-profile");
checkBinary(profile);
const version = spawnSync(profile.binaryRealPath, ["--version"], {
  encoding: "utf8",
  env: nativeEnvironment(),
  timeout: 5000,
  maxBuffer: 8192,
});
if (version.status !== 0 || version.stdout.trim() !== `codex-cli ${profile.nativeVersion}`)
  throw Error("native-version-mismatch");
const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
if (
  metadata.purpose !== "disposable-loopback-qualification" ||
  !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(metadata.nativeSessionId) ||
  metadata.turnsSubmitted !== 0 ||
  metadata.turnsObserved !== 0 ||
  typeof metadata.cwd !== "string"
)
  throw Error("requires-explicitly-disposable-zero-turn-metadata");
const cwd = realpathSync(metadata.cwd),
  info = statSync(cwd);
if (
  cwd !== metadata.cwd ||
  info.uid !== process.getuid() ||
  info.mode & 0o077 ||
  readdirSync(cwd).length
)
  throw Error("requires-canonical-owner-private-empty-cwd");
mkdirSync(evidenceDirectory, { mode: 0o700 });
const evidenceRoot = realpathSync(evidenceDirectory);
const syntheticCredential = "NOT_A_SECRET_QUALIFICATION_ONLY";
const dir = realpathSync(mkdtempSync(join(tmpdir(), "core-openai-wire-")));
const schema = join(dir, "schema.json");
writeFileSync(schema, JSON.stringify(ADVISORY_OUTPUT_SCHEMA), { mode: 0o600 });
const report = {
  binarySHA256: profile.binarySHA256,
  nativeVersion: profile.nativeVersion,
  model: profile.model,
  disposableNativeSessionId: metadata.nativeSessionId,
  realModelCalls: 0,
  providerId: "openai",
  baseUrl: "documented literal-loopback override",
  authMode: "ephemeral synthetic API-auth; subscription entitlement and behavior unproved",
  networkIsolation: "outer Seatbelt permits outbound only to exact loopback port",
  handshakes: [],
  requests: [],
  eventTypes: [],
  exitCode: null,
  stdoutBytes: 0,
  stderrBytes: 0,
  timedOut: false,
};
let child;
const sockets = new Set();
const stop = () => {
  if (child?.pid)
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
};
function fieldShape(o, k) {
  return !Object.hasOwn(o, k)
    ? "absent"
    : Array.isArray(o[k])
      ? "array:" + o[k].length
      : typeof o[k];
}
function inspect(payload, syntheticAuthOnly, transport) {
  let shape = { parsed: false };
  try {
    const body = JSON.parse(payload.toString("utf8"));
    const response = body.response && typeof body.response === "object" ? body.response : body;
    const names = [];
    const visit = (tools) => {
      if (!Array.isArray(tools)) return;
      for (const t of tools) {
        const n = t.name ?? t.function?.name ?? t.type;
        if (typeof n === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(n)) names.push(n);
        visit(t.tools);
        visit(t.functions);
        visit(t.namespaces);
      }
    };
    for (const o of [body, ...(response === body ? [] : [response])])
      for (const k of ["tools", "additional_tools", "namespaces"]) visit(o[k]);
    shape = {
      parsed: true,
      transport,
      syntheticAuthOnly,
      messageType: typeof body.type === "string" ? body.type : "http",
      modelMatchesPinned: response.model === "gpt-6.1-sol",
      rootTools: fieldShape(body, "tools"),
      rootAdditionalTools: fieldShape(body, "additional_tools"),
      rootNamespaces: fieldShape(body, "namespaces"),
      responseTools: fieldShape(response, "tools"),
      responseAdditionalTools: fieldShape(response, "additional_tools"),
      responseNamespaces: fieldShape(response, "namespaces"),
      toolNames: names.sort(),
    };
  } catch {
  } finally {
    payload.fill(0);
  }
  report.requests.push(shape);
  setTimeout(stop, 50);
}
function frame(op, payload) {
  const p = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let h;
  if (p.length < 126) h = Buffer.from([0x80 | op, p.length]);
  else {
    h = Buffer.alloc(4);
    h[0] = 0x80 | op;
    h[1] = 126;
    h.writeUInt16BE(p.length, 2);
  }
  return Buffer.concat([h, p]);
}
const server = createServer((req, res) => {
  let chunks = [],
    size = 0;
  req.on("data", (b) => {
    size += b.length;
    if (size > 8 * 1024 * 1024) {
      req.destroy();
      return;
    }
    chunks.push(b);
  });
  req.on("end", () => {
    inspect(
      Buffer.concat(chunks),
      req.headers.authorization === "Bearer " + syntheticCredential,
      "http",
    );
    chunks.forEach((b) => b.fill(0));
    chunks = [];
    res.writeHead(400, { "content-type": "application/json" });
    res.end(
      '{"error":{"type":"invalid_request_error","code":"qualification_only","message":"Synthetic qualification refusal"}}',
    );
  });
});
server.on("upgrade", (req, socket, head) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.on("error", () => {});
  const syntheticAuthOnly = req.headers.authorization === "Bearer " + syntheticCredential;
  report.handshakes.push({
    syntheticAuthOnly,
    route: req.url === "/v1/responses" ? "responses" : "other",
  });
  if (!syntheticAuthOnly) {
    socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
    stop();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    stop();
    return;
  }
  const accept = createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
      accept +
      "\r\n\r\n",
  );
  let buffered = Buffer.alloc(0),
    fragments = [],
    total = 0;
  function feed(bytes) {
    buffered = Buffer.concat([buffered, bytes]);
    if (buffered.length > 8 * 1024 * 1024) {
      socket.destroy();
      stop();
      return;
    }
    while (buffered.length >= 2) {
      const first = buffered[0],
        masked = Boolean(buffered[1] & 128),
        op = first & 15;
      let length = buffered[1] & 127,
        offset = 2;
      if (length === 126) {
        if (buffered.length < 4) return;
        length = buffered.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffered.length < 10) return;
        const long = buffered.readBigUInt64BE(2);
        if (long > 8388608n) {
          socket.destroy();
          stop();
          return;
        }
        length = Number(long);
        offset = 10;
      }
      const header = offset + (masked ? 4 : 0);
      if (length > 8388608 || buffered.length < header + length) return;
      const p = Buffer.from(buffered.subarray(header, header + length));
      if (masked) {
        for (let i = 0; i < p.length; i++) p[i] ^= buffered[offset + (i % 4)];
      }
      buffered = buffered.subarray(header + length);
      if (op === 8) {
        socket.end();
        return;
      }
      if (op === 9) {
        socket.write(frame(10, p));
        p.fill(0);
        continue;
      }
      if (first & 0x70) {
        p.fill(0);
        socket.destroy();
        stop();
        return;
      }
      fragments.push(p);
      total += p.length;
      if (total > 8388608) {
        socket.destroy();
        stop();
        return;
      }
      if (first & 128) {
        const data = Buffer.concat(fragments);
        fragments.forEach((b) => b.fill(0));
        fragments = [];
        total = 0;
        inspect(data, syntheticAuthOnly, "websocket");
        socket.write(
          frame(
            1,
            JSON.stringify({
              type: "error",
              error: {
                type: "invalid_request_error",
                code: "qualification_only",
                message: "Synthetic qualification refusal; no inference performed",
              },
            }),
          ),
        );
        socket.end(frame(8, Buffer.from([3, 232])));
        return;
      }
    }
  }
  socket.on("data", feed);
  if (head.length) feed(head);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const b = {
    provider: "codex",
    sessionPolicy: "existing-fixed",
    nativeSessionId: metadata.nativeSessionId,
    cwd,
  },
  p = profile,
  base = supervisedCommand(b, p, schema),
  index = base.indexOf("exec");
const args = [
  ...base.slice(0, index),
  "-c",
  'model_provider="openai"',
  "-c",
  `openai_base_url="http://127.0.0.1:${port}/v1"`,
  "-c",
  'cli_auth_credentials_store="ephemeral"',
  ...base.slice(index),
];
const policy = join(dir, "outbound.sb");
writeFileSync(
  policy,
  `(version 1)\n(allow default)\n(deny network-outbound)\n(allow network-outbound (remote ip "localhost:${port}"))\n`,
  { mode: 0o600 },
);
try {
  child = spawn("/usr/bin/sandbox-exec", ["-f", policy, profile.binaryRealPath, ...args], {
    cwd,
    env: { ...nativeEnvironment(), CODEX_API_KEY: syntheticCredential },
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let pending = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (s) => {
    report.stdoutBytes += Buffer.byteLength(s);
    if (report.stdoutBytes > 65536) {
      stop();
      return;
    }
    pending += s;
    let n;
    while ((n = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, n);
      pending = pending.slice(n + 1);
      try {
        const e = JSON.parse(line);
        if (typeof e.type === "string") report.eventTypes.push(e.type);
      } catch {}
    }
  });
  child.stderr.on("data", (b) => {
    report.stderrBytes += b.length;
    if (report.stderrBytes > 65536) stop();
  });
  const timer = setTimeout(() => {
    report.timedOut = true;
    if (child.pid)
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
  }, 20000);
  child.stdin.end(
    JSON.stringify({
      instruction:
        "Review only the fixed fixture. Return the required JSON ack and result. Do not use tools. The ack must echo message_id as messageId, bindingRevision, and the fixture sha256 as fixtureDigest. Result text must contain the requested wording only.",
      pointer: {
        message_id: "00000000-0000-4000-8000-000000000010",
        thread_id: "00000000-0000-4000-8000-000000000090",
        stream_id: "00000000-0000-4000-8000-000000000080",
        sequence: 10,
        bindingRevision: "binding-1",
      },
      advisoryFixture: {
        utf8: SUBSCRIPTION_CANARY_FIXTURE,
        sha256: SUBSCRIPTION_CANARY_FIXTURE_SHA256,
      },
    }) + "\n",
  );
  report.exitCode = await new Promise((r) => {
    child.once("error", () => r("spawn-error"));
    child.once("close", r);
  });
  clearTimeout(timer);
} finally {
  if (child?.pid)
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  for (const s of sockets) s.destroy();
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
}
report.toolExclusionObserved =
  report.requests.length === 1 &&
  report.requests.every(
    (r) =>
      r.parsed &&
      r.syntheticAuthOnly &&
      r.modelMatchesPinned &&
      [
        "rootTools",
        "rootAdditionalTools",
        "rootNamespaces",
        "responseTools",
        "responseAdditionalTools",
        "responseNamespaces",
      ].every((k) => r[k] === "absent" || r[k] === "array:0"),
  ) &&
  !report.timedOut;
writeFileSync(join(evidenceRoot, "tool-inventory.json"), JSON.stringify(report, null, 2) + "\n", {
  mode: 0o600,
});
console.log(JSON.stringify(report));
if (!report.toolExclusionObserved) process.exitCode = 1;
