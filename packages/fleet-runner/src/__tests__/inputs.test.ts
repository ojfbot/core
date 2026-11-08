import { createServer } from "node:http";
import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateToken, signer } from "../auth.js";
import { fleetClient } from "../client.js";
import { inputHash, MAX_INPUT_BYTES, putInput } from "../inputs.js";
import { JobStore } from "../jobs.js";
import { fleetServer } from "../server.js";

let dir: string;
let store: JobStore;
let server: ReturnType<typeof fleetServer>;
let base: string;
let now: number;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "fleet-inputs-"));
  for (const id of ["owner", "worker", "other"]) generateToken(join(dir, id));
  now = 1000;
  store = new JobStore(":memory:", { now: () => now, leaseMs: 100 });
  server = fleetServer(store, {
    registry: dir,
    outDir: join(dir, "out"),
    inputDir: join(dir, "inputs"),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});
const bytes = Buffer.from("synthetic image bytes only");
const client = (id: string) => fleetClient(base, id, join(dir, id));
async function admitted() {
  const hash = await client("owner").uploadInput(bytes);
  const { key } = await client("owner").enqueue({ kind: "fixture", inputs: [hash], payload: null });
  const claim = (await client("worker").claim([], ["fixture"]))!;
  return { hash, key, claim };
}
it("delivers owner-uploaded bytes only to the current holder and revokes at release/expiry", async () => {
  const { hash, claim } = await admitted();
  expect(await client("worker").downloadInput(claim, hash)).toEqual(bytes);
  await expect(client("other").downloadInput(claim, hash)).rejects.toMatchObject({ status: 403 });
  await expect(
    client("worker").downloadInput({ ...claim, fence: claim.fence + 1 }, hash),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    client("worker").downloadInput(claim, inputHash(Buffer.from("unrelated"))),
  ).rejects.toMatchObject({ status: 403 });
  now = 1100;
  await expect(client("worker").downloadInput(claim, hash)).rejects.toMatchObject({ status: 403 });
  now = 1000;
  await client("worker").release(claim);
  await expect(client("worker").downloadInput(claim, hash)).rejects.toMatchObject({ status: 403 });
});
it("rejects worker uploads, missing input admission, tampered uploads, traversal and oversized bodies", async () => {
  await expect(client("worker").uploadInput(bytes)).rejects.toMatchObject({ status: 403 });
  await expect(
    client("owner").enqueue({ kind: "fixture", inputs: [inputHash(bytes)], payload: null }),
  ).rejects.toMatchObject({ status: 400 });
  const target = `/inputs/${inputHash(bytes)}`;
  const wrong = Buffer.from("wrong bytes");
  expect(
    (
      await fetch(base + target, {
        method: "POST",
        body: wrong,
        headers: { authorization: signer("owner", join(dir, "owner"))("POST", target, wrong) },
      })
    ).status,
  ).toBe(400);
  await expect(
    client("worker").downloadInput({ key: "a".repeat(64), fence: 1 }, "../outside"),
  ).rejects.toThrow("invalid-input-request");
  await expect(client("owner").uploadInput(Buffer.alloc(MAX_INPUT_BYTES + 1))).rejects.toThrow(
    "input-too-large",
  );
  expect((await fetch(base + target)).status).toBe(401);
});
it("checks stored bytes again before delivery and leaves no partial upload on collision", async () => {
  const { hash, claim } = await admitted();
  chmodSync(join(dir, "inputs", hash), 0o600);
  writeFileSync(join(dir, "inputs", hash), "corruption");
  await expect(client("worker").downloadInput(claim, hash)).rejects.toMatchObject({ status: 500 });
  expect(() => putInput(join(dir, "inputs"), hash, bytes)).toThrow();
  expect(readdirSync(join(dir, "inputs"))).toEqual([hash]);
});
it("rejects corrupt/truncated downloads and aborts without publishing a local input", async () => {
  const fake = createServer((_req, res) => {
    res.end("corrupt");
  });
  await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
  const consumer = fleetClient(
    `http://127.0.0.1:${(fake.address() as { port: number }).port}`,
    "worker",
    join(dir, "worker"),
  );
  try {
    await expect(
      consumer.downloadInput({ key: "a".repeat(64), fence: 1 }, inputHash(bytes)),
    ).rejects.toThrow("input-mismatch");
    await expect(
      consumer.downloadInput(
        { key: "a".repeat(64), fence: 1 },
        inputHash(bytes),
        AbortSignal.abort(),
      ),
    ).rejects.toThrow();
    expect(readdirSync(dir).some((name) => name.includes("tmp"))).toBe(false);
  } finally {
    await new Promise<void>((resolve) => fake.close(() => resolve()));
  }
});
