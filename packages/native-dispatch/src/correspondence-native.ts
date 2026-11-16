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
  /** Why an unknown turn was refused, and Claude's process group; the dispatcher journals both. */
  refusal?: CorrespondenceTurnRefusal;
  processGroup?: number | null;
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
 * Hard wall-clock limit that does not depend on the controller. The watchdog is the controller's own
 * Node binary running this source with `-e`; it is not detached, so it stays in the controller's
 * process group and launchd's job teardown signals it. It starts only under the controller PID it
 * was given, then starts Claude in Claude's own new process group and owns that whole group:
 * - at the limit it measures itself (exit 124), as soon as its parent changes (exit 125), or when
 *   it is signalled (exit 143), it sends SIGTERM to the group, then SIGKILL after 200 ms, and waits
 *   up to 2 s for the group to be gone;
 * - when Claude exits by itself, any descendants left in the group are killed the same way;
 * - it exits only once the group is shown to be gone, or with 121 if it could not show that.
 * It reports the group as `group <pgid>` and its end as `done <code>` on fd 3. It reads neither
 * stdin nor stdout: Claude inherits those pipes directly.
 */
export const CORRESPONDENCE_WATCHDOG_SOURCE = `"use strict";
const { spawn } = require("node:child_process");
const { writeSync } = require("node:fs");
const [controllerText, limitText, file, ...args] = process.argv.slice(1);
const controller = Number(controllerText), limit = Number(limitText);
if (!Number.isSafeInteger(controller) || controller <= 1 || !Number.isSafeInteger(limit) || limit < 0 || !file) process.exit(126);
// Never start Claude under any parent but the controller that launched this watchdog.
if (process.ppid !== controller) process.exit(122);
const report = (line) => { try { writeSync(3, line + "\\n"); } catch {} };
const child = spawn(file, args, { stdio: ["inherit", "inherit", "ignore"], detached: true });
const group = child.pid;
let reason, ending = false;
const signal = (s) => { try { process.kill(-group, s); return true; } catch (e) { return e.code !== "ESRCH"; } };
const finish = (code) => { report("done " + code); process.exit(code); };
const end = (code) => {
  if (reason === undefined) reason = code;
  if (ending) return;
  ending = true;
  signal("SIGTERM");
  setTimeout(() => {
    const until = Date.now() + 2000;
    const poll = () => {
      if (!signal(0)) return finish(reason);
      if (Date.now() > until) return finish(121);
      signal("SIGKILL");
      setTimeout(poll, 20);
    };
    signal("SIGKILL");
    setTimeout(poll, 20);
  }, 200);
};
if (!group) finish(127);
report("group " + group);
child.on("error", () => end(127));
child.on("exit", (code) => {
  const status = code === null ? 128 : code;
  if (!signal(0)) finish(reason ?? status);
  else end(status);
});
setTimeout(() => end(124), limit);
setInterval(() => { if (process.ppid !== controller) end(125); }, 50);
for (const s of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(s, () => end(143));
`;
/** The watchdog's longest own escalation: 200 ms grace plus up to 2 s of SIGKILL polling. */
const WATCHDOG_ESCALATION_MS = 2400;

/**
 * Node arguments that run `file args` under the watchdog for `controllerPid`, killed with its whole
 * process group `limitMs` after the watchdog starts.
 */
export function correspondenceWatchdogArgs(
  controllerPid: number,
  limitMs: number,
  file: string,
  args: readonly string[],
): string[] {
  if (!Number.isSafeInteger(limitMs) || limitMs < 0 || !Number.isSafeInteger(controllerPid))
    throw Error("held");
  return [
    "-e",
    CORRESPONDENCE_WATCHDOG_SOURCE,
    "--",
    String(controllerPid),
    String(limitMs),
    file,
    ...args,
  ];
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
      // The watchdog is not detached; it puts Claude in Claude's own process group.
      const child = spawn(
        process.execPath,
        correspondenceWatchdogArgs(process.pid, limitMs, pinned.binaryRealPath, args),
        { cwd: fixed.cwd, env: environment, stdio: ["pipe", "pipe", "ignore", "pipe"] },
      );
      const stdin = child.stdin!,
        stdout = child.stdout!;
      const checker = createCorrespondenceFrameChecker({
        sessionId: session,
        model: pinned.model,
        nativeVersion: pinned.nativeVersion,
      });
      let refusal: CorrespondenceTurnRefusal | undefined,
        total = 0,
        buffer = "",
        started = false,
        group: number | undefined,
        done: number | undefined,
        control = "";
      const refuse = (reason: CorrespondenceTurnRefusal) => {
        refusal ??= reason;
      };
      const control$ = child.stdio[3] as NodeJS.ReadableStream | null;
      control$?.setEncoding("utf8");
      control$?.on("data", (chunk: string) => {
        control += chunk;
        let end: number;
        while ((end = control.indexOf("\n")) >= 0) {
          const line = control.slice(0, end);
          control = control.slice(end + 1);
          const m = /^(group|done) (\d{1,10})$/.exec(line);
          if (m?.[1] === "group" && group === undefined) group = Number(m[2]);
          if (m?.[1] === "done") done = Number(m[2]);
        }
      });
      const watchdogAlive = () => child.exitCode === null && child.signalCode === null;
      // The group is shown gone only by the watchdog's own confirmed end (any code but 121), or
      // by a probe here after the watchdog is gone. A confirmed group is never signalled again.
      const confirmed = () => done !== undefined && done !== 121;
      const groupAlive = () => {
        if (group === undefined || confirmed()) return false;
        try {
          process.kill(-group, 0);
          return true;
        } catch (error) {
          return !(object(error) && error.code === "ESRCH");
        }
      };
      const alive = () => watchdogAlive() || groupAlive();
      const waitFor = async (gone: () => boolean, ms: number) => {
        for (let t = 0; t < ms && !gone(); t += 20) await delay(20);
      };
      let cleanup: Promise<void> | undefined;
      const stop = () => {
        cleanup ??= (async () => {
          // The watchdog kills Claude's whole group on SIGTERM. Let its escalation finish first.
          if (watchdogAlive()) child.kill("SIGTERM");
          await waitFor(() => !watchdogAlive(), WATCHDOG_ESCALATION_MS + 600);
          if (watchdogAlive()) child.kill("SIGKILL");
          await waitFor(() => !watchdogAlive(), 500);
          if (groupAlive())
            try {
              process.kill(-group!, "SIGKILL");
            } catch {
              // Probed again below.
            }
          await waitFor(() => !groupAlive(), 1000);
          // Overrides any earlier reason: the owner must know the group may still be running.
          if (alive()) refusal = "stop-unconfirmed";
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
      stdin.on("error", () => {});
      stdout.setEncoding("utf8");
      stdout.on("data", (chunk: string) => {
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
          child.once("close", (code) => {
            exitCode = code;
            resolve();
          });
          stdin.end(correspondenceInput(request.task.input, request.task.inputDigest));
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
      if (refusal) return { ...base, outcome: "unknown", refusal, processGroup: group ?? null };
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
