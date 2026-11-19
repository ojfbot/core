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
const STDERR_LIMIT = 8192;

/** Retain the diagnostic tail while continuing to drain the subprocess stream. */
export class ProofStderr {
  #tail = Buffer.alloc(0);
  #bytes = 0;
  append(chunk: Buffer): void {
    this.#bytes += chunk.length;
    if (chunk.length >= STDERR_LIMIT) {
      this.#tail = Buffer.from(chunk.subarray(chunk.length - STDERR_LIMIT));
    } else {
      const skip = Math.max(0, this.#tail.length + chunk.length - STDERR_LIMIT);
      this.#tail = Buffer.concat([this.#tail.subarray(skip), chunk]);
    }
  }
  receipt() {
    return {
      stderr: this.#tail.toString("utf8"),
      stderrBytes: this.#bytes,
      stderrTruncated: this.#bytes > STDERR_LIMIT,
    };
  }
}

type CommandFailure = {
  reason: "start" | "timeout" | "abort" | "output-limit" | "exit" | "invalid-output";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  spawnError?: string;
} & ReturnType<ProofStderr["receipt"]>;

export class ProofCommandError extends Error {
  #details: CommandFailure;
  constructor(code: string, details: CommandFailure) {
    super(code);
    this.#details = details;
  }
  privateReceipt(): CommandFailure {
    return this.#details;
  }
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
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...environment,
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
      },
    });
    let bytes = Buffer.alloc(0);
    const stderr = new ProofStderr();
    let stoppedFor: "timeout" | "abort" | "output-limit" | undefined;
    let spawnError: string | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals): void => {
      try {
        if (child.pid) process.kill(-child.pid, signal);
      } catch {
        /* already reaped */
      }
    };
    const stop = (reason: NonNullable<typeof stoppedFor>): void => {
      if (!stoppedFor) {
        stoppedFor = reason;
        kill("SIGTERM");
        killTimer = setTimeout(() => kill("SIGKILL"), 500);
      }
    };
    const aborted = () => stop("abort");
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
    const cleanup = (): void => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      signal?.removeEventListener("abort", aborted);
      kill("SIGKILL");
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (bytes.length + chunk.length > 64 * 1024) stop("output-limit");
      else bytes = Buffer.concat([bytes, chunk]);
    });
    child.stderr.on("data", (chunk: Buffer) => stderr.append(chunk));
    child.stdin.on("error", () => {});
    child.once("error", (error) => {
      spawnError = error.message.slice(0, 1024);
    });
    child.once("close", (code, exitSignal) => {
      cleanup();
      const details = { exitCode: code, signal: exitSignal, ...stderr.receipt() };
      if (spawnError !== undefined) {
        reject(
          new ProofCommandError("proof-command-start-failed", {
            ...details,
            reason: "start",
            spawnError,
          }),
        );
        return;
      }
      if (stoppedFor || code !== 0) {
        reject(
          new ProofCommandError("proof-command-failed", {
            ...details,
            reason: stoppedFor ?? "exit",
          }),
        );
        return;
      }
      try {
        resolve(JSON.parse(bytes.toString("utf8")) as unknown);
      } catch {
        reject(
          new ProofCommandError("proof-command-invalid-output", {
            ...details,
            reason: "invalid-output",
          }),
        );
      }
    });
    child.stdin.end(`${JSON.stringify(input)}\n`);
  });
}
