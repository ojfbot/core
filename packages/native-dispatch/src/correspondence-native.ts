import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { object } from "./admission.js";
import {
  CORRESPONDENCE_OUTPUT_SCHEMA,
  correspondenceInput,
  parseCorrespondenceAnswer,
  parseCorrespondencePacket,
} from "./correspondence-protocol.js";
import {
  CorrespondenceFrameError,
  createCorrespondenceFrameChecker,
} from "./correspondence-frames.js";
import type { CorrespondenceTurnRefusal } from "./correspondence-frames.js";
import { checkBinary } from "./supervised-files.js";
import type { NativeObservation } from "./native.js";
import type { SubscriptionCanaryProfile } from "./canary-types.js";
import type {
  CorrespondenceBinding,
  CorrespondencePacket,
  PreparedCorrespondencePlan,
  RelayedCorrespondenceProposal,
} from "./correspondence-types.js";
import type { DispatchRequest, DutyBinding, NativeProfile } from "./types.js";

export type CorrespondenceObservation = Omit<NativeObservation, "agentProposal"> & {
  agentProposal?: RelayedCorrespondenceProposal;
  /** Why an unknown turn was refused; the dispatcher journals it. */
  refusal?: CorrespondenceTurnRefusal;
};
export interface CorrespondenceTransport {
  readonly mode: "supervised" | "emulated";
  resume(args: {
    binding: DutyBinding;
    profile: NativeProfile;
    request: DispatchRequest;
    dispatchId: string;
    signal: AbortSignal;
    timeoutMs: number;
    onStarted: (turnId: string | null) => void;
  }): Promise<CorrespondenceObservation>;
}
const transports = new WeakSet<object>();
export function isCorrespondenceTransport(value: unknown): value is CorrespondenceTransport {
  return object(value) && transports.has(value);
}

/**
 * Claude only. The flags match the supervised command; the session is always new. `--json-schema`
 * makes Claude Code expose its one built-in output tool (CLAUDE_OUTPUT_TOOL), which the frame
 * checker requires and allows exactly once.
 */
export function correspondenceCommand(
  binding: Pick<CorrespondenceBinding, "provider">,
  profile: Pick<SubscriptionCanaryProfile, "provider" | "model">,
  nativeSessionId: string,
): string[] {
  if (binding.provider !== "claude-code" || profile.provider !== "claude-code")
    throw Error("revoked-provider");
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(nativeSessionId)) throw Error("held");
  return [
    "--print",
    "--session-id",
    nativeSessionId,
    "--model",
    profile.model,
    "--effort",
    "low",
    "--output-format",
    "stream-json",
    "--verbose",
    "--safe-mode",
    "--setting-sources",
    "",
    "--tools",
    "",
    "--disallowedTools",
    "mcp__*",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--disable-slash-commands",
    "--settings",
    '{"disableAllHooks":true,"disableClaudeAiConnectors":true}',
    "--permission-mode",
    "dontAsk",
    "--permission-prompts",
    "none",
    "--max-turns",
    "1",
    "--json-schema",
    JSON.stringify(CORRESPONDENCE_OUTPUT_SCHEMA),
  ];
}

function packetOf(request: DispatchRequest): CorrespondencePacket {
  if (request.workflow !== "correspondence") throw Error("held");
  return parseCorrespondencePacket(request.task.input);
}

/**
 * Hard wall-clock limit that does not depend on the controller: the watchdog measures the turn's
 * limit itself, from its own start. Claude runs as the child of this
 * small Node watchdog (the controller's own Node binary, `-e`), never `detached`, so it stays in the
 * controller's process group and launchd's job teardown reaches it. The watchdog SIGKILLs Claude
 * at the deadline (exit 124), as soon as its parent controller is gone (exit 125), or when it is
 * signalled (exit 143). It never reads stdin or stdout: Claude inherits those pipes directly.
 */
export const CORRESPONDENCE_WATCHDOG_SOURCE = `"use strict";
const { spawn } = require("node:child_process");
const [limitText, file, ...args] = process.argv.slice(1);
const limit = Number(limitText), parent = process.ppid;
if (!Number.isSafeInteger(limit) || limit < 0 || !file) process.exit(126);
let reason;
const child = spawn(file, args, { stdio: ["inherit", "inherit", "ignore"] });
const kill = (code) => {
  if (reason === undefined) reason = code;
  try { child.kill("SIGKILL"); } catch {}
  setTimeout(() => process.exit(reason), 1000).unref();
};
child.on("error", () => process.exit(127));
child.on("exit", (code) => process.exit(reason ?? (code === null ? 128 : code)));
setTimeout(() => kill(124), limit).unref();
setInterval(() => { if (process.ppid !== parent) kill(125); }, 100).unref();
for (const s of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(s, () => kill(143));
`;
/** Node arguments that run `file args` under the watchdog, killed `limitMs` after it starts. */
export function correspondenceWatchdogArgs(
  limitMs: number,
  file: string,
  args: readonly string[],
): string[] {
  if (!Number.isSafeInteger(limitMs) || limitMs < 0) throw Error("held");
  return ["-e", CORRESPONDENCE_WATCHDOG_SOURCE, "--", String(limitMs), file, ...args];
}

/** Internal built-in real launcher. Only openCorrespondenceWindow constructs it, after its checks. */
export function createCorrespondenceTransport(
  prepared: PreparedCorrespondencePlan,
  expiresAtMs: number,
  environment: NodeJS.ProcessEnv,
  beforeLaunch: () => void,
  /** Qualification only: receives every parsed frame, for the cut-down trace. */
  recordFrame?: (frame: unknown) => void,
): CorrespondenceTransport {
  const transport: CorrespondenceTransport = {
    mode: "supervised",
    resume: async ({ binding, profile, request, signal, timeoutMs, onStarted }) => {
      const fixed = prepared.plan.bindings.find((b) => b.alias === binding.alias),
        pinned = prepared.plan.profiles.find((p) => p.revision === profile.revision);
      if (!fixed || !pinned || signal.aborted || pinned.provider !== "claude-code")
        throw Error("held");
      const session = binding.nativeSessionId;
      const packet = packetOf(request);
      const args = correspondenceCommand(fixed, pinned, session);
      checkBinary(pinned);
      beforeLaunch();
      const remainingMs = expiresAtMs - Date.now();
      if (remainingMs <= 0) throw Error("expired");
      const limitMs = Math.min(timeoutMs, remainingMs);
      // Never detached: the watchdog and Claude stay in the controller's process group.
      const child = spawn(
        process.execPath,
        correspondenceWatchdogArgs(limitMs, pinned.binaryRealPath, args),
        { cwd: fixed.cwd, env: environment, stdio: ["pipe", "pipe", "ignore"] },
      );
      const checker = createCorrespondenceFrameChecker({ sessionId: session, model: pinned.model });
      let refusal: CorrespondenceTurnRefusal | undefined,
        total = 0,
        buffer = "",
        started = false;
      const refuse = (reason: CorrespondenceTurnRefusal) => {
        refusal ??= reason;
      };
      let cleanup: Promise<void> | undefined;
      const alive = () => child.exitCode === null && child.signalCode === null;
      const stop = () => {
        cleanup ??= (async () => {
          // The watchdog SIGKILLs Claude on SIGTERM, then exits.
          if (alive()) child.kill("SIGTERM");
          for (let i = 0; i < 10 && alive(); i++) await delay(50);
          if (alive()) child.kill("SIGKILL");
          await delay(50);
          if (alive()) refuse("stop-unconfirmed");
        })();
      };
      const timer = setTimeout(() => {
        refuse("deadline");
        stop();
      }, limitMs);
      const abort = () => {
        refuse("aborted");
        stop();
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      child.stdin.on("error", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (refusal) return;
        total += Buffer.byteLength(chunk);
        buffer += chunk;
        if (total > 262144) {
          refuse("output-overflow");
          stop();
          return;
        }
        let end: number;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (refusal || !line) continue;
          let m: unknown;
          try {
            m = JSON.parse(line);
          } catch {
            m = null;
          }
          recordFrame?.(m);
          try {
            checker.frame(m);
          } catch (error) {
            refuse(error instanceof CorrespondenceFrameError ? error.reason : "invalid-frame");
            stop();
            continue;
          }
          if (!started && object(m) && m.type === "system" && m.subtype === "init") {
            started = true;
            onStarted(null);
          }
        }
      });
      let exitCode: number | null = null;
      try {
        await new Promise<void>((resolve) => {
          child.once("error", () => {
            refuse("process-error");
            resolve();
          });
          child.once("exit", () => {
            // An orphaned grandchild holding stdout must not hold the controller.
            setTimeout(() => {
              child.stdout.destroy();
              resolve();
            }, 1000).unref();
          });
          child.once("close", (code) => {
            exitCode = code;
            resolve();
          });
          child.stdin.end(correspondenceInput(request.task.input, request.task.inputDigest));
        });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        stop();
        await cleanup;
      }
      const verdict = checker.verdict();
      if (!refusal && verdict.kind === "refused") refuse(verdict.reason);
      if (!refusal && buffer.trim()) refuse("trailing-output");
      // 124 is the watchdog's own deadline kill, which can land just before the controller's timer.
      if (!refusal && exitCode !== 0) refuse(exitCode === 124 ? "deadline" : "exit-nonzero");
      const base = { nativeSessionId: session, nativeTurnId: null };
      if (refusal) return { ...base, outcome: "unknown", refusal };
      if (verdict.kind === "failed") return { ...base, outcome: "failed" };
      let proposal: RelayedCorrespondenceProposal | undefined;
      if (verdict.kind === "accepted")
        try {
          proposal = {
            ...parseCorrespondenceAnswer(verdict.structuredOutput, request, packet),
            source: "supervised-native",
          };
        } catch {
          proposal = undefined;
        }
      return { ...base, outcome: "completed", ...(proposal ? { agentProposal: proposal } : {}) };
    },
  };
  transports.add(transport);
  return Object.freeze(transport);
}

/** What a scripted fake model does with one packet. */
export type CorrespondenceEmulatorStep =
  | { kind: "answer"; answer: unknown }
  | { kind: "failed" }
  /** The native process is lost after launch: the dispatcher records an unknown outcome. */
  | { kind: "lost" }
  /** Never answers: the turn ends at the request timeout or on abort, as unknown. */
  | { kind: "hang" };
export type CorrespondenceEmulatorScript = (
  packet: CorrespondencePacket,
  turn: { packetDigest: string; nativeSessionId: string; invocation: number },
) => CorrespondenceEmulatorStep | Promise<CorrespondenceEmulatorStep>;

export interface CorrespondenceEmulator {
  readonly transport: CorrespondenceTransport;
  /** Count of fake-model invocations, for no-second-reply assertions. */
  invocations(): number;
}

/** Deterministic in-process turn source. No process, network, credential or file access. */
export function createCorrespondenceEmulator(
  script: CorrespondenceEmulatorScript,
): CorrespondenceEmulator {
  let invocations = 0;
  const transport: CorrespondenceTransport = {
    mode: "emulated",
    resume: async ({ binding, request, signal, timeoutMs, onStarted }) => {
      if (signal.aborted) throw Error("held");
      const packet = packetOf(request);
      invocations += 1;
      onStarted(null);
      const step = await script(packet, {
        packetDigest: request.task.inputDigest,
        nativeSessionId: binding.nativeSessionId,
        invocation: invocations,
      });
      const base = { nativeSessionId: binding.nativeSessionId, nativeTurnId: null };
      if (step.kind === "lost") throw Error("native-lost");
      if (step.kind === "hang") {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, timeoutMs);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
        return { ...base, outcome: "unknown" };
      }
      if (step.kind === "failed") return { ...base, outcome: "failed" };
      let proposal: RelayedCorrespondenceProposal | undefined;
      try {
        proposal = parseCorrespondenceAnswer(step.answer, request, packet);
      } catch {
        proposal = undefined;
      }
      return { ...base, outcome: "completed", ...(proposal ? { agentProposal: proposal } : {}) };
    },
  };
  transports.add(transport);
  return { transport: Object.freeze(transport), invocations: () => invocations };
}
