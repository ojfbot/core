import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { object } from "./admission.js";
import {
  CORRESPONDENCE_OUTPUT_SCHEMA,
  correspondenceInput,
  parseCorrespondenceAnswer,
  parseCorrespondencePacket,
} from "./correspondence-protocol.js";
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

/** Claude only. The no-tools flags match the qualified supervised command; the session is always new. */
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

/** Internal built-in real launcher. Only openCorrespondenceWindow constructs it, after its checks. */
export function createCorrespondenceTransport(
  prepared: PreparedCorrespondencePlan,
  expiresAtMs: number,
  environment: NodeJS.ProcessEnv,
  beforeLaunch: () => void,
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
      const child = spawn(pinned.binaryRealPath, args, {
        cwd: fixed.cwd,
        env: environment,
        detached: true,
        stdio: ["pipe", "pipe", "ignore"],
      });
      const state: Pick<NativeObservation, "outcome"> = { outcome: "unknown" };
      let proposal: RelayedCorrespondenceProposal | undefined,
        total = 0,
        buffer = "",
        initialized = false,
        invalid = false,
        terminal = false;
      let cleanup: Promise<void> | undefined;
      const kill = (s: NodeJS.Signals) => {
        if (child.pid)
          try {
            process.kill(-child.pid, s);
          } catch (error) {
            if (!(object(error) && error.code === "ESRCH")) invalid = true;
          }
      };
      const alive = () => {
        if (!child.pid) return false;
        try {
          process.kill(-child.pid, 0);
          return true;
        } catch (error) {
          return !(object(error) && error.code === "ESRCH");
        }
      };
      const stop = () => {
        cleanup ??= (async () => {
          kill("SIGTERM");
          await delay(100);
          if (alive()) kill("SIGKILL");
          await delay(50);
          if (alive()) {
            invalid = true;
            state.outcome = "unknown";
          }
        })();
      };
      const timer = setTimeout(
        () => {
          invalid = true;
          stop();
        },
        Math.min(timeoutMs, remainingMs),
      );
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
      child.stdin.on("error", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (invalid) return;
        total += Buffer.byteLength(chunk);
        buffer += chunk;
        if (total > 262144) {
          invalid = true;
          stop();
          return;
        }
        let end: number;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (invalid || !line) continue;
          try {
            const m: unknown = JSON.parse(line);
            if (!object(m) || terminal) throw Error("invalid-native-frame");
            if (m.session_id !== session) throw Error("wrong-native-session");
            if (m.type === "system" && m.subtype === "init") {
              // The first frame must show the pinned model, no tools and no tool servers.
              if (
                initialized ||
                m.model !== pinned.model ||
                !Array.isArray(m.tools) ||
                m.tools.length ||
                !Array.isArray(m.mcp_servers) ||
                m.mcp_servers.length
              )
                throw Error("native-profile-unqualified");
              initialized = true;
              onStarted(null);
            } else if (!initialized) {
              throw Error("wrong-native-turn");
            } else if (
              m.type === "assistant" &&
              object(m.message) &&
              Array.isArray(m.message.content)
            ) {
              if (m.message.content.some((c: unknown) => object(c) && c.type === "tool_use"))
                throw Error("native-profile-unqualified");
            } else if (m.type === "result") {
              state.outcome = m.is_error === false ? "completed" : "failed";
              terminal = true;
              if (state.outcome === "completed")
                try {
                  proposal = {
                    ...parseCorrespondenceAnswer(m.structured_output, request, packet),
                    source: "supervised-native",
                  };
                } catch {
                  proposal = undefined;
                }
            }
          } catch {
            invalid = true;
            state.outcome = "unknown";
            stop();
          }
        }
      });
      let exitCode: number | null = null;
      try {
        await new Promise<void>((resolve) => {
          child.once("error", () => {
            invalid = true;
            resolve();
          });
          child.once("close", (code) => {
            exitCode = code;
            resolve();
          });
          child.stdin.end(correspondenceInput(request.task.input, request.task.inputDigest));
        });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", stop);
        stop();
        await cleanup;
      }
      if (invalid || !terminal || exitCode !== 0 || buffer.trim()) {
        state.outcome = "unknown";
        proposal = undefined;
      }
      return {
        nativeSessionId: session,
        nativeTurnId: null,
        outcome: state.outcome,
        ...(proposal && state.outcome === "completed" ? { agentProposal: proposal } : {}),
      };
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
