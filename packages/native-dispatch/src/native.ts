import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { EMULATOR_PROGRAM } from "./emulator.js";
import { object } from "./admission.js";
import type { DispatchRequest, DutyBinding, NativeOutcome, NativeProfile } from "./types.js";

export type QualificationScenario =
  | "complete"
  | "disconnect"
  | "queued"
  | "hang"
  | "approval"
  | "auth"
  | "failed"
  | "wrong-session";
export interface NativeObservation {
  nativeSessionId: string;
  nativeTurnId: string | null;
  outcome: NativeOutcome | "unknown";
}
export interface QualificationTransport {
  readonly mode: "qualification";
  resume(args: {
    binding: DutyBinding;
    profile: NativeProfile;
    request: DispatchRequest;
    dispatchId: string;
    signal: AbortSignal;
    timeoutMs: number;
    onStarted: (turnId: string | null) => void;
  }): Promise<NativeObservation>;
  snapshot(): {
    processes: number;
    active: number;
    inferenceShapedRequests: number;
    realProviderCalls: 0;
  };
  processIds(): number[];
}
const qualificationTransports = new WeakSet<object>();
export function isQualificationTransport(value: unknown): value is QualificationTransport {
  return object(value) && qualificationTransports.has(value);
}

/** Data-only argument construction. This release never executes a provider binary. */
export function claudeResumeArgs(binding: DutyBinding, profile: NativeProfile): string[] {
  return [
    "--print",
    "--resume",
    binding.nativeSessionId,
    "--model",
    profile.model,
    "--output-format",
    "stream-json",
    "--verbose",
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--permission-mode",
    "dontAsk",
  ];
}

export function createQualificationTransport(
  options: { scenario?: QualificationScenario; delayMs?: number } = {},
): QualificationTransport {
  const scenario = options.scenario ?? "complete",
    delayMs = options.delayMs ?? 0;
  if (
    ![
      "complete",
      "disconnect",
      "queued",
      "hang",
      "approval",
      "auth",
      "failed",
      "wrong-session",
    ].includes(scenario) ||
    !Number.isSafeInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 5_000
  )
    throw Error("invalid-qualification-options");
  let processes = 0,
    active = 0,
    inferenceShapedRequests = 0;
  const pids = new Set<number>();
  const transport = Object.freeze<QualificationTransport>({
    mode: "qualification",
    snapshot: () => ({ processes, active, inferenceShapedRequests, realProviderCalls: 0 as const }),
    processIds: () => [...pids],
    resume: async ({ binding, profile, request, dispatchId, signal, timeoutMs, onStarted }) => {
      if (signal.aborted)
        return {
          nativeSessionId: binding.nativeSessionId,
          nativeTurnId: null,
          outcome: "interrupted",
        };
      const child = spawn(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          EMULATOR_PROGRAM,
          "--",
          binding.provider,
          scenario,
          binding.nativeSessionId,
          profile.nativeVersion,
          profile.model,
          String(delayMs),
          ...(binding.provider === "claude-code" ? claudeResumeArgs(binding, profile) : []),
        ],
        { cwd: binding.cwd, env: {}, detached: true, stdio: ["pipe", "pipe", "ignore"] },
      );
      processes += 1;
      active += 1;
      if (child.pid) pids.add(child.pid);
      let nativeTurnId: string | null = null,
        outcome: NativeObservation["outcome"] = "unknown";
      let invalid = false;
      let buffer = "",
        total = 0,
        approval = false;
      let cleanup: Promise<void> | undefined;
      const alive = () => {
        if (!child.pid) return false;
        try {
          process.kill(-child.pid, 0);
          return true;
        } catch (error) {
          return !(object(error) && error.code === "ESRCH");
        }
      };
      const kill = (s: NodeJS.Signals) => {
        if (!child.pid) return;
        try {
          process.kill(-child.pid, s);
        } catch (error) {
          if (!(object(error) && error.code === "ESRCH")) throw error;
        }
      };
      const stop = () => {
        cleanup ??= (async () => {
          kill("SIGTERM");
          const end = performance.now() + 100;
          while (alive() && performance.now() < end) await delay(5);
          if (alive()) kill("SIGKILL");
          const reaped = performance.now() + 500;
          while (alive() && performance.now() < reaped) await delay(5);
          if (alive()) outcome = "unknown";
        })();
      };
      const send = (value: unknown) => child.stdin.write(`${JSON.stringify(value)}\n`);
      const timer = setTimeout(stop, timeoutMs);
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
      child.stdin.on("error", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        total += Buffer.byteLength(chunk);
        buffer += chunk;
        if (total > 65_536) {
          stop();
          return;
        }
        let end: number;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (invalid) continue;
          try {
            const m: unknown = JSON.parse(line);
            if (!object(m)) throw Error("invalid-native-frame");
            if (binding.provider === "codex") {
              if (
                m.id === 1 &&
                object(m.result) &&
                m.result.userAgent === `codex/${profile.nativeVersion}`
              ) {
                send({ method: "initialized" });
                send({
                  id: 2,
                  method: "thread/resume",
                  params: {
                    threadId: binding.nativeSessionId,
                    cwd: binding.cwd,
                    model: profile.model,
                    approvalPolicy: "never",
                    sandbox: "read-only",
                  },
                });
              } else if (m.id === 2) {
                if (object(m.error) && m.error.code === 401) {
                  outcome = "authentication-blocked";
                  continue;
                }
                if (
                  !object(m.result) ||
                  !object(m.result.thread) ||
                  m.result.thread.id !== binding.nativeSessionId
                )
                  throw Error("wrong-native-session");
                inferenceShapedRequests += 1;
                send({
                  id: 3,
                  method: "turn/start",
                  params: {
                    threadId: binding.nativeSessionId,
                    input: [
                      {
                        type: "text",
                        text: JSON.stringify({
                          kind: "peer-data-pointer",
                          dispatchId,
                          pointer: JSON.parse(request.task.input),
                        }),
                      },
                    ],
                    approvalPolicy: "never",
                    sandboxPolicy: { type: "readOnly" },
                  },
                });
              } else if (m.id === 3) {
                if (
                  !object(m.result) ||
                  !object(m.result.turn) ||
                  typeof m.result.turn.id !== "string"
                )
                  throw Error("invalid-native-turn");
                nativeTurnId = m.result.turn.id;
                onStarted(nativeTurnId);
              } else if (typeof m.method === "string" && m.method.endsWith("/requestApproval")) {
                approval = true;
                send({ id: m.id, result: { decision: "decline" } });
              } else if (m.method === "turn/completed") {
                if (
                  !object(m.params) ||
                  m.params.threadId !== binding.nativeSessionId ||
                  !object(m.params.turn) ||
                  !nativeTurnId ||
                  m.params.turn.id !== nativeTurnId
                )
                  throw Error("wrong-native-turn");
                const state = m.params.turn.status;
                if (!["completed", "failed", "interrupted"].includes(String(state)))
                  throw Error("invalid-native-outcome");
                outcome = approval
                  ? "approval-blocked"
                  : state === "completed"
                    ? "completed"
                    : state === "failed"
                      ? "failed"
                      : "interrupted";
              }
            } else {
              if (m.session_id !== binding.nativeSessionId) throw Error("wrong-native-session");
              if (m.type === "system" && m.subtype === "init") {
                if (
                  m.model !== profile.model ||
                  !Array.isArray(m.tools) ||
                  m.tools.length !== 0 ||
                  !Array.isArray(m.mcp_servers) ||
                  m.mcp_servers.length !== 0
                )
                  throw Error("profile-mismatch");
                onStarted(null);
              } else if (m.type === "result") {
                outcome =
                  m.error === "authentication_required"
                    ? "authentication-blocked"
                    : m.error === "permission_denied"
                      ? "approval-blocked"
                      : m.is_error === false
                        ? "completed"
                        : "failed";
              }
            }
          } catch {
            invalid = true;
            outcome = "unknown";
            stop();
          }
        }
      });
      try {
        await new Promise<void>((resolve) => {
          child.once("error", () => {
            outcome = "unknown";
            resolve();
          });
          child.once("close", () => resolve());
          if (binding.provider === "codex")
            send({
              id: 1,
              method: "initialize",
              params: {
                clientInfo: { name: "helpdesk-qualification", version: "0.1.0" },
              },
            });
          else {
            inferenceShapedRequests += 1;
            child.stdin.end(`${request.task.input}\n`);
          }
        });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", stop);
        await cleanup;
        active -= 1;
        if (child.pid) pids.delete(child.pid);
      }
      return { nativeSessionId: binding.nativeSessionId, nativeTurnId, outcome };
    },
  });
  qualificationTransports.add(transport);
  return transport;
}
