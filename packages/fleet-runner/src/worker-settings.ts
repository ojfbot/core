import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { ID } from "./auth.js";

export interface DeclaredCommand {
  capabilities: string[];
  command: [string, ...string[]];
  timeoutMs: number;
}

export interface WorkerSettings {
  endpoint: string;
  worker: string;
  tokenFile: string;
  outDir: string;
  statusFile: string;
  kinds: Record<string, DeclaredCommand>;
  pollMs: number;
  caFile?: string;
  generation?: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function path(value: unknown): string {
  if (typeof value !== "string" || !isAbsolute(value) || value.includes("\0"))
    throw Error("invalid-worker-path");
  return resolve(value);
}

function interval(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2_147_483_647
  )
    throw Error("invalid-worker-interval");
  return value;
}

/** Only local settings select executables. A job never contributes command text or arguments. */
export function parseWorkerSettings(value: unknown): WorkerSettings {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    typeof value.endpoint !== "string" ||
    typeof value.worker !== "string" ||
    !ID.test(value.worker) ||
    value.worker === "owner" ||
    !record(value.kinds) ||
    Object.keys(value.kinds).length === 0
  )
    throw Error("invalid-worker-settings");
  const endpoint = new URL(value.endpoint);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    (endpoint.protocol === "http:" &&
      !["127.0.0.1", "[::1]", "localhost"].includes(endpoint.hostname)) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  )
    throw Error("invalid-worker-endpoint");
  const kinds: Record<string, DeclaredCommand> = Object.create(null);
  for (const [kind, entry] of Object.entries(value.kinds)) {
    if (
      !ID.test(kind) ||
      !record(entry) ||
      !Array.isArray(entry.capabilities) ||
      !entry.capabilities.every((cap): cap is string => typeof cap === "string" && ID.test(cap)) ||
      !Array.isArray(entry.command)
    )
      throw Error("invalid-declared-command");
    const [program, ...args] = entry.command;
    if (
      typeof program !== "string" ||
      !args.every((arg): arg is string => typeof arg === "string" && !arg.includes("\0"))
    )
      throw Error("invalid-declared-command");
    const executable = path(program);
    if (
      ["claude", "claude-code", "codex", "sh", "bash", "zsh", "fish", "env"].includes(
        basename(executable).toLowerCase(),
      )
    )
      throw Error("agent-or-shell-command-refused");
    accessSync(executable, constants.X_OK);
    if (!statSync(executable).isFile()) throw Error("invalid-command-executable");
    kinds[kind] = {
      capabilities: [...new Set(entry.capabilities)],
      command: [executable, ...args],
      timeoutMs: interval(entry.timeoutMs, 300_000),
    };
  }
  const tokenFile = path(value.tokenFile);
  const statusFile = path(value.statusFile);
  if (
    tokenFile === statusFile ||
    (value.generation !== undefined &&
      (typeof value.generation !== "string" || !value.generation || value.generation.length > 128))
  )
    throw Error("invalid-worker-settings");
  return {
    endpoint: value.endpoint,
    worker: value.worker,
    tokenFile,
    outDir: path(value.outDir),
    statusFile,
    kinds,
    pollMs: interval(value.pollMs, 5_000),
    ...(value.caFile === undefined ? {} : { caFile: path(value.caFile) }),
    ...(typeof value.generation === "string" ? { generation: value.generation } : {}),
  };
}

export function loadWorkerSettings(file: string): WorkerSettings {
  if (statSync(file).mode & 0o022) throw Error("unsafe-worker-file");
  const settings = parseWorkerSettings(JSON.parse(readFileSync(file, "utf8")));
  if (statSync(settings.tokenFile).mode & 0o022) throw Error("unsafe-worker-file");
  if (settings.statusFile === resolve(file)) throw Error("invalid-worker-settings");
  if (settings.caFile) accessSync(settings.caFile, constants.R_OK);
  return settings;
}
