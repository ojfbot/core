import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { ID } from "./auth.js";
import {
  parseClaimPolicy,
  parseRequirements,
  type ClaimPolicy,
  type KindRequirements,
} from "./claim-policy.js";

/** A local file whose exact bytes the installed handler depends on. */
export interface PinnedFile {
  path: string;
  sha256: string;
}

export interface DeclaredCommand {
  capabilities: string[];
  /** Re-hashed before every run; a mismatch withdraws the kind from this worker. */
  pins?: PinnedFile[];
  /** What the host must really have before this kind is offered. */
  requires?: KindRequirements;
  /** Shared resource this kind uses, such as `gpu`. A busy GPU holds back only kinds that use it. */
  resource?: string;
  command: [string, ...string[]];
  timeoutMs: number;
}

export interface WorkerSettings {
  endpoint: string;
  worker: string;
  tokenFile: string;
  outDir: string;
  /** Where hash-checked inputs are staged. Without it the worker does not fetch inputs. */
  inputDir?: string;
  statusFile: string;
  /** When absent the worker claims whenever the service allows, as before. */
  policy?: ClaimPolicy;
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

function parsePins(value: unknown): PinnedFile[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16) throw Error("invalid-handler-pin");
  return value.map((pin: unknown) => {
    if (!record(pin) || typeof pin.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(pin.sha256))
      throw Error("invalid-handler-pin");
    return { path: path(pin.path), sha256: pin.sha256 };
  });
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
    const pins = parsePins(entry.pins);
    // Pinning only part of what runs gives false comfort: the executable and every absolute path
    // argument (the script it runs) must be among the pins whenever any pin is declared, whether or
    // not that path exists yet, so a file that appears later cannot run unpinned.
    if (pins.length > 0) {
      const pinned = new Set(pins.map((pin) => pin.path));
      const executed = [executable, ...args.filter((arg) => isAbsolute(arg))].map((arg) =>
        resolve(arg),
      );
      if (!executed.every((file) => pinned.has(file))) throw Error("pins-must-cover-command");
    }
    if (
      entry.resource !== undefined &&
      (typeof entry.resource !== "string" || !ID.test(entry.resource))
    )
      throw Error("invalid-declared-command");
    kinds[kind] = {
      capabilities: [...new Set(entry.capabilities)],
      pins,
      requires: parseRequirements(entry.requires),
      ...(typeof entry.resource === "string" ? { resource: entry.resource } : {}),
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
    ...(value.inputDir === undefined ? {} : { inputDir: path(value.inputDir) }),
    statusFile,
    ...(value.policy === undefined ? {} : { policy: parseClaimPolicy(value.policy) }),
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
