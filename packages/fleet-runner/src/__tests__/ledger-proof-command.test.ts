import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { proofHash } from "../ledger-proof.js";
import { parseProofCommand, ProofCommandError, runProofCommand } from "../ledger-proof-command.js";
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
  chmodSync(node, 0o777);
  await expect(runProofCommand(command, {})).rejects.toThrow("proof-command-drift");
  chmodSync(node, 0o500);
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
it("keeps an actual helper failure and bounded stderr tail in the private receipt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "proof-command-error-"));
  dirs.push(dir);
  const node = join(dir, "node");
  copyFileSync(process.execPath, node);
  chmodSync(node, 0o500);
  const file = join(dir, "snapshot.mjs");
  const detail = "queue snapshot: unable to open database file\n";
  writeFileSync(
    file,
    `
    import { DatabaseSync } from "node:sqlite";
    try { new DatabaseSync(process.argv[2], { readOnly: true }); }
    catch {
      process.stderr.write("x".repeat(10000) + ${JSON.stringify(detail)});
      process.exitCode = 23;
    }
  `,
  );
  const command = parseProofCommand({
    program: node,
    args: [file, join(dir, "missing.sqlite")],
    sha256: proofHash(readFileSync(node)),
    files: { [file]: proofHash(readFileSync(file)) },
  });
  const error = await runProofCommand(command, {}).catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(ProofCommandError);
  const failure = error as ProofCommandError;
  expect(failure.message).toBe("proof-command-failed");
  expect(JSON.stringify(failure)).not.toContain(detail.trim());
  expect(failure.privateReceipt()).toMatchObject({
    reason: "exit",
    exitCode: 23,
    signal: null,
    stderrTruncated: true,
  });
  expect(failure.privateReceipt().stderr).toHaveLength(8192);
  expect(failure.privateReceipt().stderr.endsWith(detail)).toBe(true);
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

const sleepAt = Date.UTC(2026, 0, 15, 5);
const alarmAt = sleepAt + 420_000;
const plannedWake = { wakeAtMs: alarmAt, foreignSchedule: "" };
const scriptedSleep = "2026-01-14 23:00:00 -0600 Sleep Entering DarkWake due to Software Sleep";
const fullWake = "2026-01-14 23:07:00 -0600 Wake DarkWake to FullWake due to HID Activity Using AC";
const assertion =
  '2026-01-14 23:07:00 -0600 Assertions PID 123(powerd) Created UserIsActive "com.apple.powermanagement.wakeschedule" 00:00:00 id:0x31';
const evidence = (...events: string[]) => [scriptedSleep, ...events].join("\n");

it("corroborates a HID-tagged full wake with the matching powerd scheduled-wake assertion", () => {
  expect(sleepEvents(evidence(assertion, fullWake), sleepAt, plannedWake)).toEqual({
    sleepAtMs: sleepAt,
    wakeAtMs: alarmAt,
    wakeReason: "HID Activity",
    schedulerAssertionAtMs: alarmAt,
  });
});

it.each([
  ["bare HID activity", evidence(fullWake), "proof-scheduled-wake-assertion-missing"],
  [
    "an assertion after full wake",
    evidence(fullWake, assertion),
    "proof-scheduled-wake-assertion-missing",
  ],
  [
    "an assertion before the alarm",
    evidence(assertion.replace("23:07:00", "23:06:59"), fullWake),
    "proof-scheduled-wake-assertion-missing",
  ],
  [
    "a stale assertion before a later wake",
    evidence(assertion, fullWake.replace("23:07:00", "23:07:03")),
    "proof-scheduled-wake-assertion-missing",
  ],
  [
    "an early full wake",
    evidence(assertion, fullWake.replace("23:07:00", "23:06:59")),
    "proof-wake-time-mismatch",
  ],
  [
    "an assertion from another process",
    evidence(assertion.replace("(powerd)", "(other)"), fullWake),
    "proof-scheduled-wake-assertion-missing",
  ],
  [
    "an expired assertion",
    evidence(assertion.replace("Created", "TimedOut"), fullWake),
    "proof-scheduled-wake-assertion-missing",
  ],
  [
    "two plausible timer assertions",
    evidence(assertion, assertion.replace("0x31", "0x32"), fullWake),
    "proof-scheduled-wake-assertion-ambiguous",
  ],
])("rejects %s even at the scheduled time", (_name, log, reason) => {
  expect(() => sleepEvents(log, sleepAt, plannedWake)).toThrow(reason);
});

it.each([
  ["[event] wake at 01/14/2026 23:08:00 by 'other'", true],
  ["[event] wakeorpoweron at 01/14/2026 23:09:20 by 'other' leeway secs: 30", true],
  ["[event] wake at 01/14/2026 23:09:20 by 'leeway secs: 0' leeway secs: 30", true],
  ["[event] wake at 02/31/2026 06:00:00 by 'other'", true],
  ["Repeating power events:\n  wakepoweron at 11:07PM every day", true],
  ["[event] wake at 01/14/2026 23:10:00 by 'other'", false],
  ["Repeating power events:\n  wakepoweron at 11:07PM Thursday", false],
  ["Repeating power events:\n  wakepoweron at 6:00AM every day", false],
  ["[event] unknown at 01/14/2026 23:08:00 by 'other'", true],
])("checks competing events for scheduler attribution: %s", (foreignSchedule, ambiguous) => {
  const parse = () =>
    sleepEvents(evidence(assertion, fullWake), sleepAt, { ...plannedWake, foreignSchedule });
  if (ambiguous) expect(parse).toThrow("proof-wake-ownership-ambiguous");
  else expect(parse()).toMatchObject({ wakeAtMs: alarmAt });
});
