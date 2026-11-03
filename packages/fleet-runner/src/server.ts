import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { ID, verifier } from "./auth.js";
import { writeOutput } from "./jobs.js";
import type { JobSpec, JobStore } from "./jobs.js";

const MAX_BODY = 16 * 1024 * 1024;
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

async function readBody(req: IncomingMessage): Promise<Buffer> {
  if (Number(req.headers["content-length"]) > MAX_BODY) throw new RequestError(413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const bytes = chunk as Buffer;
    size += bytes.length;
    if (size > MAX_BODY) throw new RequestError(413);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
}

export function fleetServer(store: JobStore, options: { registry: string; outDir: string }) {
  const authenticate = verifier(options.registry);
  return createServer({ requestTimeout: 60_000, headersTimeout: 15_000 }, async (req, res) => {
    try {
      if (!req.headers.authorization) throw new RequestError(401);
      const method = req.method ?? "";
      const target = req.url ?? "";
      const bytes = await readBody(req);
      const id = authenticate(req.headers.authorization, method, target, bytes);
      if (!id) throw new RequestError(401);
      const url = new URL(target, "http://fleet.invalid");
      const route = `${method} ${url.pathname}`;

      if (["POST /enqueue", "GET /events", "GET /report"].includes(route) && id !== "owner") {
        throw new RequestError(403);
      }
      if (route === "GET /events") {
        const after = Number(url.searchParams.get("after") ?? "0");
        requireValid(integer(after, 0));
        return reply(res, 200, store.events(after));
      }
      if (route === "GET /report") {
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
      if (route === "POST /enqueue") return reply(res, 200, store.enqueue(spec(body)));
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
  });
}
