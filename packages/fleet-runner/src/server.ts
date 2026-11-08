import { createHash } from "node:crypto";
import { accessSync, constants, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTlsServer } from "node:https";
import type { ServerOptions as TlsOptions } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { ID, prepareAuthorization, verifier } from "./auth.js";
import { syncOutput, writeOutput } from "./jobs.js";
import type { JobSpec, JobStore } from "./jobs.js";
import { INPUT_HASH, MAX_INPUT_BYTES, inputHash, putInput, readInput } from "./inputs.js";

const MAX_BODY = 16 * 1024 * 1024;
const MAX_CONTROL_BODY = 64 * 1024;
const SHA = /^[a-f0-9]{64}$/;

class RequestError extends Error {
  readonly status: number;
  constructor(status: number) {
    super();
    this.status = status;
  }
}

function requireValid(valid: unknown): asserts valid {
  if (!valid) throw new RequestError(400);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function labels(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string" && ID.test(v));
}

function integer(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min;
}

function spec(body: Record<string, unknown>): JobSpec {
  const { kind, inputs, params, model, code, requires, priority, maxAttempts } = body;
  requireValid(typeof kind === "string" && ID.test(kind));
  requireValid(Array.isArray(inputs) && inputs.every((v) => typeof v === "string" && v.length > 0));
  requireValid(params === undefined || isObject(params));
  requireValid(
    model === undefined ||
      (isObject(model) && typeof model.id === "string" && typeof model.revision === "string"),
  );
  requireValid(code === undefined || typeof code === "string");
  requireValid(requires === undefined || labels(requires));
  requireValid(priority === undefined || integer(priority, Number.MIN_SAFE_INTEGER));
  requireValid(maxAttempts === undefined || integer(maxAttempts, 1));
  // Remote handlers resolve the keyed input on their own host.
  requireValid(body.payload === null || body.payload === undefined);
  return { ...body, payload: null } as JobSpec;
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function matches(outDir: string, file: string, sha256: string): boolean {
  if (!/^[a-f0-9]{64}\.[0-9]+\.jsonl$/.test(file)) return false;
  try {
    return digest(readFileSync(join(outDir, file))) === sha256;
  } catch {
    return false;
  }
}

function reply(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    connection: "close",
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  if (Number(req.headers["content-length"]) > limit) throw new RequestError(413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const bytes = chunk as Buffer;
    size += bytes.length;
    if (size > limit) throw new RequestError(413);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
}

export function fleetServer(
  store: JobStore,
  options: { registry: string; outDir: string; inputDir?: string; tls?: TlsOptions },
) {
  mkdirSync(options.outDir, { recursive: true });
  const authenticate = verifier(options.registry, (candidate) => store.consumeNonce(candidate));
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const candidate = prepareAuthorization(options.registry, req.headers.authorization);
      if (!candidate) throw new RequestError(401);
      const method = req.method ?? "";
      const target = req.url ?? "";
      const url = new URL(target, "http://fleet.invalid");
      const route = `${method} ${url.pathname}`;
      const input = /^\/inputs\/([a-f0-9]{64})$/.exec(url.pathname)?.[1];
      const limit =
        input && method === "POST"
          ? MAX_INPUT_BYTES
          : route === "POST /complete"
            ? MAX_BODY
            : MAX_CONTROL_BODY;
      if (Number(req.headers["content-length"]) > limit) throw new RequestError(413);
      if (req.headers.expect === "100-continue") res.writeContinue();
      const bytes = await readBody(req, limit);
      const id = authenticate(req.headers.authorization, method, target, bytes);
      if (!id) throw new RequestError(401);

      if (input && options.inputDir) {
        if (method === "POST") {
          if (id !== "owner") throw new RequestError(403);
          requireValid(inputHash(bytes) === input);
          putInput(options.inputDir, input, bytes);
          return reply(res, 200, { stored: true });
        }
        if (method === "GET") {
          const key = url.searchParams.get("key") ?? "";
          const fence = Number(url.searchParams.get("fence"));
          requireValid(INPUT_HASH.test(key) && integer(fence, 1));
          if (!store.holdsInput(key, fence, id, input)) throw new RequestError(403);
          const data = readInput(options.inputDir, input);
          res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": data.length,
            "cache-control": "no-store",
            connection: "close",
          });
          return void res.end(data);
        }
        throw new RequestError(404);
      }

      if (["POST /enqueue", "GET /events", "GET /report"].includes(route) && id !== "owner") {
        throw new RequestError(403);
      }
      if (route === "GET /events") {
        const after = Number(url.searchParams.get("after") ?? "0");
        requireValid(integer(after, 0));
        return reply(res, 200, store.events(after));
      }
      if (route === "GET /report") {
        accessSync(options.outDir, constants.R_OK | constants.W_OK | constants.X_OK);
        accessSync(options.registry, constants.R_OK | constants.X_OK);
        const since = Number(url.searchParams.get("since") ?? "0");
        requireValid(integer(since, 0));
        const key = url.searchParams.get("verify");
        if (key === null) return reply(res, 200, store.report(since));
        requireValid(SHA.test(key));
        const row = store.get(key);
        const verified = !!(
          row?.status === "done" &&
          row.outputFile &&
          row.output &&
          matches(options.outDir, row.outputFile, row.output)
        );
        return reply(res, 200, { ...store.report(since), verified });
      }
      if (method !== "POST") throw new RequestError(404);

      let body: unknown;
      try {
        body = JSON.parse(bytes.toString("utf8"));
      } catch {
        throw new RequestError(400);
      }
      requireValid(isObject(body));
      if (route === "POST /enqueue") {
        const job = spec(body);
        if (options.inputDir) {
          for (const hash of job.inputs) {
            requireValid(INPUT_HASH.test(hash));
            try {
              readInput(options.inputDir, hash);
            } catch {
              throw new RequestError(400);
            }
          }
        }
        return reply(res, 200, store.enqueue(job));
      }
      if (id === "owner") throw new RequestError(403);
      if (route === "POST /claim") {
        requireValid(labels(body.caps) && labels(body.kinds));
        return reply(res, 200, store.claim(id, body.caps, body.kinds) ?? null);
      }
      const { key, fence } = body;
      requireValid(typeof key === "string" && SHA.test(key) && integer(fence, 1));
      if (route === "POST /heartbeat") return reply(res, 200, store.heartbeat(key, fence, id));
      if (route === "POST /release") return reply(res, 200, store.release(key, fence, id));
      if (route === "POST /fail") {
        requireValid(
          typeof body.code === "string" &&
            ID.test(body.code) &&
            typeof body.retryable === "boolean",
        );
        return reply(res, 200, store.fail(key, fence, id, body.code, body.retryable));
      }
      if (route === "POST /complete") {
        const { sha256, output } = body;
        requireValid(typeof sha256 === "string" && SHA.test(sha256) && typeof output === "string");
        const data = Buffer.from(output, "base64");
        requireValid(data.toString("base64") === output && digest(data) === sha256);
        const file = `${key}.${fence}.jsonl`;
        const row = store.get(key);
        if (row?.status === "done" && row.worker === id && row.fence === fence) {
          return reply(
            res,
            200,
            row.output === sha256 &&
              row.outputFile === file &&
              matches(options.outDir, file, sha256),
          );
        }
        const accepted = store.complete(key, fence, id, () => {
          try {
            return writeOutput(options.outDir, { key, fence }, data);
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "EEXIST" ||
              !matches(options.outDir, file, sha256)
            )
              throw error;
            syncOutput(options.outDir, file);
            return { file, sha256 };
          }
        });
        return reply(res, 200, accepted);
      }
      throw new RequestError(404);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        const status = error instanceof RequestError ? error.status : 500;
        reply(res, status, { error: status === 500 ? "server-error" : "request-rejected" });
      }
    }
  };
  const limits = {
    requestTimeout: 15_000,
    headersTimeout: 5_000,
    connectionsCheckingInterval: 1_000,
    maxHeaderSize: 8 * 1024,
  };
  const server = options.tls
    ? createTlsServer({ ...options.tls, ...limits }, handle)
    : createServer(limits, handle);
  server.maxConnections = 16;
  server.maxRequestsPerSocket = 1;
  server.maxHeadersCount = 32;
  server.setTimeout(15_000, (socket) => socket.destroy());
  server.on("checkContinue", handle);
  return server;
}
