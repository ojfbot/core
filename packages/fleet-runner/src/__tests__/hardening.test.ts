import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";
import { generateToken, signer } from "../auth.js";
import { errorCode } from "../diagnostics.js";
import { JobStore } from "../jobs.js";
import { fleetServer } from "../server.js";

it("rejects unknown signers and oversized controls before waiting for their upload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-limits-"));
  generateToken(join(dir, "worker"));
  const store = new JobStore(":memory:");
  const server = fleetServer(store, { registry: dir, outDir: dir });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing listener");
  const base = `http://127.0.0.1:${address.port}`;
  const probe = (authorization: string, target: string, length: number) =>
    new Promise<number>((resolve, reject) => {
      const req = request(base + target, {
        method: "POST",
        headers: { authorization, "content-length": length, expect: "100-continue" },
      });
      req.once("continue", () => reject(new Error("upload was invited before rejection")));
      req.once("response", (res) => {
        res.resume();
        res.once("end", () => resolve(res.statusCode!));
      });
      req.once("error", reject);
      req.end(); // Intentionally send no declared body. Rejection must not wait for it.
    });
  try {
    expect(await probe("unregistered", "/complete", 16 * 1024 * 1024)).toBe(401);
    const authorize = signer("worker", join(dir, "worker"));
    expect(await probe(authorize("POST", "/claim", Buffer.alloc(0)), "/claim", 64 * 1024 + 1)).toBe(
      413,
    );
    expect(
      await probe(
        authorize("POST", "/complete", Buffer.alloc(0)),
        "/complete",
        16 * 1024 * 1024 + 1,
      ),
    ).toBe(413);
    const body = Buffer.alloc(64 * 1024 + 1, 0x20);
    const chunked = await new Promise<number>((resolve, reject) => {
      const req = request(base + "/claim", {
        method: "POST",
        headers: { authorization: authorize("POST", "/claim", body) },
      });
      req.once("response", (res) => {
        res.resume();
        res.once("end", () => resolve(res.statusCode!));
      });
      req.once("error", reject);
      req.write(body.subarray(0, 32 * 1024));
      req.end(body.subarray(32 * 1024));
    });
    expect(chunked).toBe(413);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("uses verified HTTPS and rejects an untrusted certificate without bypassing verification", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-tls-"));
  const cert = join(dir, "cert.pem"),
    key = join(dir, "key.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=fleet-test",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
      "-keyout",
      key,
      "-out",
      cert,
    ],
    { stdio: "ignore" },
  );
  generateToken(join(dir, "owner"));
  const store = new JobStore(":memory:");
  const server = fleetServer(store, {
    registry: dir,
    outDir: dir,
    tls: { cert: readFileSync(cert), key: readFileSync(key) },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing listener");
  const endpoint = `https://127.0.0.1:${address.port}`;
  try {
    await expect(fetch(endpoint + "/report")).rejects.toThrow();
    for (const name of ["auth", "client"]) {
      writeFileSync(
        join(dir, `${name}.mjs`),
        ts
          .transpileModule(
            readFileSync(fileURLToPath(new URL(`../${name}.ts`, import.meta.url)), "utf8"),
            {
              compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
            },
          )
          .outputText.replaceAll('"./auth.js"', '"./auth.mjs"'),
      );
    }
    // Async spawn lets the parent keep serving while the separately trusted client connects.
    const { spawn } = await import("node:child_process");
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import { fleetClient } from ${JSON.stringify(new URL(`file://${join(dir, "client.mjs")}`).href)};
      const report = await fleetClient(process.env.ENDPOINT, "owner", process.env.TOKEN_FILE).report();
      if (!report.now) process.exit(1);
    `,
      ],
      {
        env: {
          ...process.env,
          NODE_EXTRA_CA_CERTS: cert,
          ENDPOINT: endpoint,
          TOKEN_FILE: join(dir, "owner"),
        },
        stdio: "ignore",
      },
    );
    const { once } = await import("node:events");
    const [code] = await once(child, "exit");
    expect(code).toBe(0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("keeps private messages and paths out of diagnostics", () => {
  const error = Object.assign(new Error("synthetic private detail"), { code: "EACCES" });
  expect(errorCode(error)).toBe("EACCES");
  expect(errorCode(new Error("synthetic private detail"))).toBe("unexpected-error");
  expect(errorCode(new Error("job table schema 99, expected 3"))).toBe("schema-incompatible");
});
