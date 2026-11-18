import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import { canonicalJson } from "../jobs.js";
import { parseLedgerProof, proofHash } from "../ledger-proof.js";
import {
  AUTHORIZATION_TIMEOUT_MS,
  MAX_WAKE_LEAD_SECONDS,
  MIN_WAKE_LEAD_SECONDS,
  WAKE_RESERVATION_SECONDS,
  cancelProofWake,
  hasWakeHelper,
  parseWakeRequest,
  scheduleWithoutOwn,
  verifiedProofWake,
  wakeAuthorization,
  wakePreparationMatches,
} from "../ledger-proof-power.js";

const system = vi.hoisted(() => ({ exec: vi.fn(), ps: vi.fn() }));
vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof import("node:child_process")>()),
  execFileSync: system.exec,
  spawnSync: system.ps,
}));

it("verifies and safely cancels a wake recorded against an empty macOS schedule", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wake-empty-baseline-"));
  const localWake = new Date(2026, 10, 18, 1, 25).getTime();
  try {
    const plan = parseWakeRequest({
      proofId: "12345678-1234-4234-8234-123456789abc",
      approvalExpiresAtMs: localWake + 60 * 60_000,
      wakeAtMs: localWake,
      directory,
      protectedProbe: { program: process.execPath, args: [], sha256: "a".repeat(64), files: {} },
    });
    const auth = wakeAuthorization(plan);
    const { proofId, approvalExpiresAtMs, wakeAtMs } = plan;
    const identity = { proofId, approvalExpiresAtMs, wakeAtMs };
    const owner = `cg307-u1-${proofId}`;
    const baseline = { ...identity, owner, schedule: "", policy: "unchanged" };
    const record = (file: string, body: unknown) =>
      writeFileSync(join(directory, file), canonicalJson(body), { mode: 0o600 });
    record("power-baseline.json", baseline);
    record("wake-prepared.json", {
      ...identity,
      baselineSha256: proofHash(canonicalJson(baseline)),
      authorizationSha256: proofHash(auth.command),
      cleanupAtMs: auth.cleanupAtMs,
      cleanupPid: 27,
    });
    writeFileSync(auth.flag, `${proofId}\n`, { mode: 0o600 });
    const own = `Scheduled power events:\n [0]  wake at 11/18/2026 01:25:00 by '${owner}'\n`;
    const foreign = " [1]  wake at 11/18/2026 02:00:00 by 'another-owner'\n";
    let current = own;
    system.exec.mockImplementation((program, args) => {
      expect(program).toBe("/usr/bin/pmset");
      if (args.join(" ") === "-g sched") return current;
      expect(args).toEqual(["-g", "custom"]);
      return baseline.policy;
    });
    system.ps.mockReturnValue({ status: 0, stdout: ` 0 /bin/sh -c ${auth.cleanup}\n` });
    expect(verifiedProofWake(plan)).toBe(true);
    current = own + foreign;
    expect(verifiedProofWake(plan)).toBe(false);
    current = "Scheduled power events:\n" + foreign;
    system.ps.mockReturnValue({ status: 0, stdout: " 0 /usr/libexec/unrelated\n" });
    await expect(cancelProofWake(plan)).rejects.toThrow("proof-schedule-baseline-changed");
    expect(existsSync(auth.flag)).toBe(false);
    current = "";
    await expect(cancelProofWake(plan)).resolves.toMatchObject({ wakeEntryRemoved: true });
    expect(() => scheduleWithoutOwn(plan, "\0")).toThrow("proof-schedule-baseline-changed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
    system.exec.mockReset();
    system.ps.mockReset();
  }
});

it.each(["full-dialog-window", "revoked", "too-late", "too-early", "pmset-refused", "quoted-path"])(
  "executes the bounded wake command offline: %s",
  async (mode) => {
    const dir = mkdtempSync(join(tmpdir(), "wake-contract-"));
    const start = Math.floor(Date.now() / 1000) * 1000;
    const proof = parseLedgerProof({
      schemaVersion: 1,
      proofId: "12345678-1234-4234-8234-123456789abc",
      startsAtMs: start,
      endsAtMs: start + 90 * 60_000,
      approvalExpiresAtMs: start + 24 * 3600_000,
      code: "a".repeat(40),
      fixtureSha256: "b".repeat(64),
      timeZone: "UTC",
      primary: "cg307-primary-12345678",
      fallback: "cg307-fallback-12345678",
      capability: "cg307-ledger-12345678",
    });
    const powerDir = mode === "quoted-path" ? join(dir, "flag's $(never-run)") : dir;
    if (powerDir !== dir) mkdirSync(powerDir, { mode: 0o700 });
    const plan = parseWakeRequest({
      proofId: proof.proofId,
      approvalExpiresAtMs: proof.approvalExpiresAtMs,
      wakeAtMs: start + 420_000,
      directory: powerDir,
      protectedProbe: { program: process.execPath, args: [], sha256: "a".repeat(64), files: {} },
    });
    const auth = wakeAuthorization(plan),
      clock = join(dir, "clock"),
      log = join(dir, "calls");
    if (mode === "full-dialog-window") {
      const earliestPrep = plan.wakeAtMs - 420_000 - 180_000;
      const afterFullPrompt =
        plan.wakeAtMs - WAKE_RESERVATION_SECONDS * 1000 + AUTHORIZATION_TIMEOUT_MS;
      const lastReadback = plan.wakeAtMs - (MIN_WAKE_LEAD_SECONDS - 5) * 1000;
      expect(earliestPrep - afterFullPrompt).toBeGreaterThanOrEqual(12 * 60_000);
      expect(earliestPrep - lastReadback).toBeGreaterThanOrEqual(9 * 60_000);
      expect(hasWakeHelper(plan, "    0 /usr/libexec/unrelated\n")).toBe(false);
      expect(hasWakeHelper(plan, `  501 /bin/sh -c ${auth.cleanup}\n`)).toBe(false);
      expect(hasWakeHelper(plan, `    0 /bin/sh -c ${auth.cleanup}\n`)).toBe(true);
      expect(hasWakeHelper(plan, `    0 /bin/sh -c ${auth.command}\n`)).toBe(true);
      expect(hasWakeHelper(plan, `    0 /bin/sh -c ${auth.cleanup}x\n`)).toBe(false);
      const baseline = {
        proofId: plan.proofId,
        approvalExpiresAtMs: plan.approvalExpiresAtMs,
        wakeAtMs: plan.wakeAtMs,
        owner: `cg307-u1-${plan.proofId}`,
        policy: "original policy",
        schedule: "",
      };
      const receipt = {
        proofId: plan.proofId,
        approvalExpiresAtMs: plan.approvalExpiresAtMs,
        wakeAtMs: plan.wakeAtMs,
        cleanupPid: 27,
        cleanupAtMs: auth.cleanupAtMs,
        baselineSha256: proofHash(canonicalJson(baseline)),
        authorizationSha256: proofHash(auth.command),
      };
      expect(wakePreparationMatches(plan, receipt, baseline)).toBe(true);
      expect(wakePreparationMatches(plan, receipt, {})).toBe(false);
      expect(wakePreparationMatches(plan, receipt, { ...baseline, schedule: "foreign" })).toBe(
        false,
      );
      expect(wakePreparationMatches(plan, { ...receipt, authorizationSha256: "x" }, baseline)).toBe(
        false,
      );
      expect(
        wakePreparationMatches(
          plan,
          { ...receipt, cleanupAtMs: auth.cleanupAtMs + 1000 },
          baseline,
        ),
      ).toBe(false);
      const own = ` [0]  wake at 11/17/2026 22:19:00 by 'cg307-u1-${proof.proofId}'\n`;
      const unrelated = " [1]  poweron at 11/18/2026 08:10:00 by 'other'\n";
      const repeating = "Repeating power events:\n  wake at 8:00AM weekdays\n";
      expect(scheduleWithoutOwn(plan, "No scheduled events.\n")).toBe(
        scheduleWithoutOwn(plan, `Scheduled power events:\n${own}`),
      );
      expect(scheduleWithoutOwn(plan, "")).toBe(
        scheduleWithoutOwn(plan, `Scheduled power events:\n${own}`),
      );
      expect(
        scheduleWithoutOwn(plan, `${repeating}Scheduled power events:\n${own}${unrelated}`),
      ).toBe(
        scheduleWithoutOwn(
          plan,
          `${repeating}Scheduled power events:\n${unrelated.replace("[1]", "[0]")}`,
        ),
      );
      expect(
        scheduleWithoutOwn(plan, `${repeating}Scheduled power events:\n${own}${unrelated}`),
      ).not.toBe(
        scheduleWithoutOwn(
          plan,
          `${repeating}Scheduled power events:\n${own}${unrelated.replace("08:10:00", "08:11:00")}`,
        ),
      );
    }
    writeFileSync(auth.flag, "active");
    const authorizationAt =
      mode === "too-late"
        ? plan.wakeAtMs - (MIN_WAKE_LEAD_SECONDS - 1) * 1000
        : mode === "too-early"
          ? plan.wakeAtMs - (MAX_WAKE_LEAD_SECONDS + 1) * 1000
          : plan.wakeAtMs - WAKE_RESERVATION_SECONDS * 1000 + AUTHORIZATION_TIMEOUT_MS;
    writeFileSync(clock, String(Math.floor(authorizationAt / 1000)));
    const script = (name: string, body: string) => {
      const file = join(dir, name);
      writeFileSync(file, `#!${process.execPath}\n${body}`, { mode: 0o700 });
      return file;
    };
    const date = script(
      "fake-date",
      `const fs=require('node:fs');process.stdout.write(fs.readFileSync(${JSON.stringify(clock)},'utf8'))`,
    );
    const sleep = script(
      "fake-sleep",
      `const fs=require('node:fs');const p=${JSON.stringify(clock)};fs.writeFileSync(p,String(Number(fs.readFileSync(p,'utf8'))+1))`,
    );
    const pmset = script(
      "fake-pmset",
      `const fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');if(a[1]==='wake'){fs.writeFileSync(${JSON.stringify(clock)},'${Math.floor(auth.cleanupAtMs / 1000) - 2}');${mode === "revoked" ? `fs.unlinkSync(${JSON.stringify(auth.flag)});` : ""}${mode === "pmset-refused" ? "process.exit(2);" : ""}}`,
    );
    // Replace only system executables for this offline interpreter test. No administrator call,
    // real pmset invocation, wake event, global setting or persistent process is created.
    const command = auth.command
      .replaceAll("/usr/bin/pmset", pmset)
      .replaceAll("/bin/date", date)
      .replaceAll("/bin/sleep", sleep);
    const run = await new Promise<{ status: number | null; stdout: string; pid: number }>(
      (resolve, reject) => {
        const child = spawn("/bin/sh", ["-c", command], {
          detached: true,
          stdio: ["ignore", "pipe", "ignore"],
        });
        let output = "";
        const timer = setTimeout(() => {
          if (child.pid)
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {}
          reject(Error("offline-wake-deadline"));
        }, 5000);
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
          output += chunk;
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (!child.pid) reject(Error("offline-wake-start-failed"));
          else resolve({ status: code, stdout: output, pid: child.pid });
        });
      },
    );
    try {
      if (mode === "too-late" || mode === "too-early") {
        expect(run.status).toBe(0);
        expect(run.stdout.trim()).toBe("window");
        expect(existsSync(log)).toBe(false);
        return;
      }
      expect(run.status).toBe(0);
      if (mode === "pmset-refused") expect(run.stdout.trim()).toBe("schedule");
      else if (mode === "revoked") expect(run.stdout.trim()).toBe("window");
      else expect(run.stdout.trim()).toMatch(/^[1-9][0-9]*$/);
      const end = Date.now() + 5000;
      while (
        (!existsSync(log) || readFileSync(log, "utf8").trim().split("\n").length < 2) &&
        Date.now() < end
      )
        await delay(20);
      const calls = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(calls[0].slice(0, 2)).toEqual(["schedule", "wake"]);
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls.length).toBeLessThanOrEqual(mode === "revoked" ? 3 : 2);
      for (const cancel of calls.slice(1)) {
        expect(cancel.slice(0, 3)).toEqual(["schedule", "cancel", "wake"]);
        expect(cancel.slice(3)).toEqual(calls[0].slice(2));
      }
      expect(calls[0].at(-1)).toBe(`cg307-u1-${proof.proofId}`);
    } finally {
      try {
        process.kill(-run.pid, "SIGKILL");
      } catch {
        /* The finite command already exited. */
      }
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
