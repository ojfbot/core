import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
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
      child.stderr.on("data", collect);
      const cleanup = (): void => {
        clearInterval(deadline);
        if (restart) clearTimeout(restart);
        if (force) clearTimeout(force);
        signal.removeEventListener("abort", stop);
        kill("SIGKILL");
      };
      child.once("error", () => {
        cleanup();
        reject(Error("proof-child-start-failed"));
      });
      child.once("close", (code) => {
        cleanup();
        resolve(code ?? 1);
      });
      if (signal.aborted) stop();
    });
  if (journal.get("launcher-started")) throw Error("proof-launcher-already-started");
  try {
    if (config.role === "primary" && Date.now() >= config.proof.startsAtMs - 30_000)
      throw Error("proof-idle-restart-margin-held");
    if (signal.aborted) throw Error("proof-launcher-expired");
    journal.put("launcher-started", Date.now());
    if (config.role === "primary") {
      if ((await run(true)) !== 0 || journal.get("idle-stopped") !== true || journal.get("claimed"))
        throw Error("proof-idle-restart-unverified");
    }
    if (signal.aborted || Date.now() >= config.proof.endsAtMs)
      throw Error("proof-launcher-expired");
    if ((await run(false)) !== 0) throw Error("proof-child-held");
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
