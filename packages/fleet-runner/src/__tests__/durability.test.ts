import { mkdtempSync, readdirSync, rmSync, fsyncSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { JobStore, writeOutput } from "../jobs.js";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, fsyncSync: vi.fn(fs.fsyncSync) };
});

it("rolls completion back and removes the temporary file when syncing output fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-sync-fault-"));
  const store = new JobStore(":memory:");
  try {
    const { key } = store.enqueue({ kind: "noop", inputs: ["synthetic"], payload: null });
    const claim = store.claim("worker", [], ["noop"])!;
    vi.mocked(fsyncSync).mockImplementationOnce(() => {
      throw Object.assign(new Error("synthetic disk fault"), { code: "EIO" });
    });
    expect(() =>
      store.complete(key, claim.fence, "worker", () => writeOutput(dir, claim, "synthetic")),
    ).toThrow("synthetic disk fault");
    expect(store.get(key)).toMatchObject({ status: "claimed", output: null });
    expect(readdirSync(dir)).toEqual([]);
    expect(
      store.complete(key, claim.fence, "worker", () => writeOutput(dir, claim, "synthetic")),
    ).toBe(true);
    expect(store.get(key)).toMatchObject({ status: "done" });
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("does not acknowledge done when directory durability fails after the final link", () => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-directory-fault-"));
  const store = new JobStore(":memory:");
  const realSync = vi.mocked(fsyncSync).getMockImplementation()!;
  try {
    const { key } = store.enqueue({ kind: "noop", inputs: ["synthetic"], payload: null });
    const claim = store.claim("worker", [], ["noop"])!;
    vi.mocked(fsyncSync)
      .mockImplementationOnce(realSync)
      .mockImplementationOnce(() => {
        throw new Error("synthetic directory fault");
      });
    expect(() =>
      store.complete(key, claim.fence, "worker", () => writeOutput(dir, claim, "synthetic")),
    ).toThrow("synthetic directory fault");
    expect(store.get(key)).toMatchObject({ status: "claimed", output: null });
    expect(readdirSync(dir)).toEqual([`${key}.${claim.fence}.jsonl`]);
    expect(store.events(0).some((e) => e.type === "completed")).toBe(false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
