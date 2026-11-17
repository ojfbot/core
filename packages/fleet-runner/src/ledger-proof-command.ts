import { spawn } from "node:child_process";
import { readFileSync, lstatSync } from "node:fs";
import { basename } from "node:path";
import { exact, privatePath, proofHash, string } from "./ledger-proof.js";

/** Operator-selected immutable helper. Neither a job nor a peer message can supply its argv. */
export interface ProofCommand {
  program: string;
  args: string[];
  sha256: string;
  files: Record<string, string>;
}
export function parseProofCommand(value: unknown): ProofCommand {
  const row = exact(value, ["program", "args", "sha256", "files"]);
  const program = privatePath(row.program),
    sha256 = string(row.sha256, /^[a-f0-9]{64}$/);
  if (
    ["sh", "bash", "zsh", "fish", "env", "claude", "codex", "python", "python3"].includes(
      basename(program),
    )
  )
    throw Error("proof-command-refused");
  if (
    !Array.isArray(row.args) ||
    row.args.length > 32 ||
    !row.args.every((v) => typeof v === "string" && v.length <= 4096 && !v.includes("\0"))
  )
    throw Error("proof-command-refused");
  const filesRow = row.files;
  if (
    !filesRow ||
    typeof filesRow !== "object" ||
    Array.isArray(filesRow) ||
    Object.keys(filesRow).length > 64
  )
    throw Error("proof-command-refused");
  const files: Record<string, string> = {};
  for (const [file, digest] of Object.entries(filesRow))
    files[privatePath(file)] = string(digest, /^[a-f0-9]{64}$/);
  return { program, args: [...row.args] as string[], sha256, files };
}
export function verifyProofCommand(command: ProofCommand): void {
  for (const [file, digest] of Object.entries({
    ...command.files,
    [command.program]: command.sha256,
  })) {
    const info = lstatSync(file);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.mode & 0o022 ||
      proofHash(readFileSync(file)) !== digest
    )
      throw Error("proof-command-drift");
  }
}
/** One bounded process group, bounded stdout, no inherited credentials or shell interpolation. */
export async function runProofCommand(
  command: ProofCommand,
  input: unknown,
  signal?: AbortSignal,
  timeoutMs = 10_000,
  environment: Record<string, string> = {},
): Promise<unknown> {
  const allowed = new Set([
    "HELPDESK_URL",
    "HELPDESK_DEVICE_WRITER",
    "HELPDESK_DEVICE_KEY",
    "NODE_EXTRA_CA_CERTS",
  ]);
  if (Object.keys(environment).some((key) => !allowed.has(key)))
    throw Error("proof-command-environment-refused");
  verifyProofCommand(command);
  if (signal?.aborted) throw Error("proof-command-aborted");
  return new Promise((resolve, reject) => {
    const child = spawn(command.program, command.args, {
      detached: true,
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
      env: {
        ...environment,
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
      },
    });
    let bytes = Buffer.alloc(0),
      failed = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals): void => {
      try {
        if (child.pid) process.kill(-child.pid, signal);
      } catch {
        /* already reaped */
      }
    };
    const stop = (): void => {
      if (!failed) {
        failed = true;
        kill("SIGTERM");
        killTimer = setTimeout(() => kill("SIGKILL"), 500);
      }
    };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener("abort", stop, { once: true });
    const cleanup = (): void => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      signal?.removeEventListener("abort", stop);
      kill("SIGKILL");
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (bytes.length + chunk.length > 64 * 1024) stop();
      else bytes = Buffer.concat([bytes, chunk]);
    });
    child.stdin.on("error", () => {});
    child.once("error", () => {
      cleanup();
      reject(Error("proof-command-start-failed"));
    });
    child.once("close", (code) => {
      cleanup();
      if (failed || code !== 0) {
        reject(Error("proof-command-failed"));
        return;
      }
      try {
        resolve(JSON.parse(bytes.toString("utf8")) as unknown);
      } catch {
        reject(Error("proof-command-invalid-output"));
      }
    });
    child.stdin.end(`${JSON.stringify(input)}\n`);
  });
}
