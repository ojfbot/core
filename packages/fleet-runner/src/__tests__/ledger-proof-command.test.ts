import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { proofHash } from "../ledger-proof.js";
import { parseProofCommand, runProofCommand } from "../ledger-proof-command.js";
import { sleepEvents } from "../ledger-proof-power.js";
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
it("runs only fixed hashed local helper bytes and refuses drift before subprocess execution", async () => {
  const dir = mkdtempSync(join(tmpdir(), "proof-command-"));
  dirs.push(dir);
  const node = join(dir, "node");
  copyFileSync(process.execPath, node);
  chmodSync(node, 0o500);
  const file = join(dir, "helper.mjs");
  writeFileSync(file, "process.stdout.write(JSON.stringify({checked:true}))");
  const command = parseProofCommand({
    program: node,
    args: [file],
    sha256: proofHash(readFileSync(node)),
    files: { [file]: proofHash(readFileSync(file)) },
  });
  expect(await runProofCommand(command, {})).toEqual({ checked: true });
  writeFileSync(file, "process.stdout.write(JSON.stringify({checked:false}))");
  await expect(runProofCommand(command, {})).rejects.toThrow("proof-command-drift");
  expect(() => parseProofCommand({ ...command, program: "/bin/sh" })).toThrow();
  await expect(
    runProofCommand(command, {}, undefined, 1000, { NODE_OPTIONS: "--require anything" }),
  ).rejects.toThrow("proof-command-environment-refused");
});
it("bounds a stuck helper instead of leaving it running", async () => {
  const dir = mkdtempSync(join(tmpdir(), "proof-command-"));
  dirs.push(dir);
  const node = join(dir, "node");
  copyFileSync(process.execPath, node);
  chmodSync(node, 0o500);
  const file = join(dir, "hang.mjs");
  writeFileSync(file, 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)');
  const command = parseProofCommand({
    program: node,
    args: [file],
    sha256: proofHash(readFileSync(node)),
    files: { [file]: proofHash(readFileSync(file)) },
  });
  const started = Date.now();
  await expect(runProofCommand(command, {}, undefined, 100)).rejects.toThrow(
    "proof-command-failed",
  );
  expect(Date.now() - started).toBeLessThan(2000);
});
it("requires a real Sleep/Wake pair and ignores DarkWake or assertion prose", () => {
  const start = Date.UTC(2026, 10, 17, 5);
  const sleep =
    "2026-11-16 23:00:00 -0600 Sleep              Entering Sleep state due to 'Software Sleep'";
  const wake =
    "2026-11-16 23:07:00 -0600 Wake               Wake from Deep Idle due to RTC/Alarm Using AC";
  expect(sleepEvents(`${sleep}\n${wake}`, start)).toEqual({
    sleepAtMs: start,
    wakeAtMs: start + 420_000,
    wakeReason: "RTC/Alarm",
  });
  expect(() =>
    sleepEvents(`${sleep}\n2026-11-16 23:07:00 -0600 DarkWake from Deep Idle`, start),
  ).toThrow();
  expect(() => sleepEvents(`${sleep}\n${sleep}\n${wake}`, start)).toThrow();
});
