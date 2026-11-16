import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
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
 * A turn that is refused before any process starts. The dispatcher refunds its reservation and
 * journals nothing unknown, as it does for a hold before launch.
 */
export class CorrespondencePrelaunchError extends Error {
  constructor(readonly reason: "held" | "expired") {
    super(reason);
  }
}
export function isCorrespondencePrelaunch(error: unknown): error is CorrespondencePrelaunchError {
  return error instanceof CorrespondencePrelaunchError;
}

/**
 * Hard wall-clock limit that does not depend on the controller or its process group. The
 * watchdog is the controller's own Node binary running this source with `-e`, in its OWN process
 * group, so a signal to the controller's group (a `kill -9 -<pgid>`, or launchd's job teardown)
 * does not reach it. It installs its signal handlers first, and starts Claude on the next turn of
 * its event loop only if no signal arrived and its parent is still the controller PID it was given
 * (otherwise exit 122). Claude runs in Claude's own new process group, which the watchdog owns:
 * - at the limit it measures itself from its own start (exit 124), as soon as its parent changes
 *   (exit 125), or when it is signalled (exit 143), it sends SIGTERM to the group, then SIGKILL
 *   after 200 ms, and polls for up to 2 s until the group is gone;
 * - when Claude exits by itself, any descendants left in the group are killed the same way;
 * - it exits only once the group is shown to be gone, or with 121 if it could not show that.
 * It reports the group once, as `group <pgid>`, on fd 3. Claude is spawned with only stdin, stdout
 * and stderr, so it does not inherit fd 3 and cannot write to that channel.
 */
export const CORRESPONDENCE_WATCHDOG_SOURCE = `"use strict";
const { spawn } = require("node:child_process");
const { writeSync } = require("node:fs");
const [controllerText, limitText, file, ...args] = process.argv.slice(1);
const controller = Number(controllerText), limit = Number(limitText);
if (!Number.isSafeInteger(controller) || controller <= 1 || !Number.isSafeInteger(limit) || limit < 0 || !file) process.exit(126);
if (process.ppid !== controller) process.exit(122);
let child, group, reason, ending = false;
const signal = (s) => { if (!group) return false; try { process.kill(-group, s); return true; } catch (e) { return e.code !== "ESRCH"; } };
const end = (code) => {
  if (reason === undefined) reason = code;
  if (ending) return;
  ending = true;
  if (!group) process.exit(reason);
  signal("SIGTERM");
  setTimeout(() => {
    const until = Date.now() + 2000;
    const poll = () => {
      if (!signal(0)) return process.exit(reason);
      if (Date.now() > until) return process.exit(121);
      signal("SIGKILL");
      setTimeout(poll, 20);
    };
    signal("SIGKILL");
    setTimeout(poll, 20);
  }, 200);
};
// Handlers and limits first; Claude starts only after any signal already sent has been handled.
for (const s of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(s, () => end(143));
setTimeout(() => end(124), limit);
setInterval(() => { if (process.ppid !== controller) end(125); }, 50);
setImmediate(() => {
  if (reason !== undefined) return;
  if (process.ppid !== controller) return end(122);
  child = spawn(file, args, { stdio: ["inherit", "inherit", "ignore"], detached: true });
  group = child.pid;
  if (!group) return end(127);
  try { writeSync(3, "group " + group + "\\n"); } catch {}
  child.on("error", () => end(127));
  child.on("exit", (code) => {
    const status = code === null ? 128 : code;
    if (!signal(0)) process.exit(reason ?? status);
    else end(status);
  });
});
`;
/**
 * Set in the watchdog's and Claude's environment to the turn's fresh session UUID. Descendants
 * inherit it, so one that leaves Claude's process group can still be found and killed.
 */
export const CORRESPONDENCE_TURN_MARKER = "CORE_CORRESPONDENCE_TURN";

/**
 * PIDs of processes whose environment carries this turn's marker: `/proc/<pid>/environ` on Linux,
 * `ps -ax -E -ww` on macOS (which shows the environment of this user's processes, except Apple
 * platform binaries such as `/bin/sleep`). Bounded in time.
 * `undefined` when the table could not be read, which counts as unconfirmed.
 */
export function findTurnProcesses(session: string): number[] | undefined {
  const marker = `${CORRESPONDENCE_TURN_MARKER}=${session}`;
  const found: number[] = [];
  if (existsSync("/proc/self/environ")) {
    const deadline = Date.now() + 2000;
    for (const name of readdirSync("/proc")) {
      if (Date.now() > deadline) return undefined;
      if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
      try {
        if (readFileSync(`/proc/${name}/environ`, "utf8").split("\0").includes(marker))
          found.push(Number(name));
      } catch {
        // Gone, or another user's process: it cannot carry our marker.
      }
    }
    return found;
  }
  const result = spawnSync("/bin/ps", ["-ax", "-E", "-ww", "-o", "pid=,command="], {
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C" },
    timeout: 2000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error || typeof result.stdout !== "string") return undefined;
  for (const line of result.stdout.split("\n")) {
    const m = /^\s*(\d+)\s(.*)$/.exec(line);
    if (!m || Number(m[1]) === process.pid) continue;
    if (m[2].split(" ").includes(marker)) found.push(Number(m[1]));
  }
  return found;
}

/** The watchdog's longest own escalation: 200 ms grace plus up to 2 s of SIGKILL polling. */
const WATCHDOG_ESCALATION_MS = 2400;
/** How long to wait for the pipes to close once every process is stopped or gone. */
const CLOSE_GRACE_MS = 1000;

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

/**
 * Starts the watchdog exactly as the transport does: the controller's own Node, its own process
 * group (`detached`), stdin and stdout piped to Claude, fd 3 for the group report.
 */
export function spawnCorrespondenceWatchdog(
  limitMs: number,
  file: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): ChildProcess {
  return spawn(process.execPath, correspondenceWatchdogArgs(process.pid, limitMs, file, args), {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["pipe", "pipe", "ignore", "pipe"],
  });
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
      // Everything before spawn refuses without a process: the reservation is refunded.
      let session: string, packet: CorrespondencePacket, args: string[], limitMs: number;
      const fixed = prepared.plan.bindings.find((b) => b.alias === binding.alias),
        pinned = prepared.plan.profiles.find((p) => p.revision === profile.revision);
      try {
        if (!fixed || !pinned || signal.aborted || pinned.provider !== "claude-code")
          throw Error("held");
        session = binding.nativeSessionId;
        packet = packetOf(request);
        args = correspondenceCommand(fixed, pinned, session);
        checkBinary(pinned);
        beforeLaunch();
        const remainingMs = expiresAtMs - Date.now();
        if (remainingMs <= 0) throw new CorrespondencePrelaunchError("expired");
        limitMs = Math.min(timeoutMs, remainingMs);
      } catch (error) {
        if (isCorrespondencePrelaunch(error)) throw error;
        throw new CorrespondencePrelaunchError("held");
      }
      // The marker travels to Claude and every descendant, whatever group or session it joins.
      const child = spawnCorrespondenceWatchdog(limitMs, pinned.binaryRealPath, args, {
        cwd: fixed.cwd,
        env: { ...environment, [CORRESPONDENCE_TURN_MARKER]: session },
      });
      const stdin = child.stdin!,
        stdout = child.stdout!,
        control = child.stdio[3] as NodeJS.ReadableStream & { destroy(): void };
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
        controlText = "",
        closed = false,
        finishWait: (() => void) | undefined;
      const refuse = (reason: CorrespondenceTurnRefusal) => {
        refusal ??= reason;
      };
      control.setEncoding("utf8");
      control.on("data", (chunk: string) => {
        // Only the watchdog holds fd 3. One line, `group <pgid>`, accepted once.
        controlText = (controlText + chunk).slice(0, 64);
        const m = /^group (\d{1,10})\n/.exec(controlText);
        if (m && group === undefined && Number(m[1]) > 1) group = Number(m[1]);
      });
      const watchdogAlive = () => child.exitCode === null && child.signalCode === null;
      // Claude's group is always probed here; nothing reported on fd 3 can skip this.
      const groupAlive = () => {
        if (group === undefined) return false;
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
      /** Stops waiting for `close`: a holder of stdout that cannot be shown gone is unconfirmed. */
      const abandonPipes = () => {
        if (closed) return;
        refusal = "stop-unconfirmed";
        for (const pipe of [stdin, stdout, control]) pipe.destroy();
        finishWait?.();
      };
      let cleanup: Promise<void> | undefined;
      const stop = () => {
        cleanup ??= (async () => {
          // The watchdog kills Claude's whole group on SIGTERM. Let its escalation finish first.
          if (watchdogAlive()) child.kill("SIGTERM");
          await waitFor(() => !watchdogAlive(), WATCHDOG_ESCALATION_MS + 600);
          if (watchdogAlive()) child.kill("SIGKILL");
          await waitFor(() => !watchdogAlive(), 500);
          // Signal the group only while the probe shows it is still there.
          if (groupAlive())
            try {
              process.kill(-group!, "SIGKILL");
            } catch {
              // Probed again below.
            }
          await waitFor(() => !groupAlive(), 1000);
          // Overrides any earlier reason: the owner must know the group may still be running.
          if (group === undefined && started) refusal = "stop-unconfirmed";
          if (alive()) refusal = "stop-unconfirmed";
          // Everything is stopped or unconfirmed: wait only briefly more for the pipes.
          await waitFor(() => closed, CLOSE_GRACE_MS);
          abandonPipes();
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
          finishWait = resolve;
          child.once("error", () => {
            refuse("process-error");
            resolve();
          });
          // After the watchdog exits, a holder of stdout that escaped Claude's group must not
          // keep this turn open: stop, then abandon the pipes.
          child.once("exit", () => {
            setTimeout(() => {
              if (!closed) stop();
            }, CLOSE_GRACE_MS).unref();
          });
          child.once("close", (code) => {
            closed = true;
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
      if (exitCode === null && child.exitCode !== null) exitCode = child.exitCode;
      // Before any proposal: nothing carrying this turn's marker may still run.
      const escaped = findTurnProcesses(session);
      if (escaped === undefined) refusal = "stop-unconfirmed";
      else if (escaped.length) {
        for (const pid of escaped)
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // Gone already; the rescan decides.
          }
        await delay(100);
        const left = findTurnProcesses(session);
        if (left === undefined || left.length) refusal = "stop-unconfirmed";
        else refuse("descendant-escaped");
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
      if (signal.aborted) throw new CorrespondencePrelaunchError("held");
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

/** Scripted raw stream-json frames for one turn, as a fake Claude would print them. */
export type CorrespondenceFrameScript = (
  packet: CorrespondencePacket,
  turn: { packetDigest: string; nativeSessionId: string; invocation: number },
) => unknown[] | Promise<unknown[]>;

/**
 * Deterministic in-process turn source at the frame level: the script's frames go through the real
 * frame checker and proposal parser, exactly as a live turn's would. No process, network,
 * credential or file access. Its journals are marked `emulated`.
 */
export function createCorrespondenceFrameEmulator(
  script: CorrespondenceFrameScript,
  recordFrame?: (frame: unknown) => void,
): CorrespondenceEmulator {
  let invocations = 0;
  const transport: CorrespondenceTransport = {
    mode: "emulated",
    resume: async ({ binding, profile, request, signal, onStarted }) => {
      if (signal.aborted) throw new CorrespondencePrelaunchError("held");
      const packet = packetOf(request);
      invocations += 1;
      const session = binding.nativeSessionId;
      const frames = await script(packet, {
        packetDigest: request.task.inputDigest,
        nativeSessionId: session,
        invocation: invocations,
      });
      const checker = createCorrespondenceFrameChecker({
        sessionId: session,
        model: profile.model,
        nativeVersion: profile.nativeVersion,
      });
      let refusal: CorrespondenceTurnRefusal | undefined;
      for (const frame of frames) {
        recordFrame?.(frame);
        try {
          checker.frame(frame);
        } catch (error) {
          refusal = error instanceof CorrespondenceFrameError ? error.reason : "invalid-frame";
          break;
        }
        if (object(frame) && frame.type === "system" && frame.subtype === "init") onStarted(null);
      }
      const verdict = checker.verdict();
      if (!refusal && verdict.kind === "refused") refusal = verdict.reason;
      const base = { nativeSessionId: session, nativeTurnId: null };
      if (refusal) return { ...base, outcome: "unknown", refusal, processGroup: null };
      if (verdict.kind === "failed") return { ...base, outcome: "failed" };
      let proposal: RelayedCorrespondenceProposal | undefined;
      try {
        proposal = parseCorrespondenceAnswer(
          verdict.kind === "accepted" ? verdict.structuredOutput : undefined,
          request,
          packet,
        );
      } catch {
        proposal = undefined;
      }
      return { ...base, outcome: "completed", ...(proposal ? { agentProposal: proposal } : {}) };
    },
  };
  transports.add(transport);
  return { transport: Object.freeze(transport), invocations: () => invocations };
}
