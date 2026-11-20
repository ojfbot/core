import { randomUUID } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  openSync,
  closeSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { signer } from "../dist/auth.js";
import { jobKey } from "../dist/jobs.js";
import { LEDGER_RESULT, proofHash } from "../dist/ledger-proof.js";
import { parseWorkerSettings } from "../dist/worker-settings.js";
import { commandHandler } from "../dist/declared-worker.js";
import { workOnce } from "../dist/worker.js";
import { runProofCommand, verifyProofCommand } from "../dist/ledger-proof-command.js";
import { createOperator, projection, validateSettings } from "./ledger-proof-local-operator.mjs";

const check = (condition, reason) => {
  if (!condition) throw Error(reason);
};

/** Stable private host facts are configured once; runtime files are never hand-edited. */
export function generateReusablePractice(raw, role) {
  const { host, target, command, ...config } = raw;
  check(
    host && target && command && ["primary", "fallback"].includes(role),
    "practice-host-target-command-required",
  );
  check(resolve(config.evidenceRoot) === config.evidenceRoot, "practice-evidence-path-invalid");
  const identity = projection(target.inspect);
  const label = `org.ojfbot.fleetrunner.${raw.identity}`;
  const operator = {
    schemaVersion: 1,
    proofId: raw.identity,
    proofRoot: config.evidenceRoot,
    uid: process.getuid(),
    endsAtMs: Date.now() + raw.timeoutMs,
    nasAlias: host.nasAlias,
    docker: host.docker,
    target: identity,
    snapshot: {
      serviceUid: identity.user.split(":")[0],
      node: target.node,
      bundle: target.serverBundle,
      serverBundleSHA256: target.serverBundleSha256,
      clientBundle: host.bundle,
      clientBundleSHA256: host.bundleSha256,
      schema: 5,
      database: "/var/lib/fleet-runner/state/fleet.sqlite",
      outputs: "/var/lib/fleet-runner/output",
    },
    protected: host.protected,
    local: {
      domain: `gui/${process.getuid()}`,
      stopLabels: [`${label}.primary`, `${label}.fallback`],
      watchdogLabel: `${label}.watchdog`,
      pauseFiles: [
        join(config.evidenceRoot, "primary.pause"),
        join(config.evidenceRoot, "fallback.pause"),
      ],
      ownedProcessMarkers: [
        join(config.evidenceRoot, "primary.lock"),
        join(config.evidenceRoot, "fallback.lock"),
        join(config.evidenceRoot, "unused.grant"),
      ],
      wakeOwner: `cg307-u1-${raw.identity}`,
    },
  };
  validateSettings(operator);
  const worker = {
    schemaVersion: 1,
    endpoint: target.endpoint,
    worker: config.workers[role],
    tokenFile: host.tokenFile,
    caFile: host.caFile,
    outDir: config.evidenceRoot,
    statusFile: join(config.evidenceRoot, `${role}.status.json`),
    pollMs: 1000,
    kinds: {
      "bookcase-ledger-replay": {
        capabilities: [config.id],
        command: [command.program, ...command.args],
        timeoutMs: command.timeoutMs,
      },
    },
  };
  return {
    ...config,
    operator,
    worker,
    commandSha256: command.sha256,
    commandFiles: command.files,
  };
}

/** One signed, bounded request. No inherited TLS bypass and no automatic mutation retries. */
export function practiceRequest(endpoint, id, key, caFile) {
  const base = new URL(endpoint);
  check(
    base.protocol === "https:" ||
      (base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)),
    "practice-https-required",
  );
  check(
    !base.username && !base.password && base.pathname === "/" && !base.search && !base.hash,
    "practice-endpoint-invalid",
  );
  const authorize = signer(id, key);
  return (method, path, value) =>
    new Promise((accept, reject) => {
      const body = Buffer.from(value === undefined ? "" : JSON.stringify(value));
      const request = base.protocol === "https:" ? httpsRequest : httpRequest;
      const req = request(
        new URL(path, base),
        {
          method,
          ...(caFile ? { ca: readFileSync(caFile) } : {}),
          timeout: 15000,
          headers: {
            authorization: authorize(method, path, body),
            "content-type": "application/json",
          },
        },
        (res) => {
          let bytes = Buffer.alloc(0);
          res.on("data", (chunk) => {
            bytes = Buffer.concat([bytes, chunk]);
            if (bytes.length > 65536) res.destroy(Error("practice-response-too-large"));
          });
          res.on("error", reject);
          res.on("end", () => {
            if (res.statusCode !== 200)
              return reject(Error(`practice-http-${res.statusCode}:${method}:${path}`));
            try {
              accept(JSON.parse(bytes.toString()));
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(Error("practice-request-timeout")));
      req.end(body);
    });
}

/** A signed forum carries a few addressed observations, never executable peer content. */
function relayFor(config, directory) {
  const relay = config.relay;
  const request = (method, path, value) => {
    const args = [...relay.adapter.args, "request", method, path];
    if (value !== undefined) {
      const file = join(directory, `${value.command_id}.json`);
      writeFileSync(file, JSON.stringify(value), { flag: "wx", mode: 0o600 });
      args.push("--body-file", file, "--content-type", "application/json");
    }
    return runProofCommand({ ...relay.adapter, args }, {}, undefined, 20000, relay.environment);
  };
  return {
    post: async (phase, openSequence, payload = {}) => {
      const result = await request("POST", `/helpdesk/api/threads/${relay.thread}/messages`, {
        command_id: randomUUID(),
        session_id: relay.session,
        recipients: [
          { device_id: config.primaryDevice, session_id: relay.peerSessions.primary },
          { device_id: config.fallbackDevice, session_id: relay.peerSessions.fallback },
        ],
        body: JSON.stringify({
          type: "fleetrunner-practice",
          practice: config.id,
          role: config.role,
          phase,
          openSequence,
          ...payload,
        }),
      });
      check(
        result.accepted === true &&
          result.thread_id === relay.thread &&
          result.stream_id === relay.stream &&
          Number.isSafeInteger(result.sequence),
        "practice-relay-post-unconfirmed",
      );
      return result.sequence;
    },
    read: async (after) => {
      const messages = [];
      for (let page = 0; ; page++) {
        check(page < 20, "practice-relay-cursor-too-old");
        const result = await request(
          "GET",
          `/helpdesk/api/threads/${relay.thread}?after=${after}&limit=100`,
        );
        check(
          result.thread?.thread_id === relay.thread && result.stream_id === relay.stream,
          "practice-relay-stream-mismatch",
        );
        messages.push(...(result.messages ?? []));
        if (!result.has_more) break;
        check(result.next_after > after, "practice-relay-cursor-stalled");
        after = result.next_after;
      }
      return messages.flatMap((message) => {
        try {
          const value = JSON.parse(message.body);
          const expected =
            value.role === "primary"
              ? config.primaryDevice
              : value.role === "fallback"
                ? config.fallbackDevice
                : null;
          if (
            value.type !== "fleetrunner-practice" ||
            value.practice !== config.id ||
            message.writer !== expected ||
            message.sender?.device_id !== expected ||
            message.sender?.session_id !== relay.peerSessions[value.role]
          )
            return [];
          return [
            { ...value, sequence: message.sequence, receivedAt: Date.parse(message.received_at) },
          ];
        } catch {
          return [];
        }
      });
    },
  };
}

export function validateReusablePractice(config, role) {
  check(
    config.schemaVersion === 1 && /^practice-[a-z0-9-]{1,48}$/.test(config.id),
    "practice-config-id-invalid",
  );
  check(["primary", "fallback"].includes(role), "practice-role-invalid");
  const worker = parseWorkerSettings(config.worker);
  check(
    config.device === (role === "primary" ? config.primaryDevice : config.fallbackDevice) &&
      config.primaryDevice !== config.fallbackDevice,
    "practice-device-role-mismatch",
  );
  check(
    Object.keys(worker.kinds).join() === "bookcase-ledger-replay",
    "practice-only-ledger-replay",
  );
  check(worker.worker === config.workers[role], "practice-worker-role-mismatch");
  check(
    worker.kinds["bookcase-ledger-replay"].capabilities.includes(config.id),
    "practice-capability-mismatch",
  );
  check(
    /^[a-f0-9]{40}$/.test(config.code) && /^[a-f0-9]{64}$/.test(config.fixtureSha256),
    "practice-source-fixture-invalid",
  );
  check(
    Number.isSafeInteger(config.timeoutMs) &&
      config.timeoutMs >= 1000 &&
      config.timeoutMs <= 15 * 60000,
    "practice-timeout-invalid",
  );
  check(
    config.operator.target.labels?.["fleet.practice"] === config.id,
    "practice-target-not-dedicated",
  );
  check(
    config.relay.environment.HELPDESK_DEVICE_WRITER === config.device &&
      config.relay.environment.HELPDESK_URL?.startsWith("https:") &&
      config.relay.session === config.relay.peerSessions[role],
    "practice-relay-identity-mismatch",
  );
  verifyProofCommand(config.relay.adapter);
  const declared = worker.kinds["bookcase-ledger-replay"];
  verifyProofCommand({
    program: declared.command[0],
    args: declared.command.slice(1),
    sha256: config.commandSha256,
    files: config.commandFiles,
  });
  return worker;
}

/** Foreground roles only. Persistent target/key are never created, stopped or deleted here. */
export async function runReusablePractice(config, role, dependencies = {}) {
  const worker = validateReusablePractice(config, role);
  mkdirSync(config.evidenceRoot, { recursive: true, mode: 0o700 });
  const lock = join(config.evidenceRoot, `${role}.lock`);
  const fd = openSync(lock, "wx", 0o600);
  closeSync(fd);
  try {
    const directory = mkdtempSync(join(config.evidenceRoot, `${role}-`));
    writeFileSync(join(directory, "settings.json"), JSON.stringify(config) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const relay = dependencies.relay ?? relayFor({ ...config, role }, directory);
    const request =
      dependencies.request ??
      practiceRequest(worker.endpoint, worker.worker, worker.tokenFile, worker.caFile);
    const owner =
      role === "primary"
        ? (dependencies.owner ??
          practiceRequest(worker.endpoint, "owner", config.ownerKey, worker.caFile))
        : null;
    const op = dependencies.operator ?? createOperator(config.operator);
    const wait = dependencies.wait ?? (() => delay(1000));
    const now = dependencies.now ?? Date.now;
    const startedAt = now(),
      deadline = startedAt + config.timeoutMs;
    const active = () => check(now() < deadline, "practice-timeout");
    const snapshot = () => op.snapshot({ proofId: config.operator.proofId });
    let stage = "preflight",
      openSequence = null;
    const receipt = (value) =>
      writeFileSync(join(directory, "receipt.json"), JSON.stringify(value, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
    try {
      const seen = snapshot();
      check(
        seen.schema === 5 &&
          seen.rows.length === 0 &&
          seen.events.length === 0 &&
          seen.accepted === null,
        "practice-reset-required",
      );
      const baseline = op.protectedProbe({ proofId: config.operator.proofId });
      check(
        baseline.protectedIdle === true && baseline.baselineUnchanged === true,
        "practice-protected-baseline-mismatch",
      );
      check((await request("GET", "/worker-control")).paused === false, "practice-worker-paused");
      await relay.read(config.relay.startAfter);
      stage = "pairing";
      let cursor = config.relay.startAfter;
      const waitFor = async (predicate) => {
        for (;;) {
          active();
          const messages = await relay.read(cursor);
          cursor = Math.max(cursor, ...messages.map((message) => message.sequence));
          const failed = messages.find(
            (message) =>
              message.phase === "FAIL" &&
              ((openSequence !== null && message.openSequence === openSequence) ||
                (message.openSequence === null && message.receivedAt >= startedAt)),
          );
          if (failed) throw Error(`practice-peer-failed:${failed.reason}`);
          const terminal = new Set(
            messages
              .filter((message) => ["RESULT", "FAIL"].includes(message.phase))
              .map((message) => message.openSequence),
          );
          const matched = [...messages]
            .reverse()
            .find(
              (message) =>
                predicate(message) && !(message.phase === "OPEN" && terminal.has(message.sequence)),
            );
          if (matched) return matched;
          await wait();
        }
      };
      if (role === "primary") {
        openSequence = await relay.post("OPEN", null);
        await waitFor(
          (message) =>
            message.phase === "READY" &&
            message.role === "fallback" &&
            message.openSequence === openSequence,
        );
        const empty = snapshot();
        check(
          empty.rows.length === 0 && empty.events.length === 0,
          "practice-queue-changed-after-preflight",
        );
        stage = "admission";
        const spec = {
          kind: "bookcase-ledger-replay",
          inputs: [],
          params: {
            fixtureVersion: 1,
            fixtureSha256: config.fixtureSha256,
            proofId: config.operator.proofId,
            practice: config.id,
            attempt: openSequence,
          },
          code: config.code,
          payload: null,
          requires: [config.id],
          priority: 0,
          maxAttempts: 2,
        };
        const admitted = await owner("POST", "/enqueue", spec);
        check(
          admitted.created === true && admitted.key === jobKey(spec),
          "practice-admission-unconfirmed",
        );
        const claim = await request("POST", "/claim", { caps: [config.id], kinds: [spec.kind] });
        check(claim?.key === admitted.key && claim.fence === 1, "practice-primary-claim-mismatch");
        // The primary worker intentionally ends its attempt here: no heartbeat or graceful release.
        await relay.post("PRIMARY_STOPPED", openSequence, { key: claim.key, fence: claim.fence });
        stage = "takeover";
        for (;;) {
          active();
          const updates = await relay.read(cursor);
          cursor = Math.max(cursor, ...updates.map((message) => message.sequence));
          const failed = updates.find(
            (message) => message.phase === "FAIL" && message.openSequence === openSequence,
          );
          if (failed) throw Error(`practice-peer-failed:${failed.reason}`);
          const current = snapshot();
          const row = current.rows.find((entry) => entry.key === claim.key);
          if (row?.status === "failed") throw Error("practice-job-failed");
          if (row?.status === "done") {
            check(
              row.worker === config.workers.fallback &&
                row.fence === 2 &&
                current.accepted === Buffer.from(LEDGER_RESULT).toString("base64"),
              "practice-result-mismatch",
            );
            check(
              (await owner("GET", `/report?verify=${claim.key}`)).verified === true,
              "practice-result-not-verified",
            );
            const stale = await request("POST", "/complete", {
              key: claim.key,
              fence: claim.fence,
              sha256: proofHash(LEDGER_RESULT),
              output: Buffer.from(LEDGER_RESULT).toString("base64"),
            });
            check(stale === false, "practice-stale-write-accepted");
            const result = {
              state: "PASS",
              role,
              device: config.device,
              worker: worker.worker,
              session: config.relay.session,
              thread: config.relay.thread,
              practice: config.id,
              openSequence,
              key: claim.key,
              fallbackCompleted: true,
              resultVerified: true,
              staleRejected: true,
            };
            await relay.post("RESULT", openSequence, result);
            receipt(result);
            return result;
          }
          await wait();
        }
      }
      const opened = await waitFor(
        (message) =>
          message.phase === "OPEN" &&
          message.role === "primary" &&
          now() - message.receivedAt <= config.timeoutMs,
      );
      openSequence = opened.sequence;
      await relay.post("READY", openSequence);
      const stopped = await waitFor(
        (message) =>
          message.phase === "PRIMARY_STOPPED" &&
          message.role === "primary" &&
          message.openSequence === openSequence,
      );
      stage = "takeover";
      let claim;
      while (!claim) {
        active();
        claim = await request("POST", "/claim", {
          caps: [config.id],
          kinds: ["bookcase-ledger-replay"],
        });
        if (!claim) await wait();
      }
      check(claim.key === stopped.key && claim.fence === 2, "practice-fallback-claim-mismatch");
      // Fixed reviewed local command; job fields never choose an executable or arguments.
      const lease = (value) => ({ key: value.key, fence: value.fence });
      const client = {
        claim: async () => claim,
        heartbeat: (value) => request("POST", "/heartbeat", lease(value)),
        release: (value) => request("POST", "/release", lease(value)),
        fail: (value, code, retryable) =>
          request("POST", "/fail", { ...lease(value), code, retryable }),
        complete: (value, bytes, sha256) =>
          request("POST", "/complete", {
            ...lease(value),
            sha256,
            output: bytes.toString("base64"),
          }),
      };
      let handlerFailure;
      const worked = await workOnce(client, {
        caps: [config.id],
        outDir: directory,
        signal: AbortSignal.timeout(deadline - now()),
        handlers: {
          "bookcase-ledger-replay": async (value, context) => {
            let output;
            try {
              output = await (dependencies.handler ?? commandHandler(worker.kinds[claim.kind]))(
                value,
                context,
              );
            } catch (error) {
              handlerFailure = error;
              throw error;
            }
            check(
              output.file === `${claim.key}.${claim.fence}.jsonl`,
              "practice-output-file-mismatch",
            );
            const bytes = readFileSync(join(directory, output.file));
            check(
              bytes.toString() === LEDGER_RESULT && proofHash(bytes) === output.sha256,
              "practice-output-mismatch",
            );
            return output;
          },
        },
      });
      if (handlerFailure) throw handlerFailure;
      check(worked === "completed", `practice-fallback-${worked}`);
      const result = await waitFor(
        (message) =>
          message.phase === "RESULT" &&
          message.role === "primary" &&
          message.openSequence === openSequence &&
          message.state === "PASS",
      );
      const finished = {
        state: "PASS",
        role,
        device: config.device,
        worker: worker.worker,
        session: config.relay.session,
        thread: config.relay.thread,
        practice: config.id,
        openSequence,
        key: result.key,
        fallbackCompleted: true,
      };
      receipt(finished);
      return finished;
    } catch (error) {
      const result = {
        state: "FAIL",
        stage,
        role,
        device: config.device,
        practice: config.id,
        openSequence,
        reason: error.message,
        firstFailure: error.commandFailure ?? error.privateFailure ?? null,
      };
      receipt(result);
      {
        try {
          await relay.post("FAIL", openSequence, {
            reason: /^practice-[a-z-]+$/.test(error.message)
              ? error.message
              : "local-command-failed",
          });
        } catch {
          /* retain original error */
        }
      }
      throw Object.assign(error, { practiceResult: result });
    }
  } finally {
    unlinkSync(lock);
  }
}

/** Explicit reset archives the final observation; keys, container and accepted bytes are retained. */
export async function resetReusablePractice(config, role, dependencies = {}) {
  check(role === "primary", "practice-reset-primary-only");
  validateReusablePractice(config, role);
  mkdirSync(config.evidenceRoot, { mode: 0o700, recursive: true });
  const lock = join(config.evidenceRoot, "primary.lock");
  closeSync(openSync(lock, "wx", 0o600));
  try {
    const op = dependencies.operator ?? createOperator(config.operator);
    const snapshot = op.snapshot({ proofId: config.operator.proofId });
    check(
      snapshot.rows.every(
        (row) => ["done", "failed"].includes(row.status) && row.spec.params?.practice === config.id,
      ),
      "practice-reset-active-or-foreign-job",
    );
    mkdirSync(config.evidenceRoot, { mode: 0o700, recursive: true });
    const directory = mkdtempSync(join(config.evidenceRoot, "reset-"));
    writeFileSync(join(directory, "before.json"), JSON.stringify(snapshot) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const owner =
      dependencies.owner ??
      practiceRequest(config.worker.endpoint, "owner", config.ownerKey, config.worker.caFile);
    const result = await owner("POST", "/practice/reset", {
      practice: config.id,
      expectedKeys: snapshot.rows.map((row) => row.key),
    });
    check(result.reset === true, "practice-reset-refused");
    const empty = op.snapshot({ proofId: config.operator.proofId });
    check(
      empty.rows.length === 0 && empty.events.length === 0 && empty.accepted === null,
      "practice-reset-unverified",
    );
    return { state: "PASS", practice: config.id, reset: true, targetAndKeysRetained: true };
  } finally {
    unlinkSync(lock);
  }
}
