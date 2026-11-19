import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { ProofStderr } from "./ledger-proof-command.js";
import { ProofJournal } from "./ledger-proof-state.js";
import { object } from "./ledger-proof.js";
import { canonicalJson } from "./jobs.js";
import type { ProofRuntime } from "./ledger-proof-runtime.js";

/** Fixed self-command only. Two primary boots before admission; two supervisor boots across acceptance. */
export async function launchLedgerProof(
  config: ProofRuntime,
  journal: ProofJournal,
  file: string,
  digest: string,
  signal: AbortSignal,
): Promise<void> {
  const run = (idleRestart: boolean): Promise<number> =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [process.argv[1]!, "ledger-proof", "run", "--settings", file, "--sha256", digest],
        {
          shell: false,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
            ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
            ...(config.settings.caFile ? { NODE_EXTRA_CA_CERTS: config.settings.caFile } : {}),
          },
        },
      );
      let bytes = 0,
        stopping = false;
      const stderr = new ProofStderr();
      let spawnError: string | undefined;
      let force: ReturnType<typeof setTimeout> | undefined;
      const kill = (s: NodeJS.Signals): void => {
        try {
          if (child.pid) process.kill(-child.pid, s);
        } catch {
          /* already exited */
        }
      };
      const stop = (): void => {
        if (stopping) return;
        stopping = true;
        kill("SIGTERM");
        force = setTimeout(() => kill("SIGKILL"), 8000);
      };
      const deadline = setInterval(() => {
        if (Date.now() >= config.proof.endsAtMs) stop();
      }, 1000);
      const restart = idleRestart ? setTimeout(stop, 2000) : undefined;
      signal.addEventListener("abort", stop, { once: true });
      const collect = (chunk: Buffer): void => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) stop();
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", (chunk: Buffer) => {
        collect(chunk);
        stderr.append(chunk);
      });
      const cleanup = (): void => {
        clearInterval(deadline);
        if (restart) clearTimeout(restart);
        if (force) clearTimeout(force);
        signal.removeEventListener("abort", stop);
        kill("SIGKILL");
      };
      child.once("error", (error) => {
        spawnError = error.message.slice(0, 1024);
      });
      child.once("close", (code, exitSignal) => {
        cleanup();
        try {
          if (config.proof.practice) {
            journal.put("practice-child-exit", { exitCode: code, signal: exitSignal });
          }
          if (code !== 0 || spawnError !== undefined) {
            journal.observe("private-child-failure", {
              role: config.role,
              exitCode: code,
              signal: exitSignal ?? null,
              ...(spawnError === undefined ? {} : { spawnError }),
              ...stderr.receipt(),
            });
          }
        } catch (error) {
          reject(error);
          return;
        }
        if (spawnError !== undefined) {
          reject(Error("proof-child-start-failed"));
          return;
        }
        resolve(code ?? 1);
      });
      if (signal.aborted) stop();
    });
  if (journal.get("launcher-started")) throw Error("proof-launcher-already-started");
  try {
    const idleRestart =
      config.role === "primary" && !config.proof.faultMode && !config.proof.practice;
    if (idleRestart && Date.now() >= config.proof.startsAtMs - 30_000)
      throw Error("proof-idle-restart-margin-held");
    if (signal.aborted) throw Error("proof-launcher-expired");
    journal.put("launcher-started", Date.now());
    if (idleRestart) {
      if ((await run(true)) !== 0 || journal.get("idle-stopped") !== true || journal.get("claimed"))
        throw Error("proof-idle-restart-unverified");
    }
    if (signal.aborted || Date.now() >= config.proof.endsAtMs)
      throw Error("proof-launcher-expired");
    if ((await run(false)) !== 0) throw Error("proof-child-held");
    if (config.proof.practice) {
      const terminal = journal.get("terminal");
      const stop = journal.get("practice-stop");
      if (
        !terminal ||
        !stop ||
        object(terminal).outcome !== "STOPPED" ||
        object(terminal).reason !== "operator-stop" ||
        canonicalJson(object(terminal).stop) !== canonicalJson(stop)
      )
        throw Error("proof-practice-terminal-unverified");
      journal.put("practice-launcher", {
        outcome: "STOPPED",
        child: journal.get("practice-child-exit"),
        atMs: Date.now(),
      });
      return;
    }
    if (config.role === "primary" && config.proof.faultMode === "worker-stop") {
      if (!journal.get("worker-stop")) throw Error("proof-worker-stop-unverified");
      journal.put("worker-stop-exited", Date.now());
      if (signal.aborted || Date.now() >= config.proof.endsAtMs)
        throw Error("proof-launcher-expired");
      if ((await run(false)) !== 0 || !journal.result("stale-complete"))
        throw Error("proof-stale-check-unverified");
    }
    if (config.role === "supervisor" && journal.get("restart-required") === true) {
      if (signal.aborted || Date.now() >= config.proof.endsAtMs)
        throw Error("proof-supervisor-restart-expired");
      if ((await run(false)) !== 0 || !journal.get("restart-observed"))
        throw Error("proof-supervisor-restart-unverified");
    }
    journal.put("launcher-complete", Date.now());
  } catch (error) {
    if (config.proof.practice) {
      const reason =
        error instanceof Error && /^proof-[a-z-]+$/.test(error.message)
          ? error.message
          : "proof-practice-launcher-failed";
      const child = journal.get("practice-child-exit") ?? null;
      journal.recordPracticeFirstFailure({
        source: "launcher",
        reason,
        child,
        atMs: Date.now(),
      });
      journal.put("practice-launcher", {
        outcome: "HELD",
        child,
        reason,
        atMs: Date.now(),
      });
    }
    if (config.role === "primary") rmSync(join(config.evidenceDir, "wake-active"), { force: true });
    throw error;
  }
}
