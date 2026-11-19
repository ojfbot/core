import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { ProofStderr } from "./ledger-proof-command.js";
import { ProofJournal } from "./ledger-proof-state.js";
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
        if (code !== 0 || spawnError !== undefined) {
          try {
            journal.observe("private-child-failure", {
              role: config.role,
              exitCode: code,
              signal: exitSignal ?? null,
              ...(spawnError === undefined ? {} : { spawnError }),
              ...stderr.receipt(),
            });
          } catch (error) {
            reject(error);
            return;
          }
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
    const idleRestart = config.role === "primary" && !config.proof.faultMode;
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
    if (config.role === "primary") rmSync(join(config.evidenceDir, "wake-active"), { force: true });
    throw error;
  }
}
