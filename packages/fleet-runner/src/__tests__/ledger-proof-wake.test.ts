import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { parseLedgerProof } from "../ledger-proof.js";
import { parsePowerPlan, wakeAuthorization } from "../ledger-proof-power.js";

it.each(["deadline", "revoked", "too-late", "quoted-path"])(
  "executes the bounded wake command offline: %s",
  async (mode) => {
    const dir = mkdtempSync(join(tmpdir(), "wake-contract-"));
    const start = Date.now();
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
    const plan = parsePowerPlan(
      {
        wakeAtMs: start + 420_000,
        directory: powerDir,
        protectedProbe: { program: process.execPath, args: [], sha256: "a".repeat(64), files: {} },
      },
      proof,
    );
    const auth = wakeAuthorization(plan),
      clock = join(dir, "clock"),
      log = join(dir, "calls");
    writeFileSync(auth.flag, "active");
    writeFileSync(
      clock,
      String(Math.floor((mode === "too-late" ? plan.wakeAtMs + 1_000 : start) / 1000)),
    );
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
      `const fs=require('node:fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');if(a[1]==='wake'){fs.writeFileSync(${JSON.stringify(clock)},'${Math.floor(auth.cleanupAtMs / 1000) - 2}');${mode === "revoked" ? `fs.unlinkSync(${JSON.stringify(auth.flag)})` : ""}}`,
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
      if (mode === "too-late") {
        expect(run.status).toBe(1);
        expect(existsSync(log)).toBe(false);
        return;
      }
      expect(run.status).toBe(0);
      expect(run.stdout.trim()).toMatch(/^[1-9][0-9]*$/);
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
      expect(calls).toHaveLength(2);
      expect(calls[0].slice(0, 2)).toEqual(["schedule", "wake"]);
      expect(calls[1].slice(0, 3)).toEqual(["schedule", "cancel", "wake"]);
      expect(calls[1].slice(3)).toEqual(calls[0].slice(2));
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
