import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { object } from "./admission.js";
import { ADVISORY_OUTPUT_SCHEMA, parseCanaryProposal } from "./advisory.js";
import { checkBinary, readPrivateFile } from "./supervised-files.js";
import type { NativeObservation, QualificationTransport } from "./native.js";
import type { PreparedSupervisedCanary } from "./supervised-types.js";
import type { SubscriptionCanaryBinding, SubscriptionCanaryProfile } from "./canary-types.js";

export interface SupervisedTransport {
  readonly mode: "supervised";
  resume: QualificationTransport["resume"];
}
const transports = new WeakSet<object>();
export function isSupervisedTransport(value: unknown): value is SupervisedTransport {
  return object(value) && transports.has(value);
}

const disabledCodexFeatures = [
  "apps",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "browser_annotation_api",
  "in_app_browser",
  "hooks",
  "memories",
  "multi_agent",
  "multi_agent_v2",
  "multi_agent_v2_dynamic_tools",
  "remote_plugin",
  "shell_snapshot",
  "skill_mcp_dependency_install",
  "standalone_web_search",
];

export function supervisedCommand(
  binding: SubscriptionCanaryBinding,
  profile: SubscriptionCanaryProfile,
  schema: string,
): string[] {
  if (binding.provider === "codex")
    return [
      "-a",
      "never",
      "-s",
      "read-only",
      "-C",
      binding.cwd,
      "-c",
      'model_provider="openai"',
      "-c",
      'web_search="disabled"',
      "-c",
      "apps._default.enabled=false",
      "-c",
      "project_doc_max_bytes=0",
      "-c",
      'model_reasoning_effort="low"',
      ...disabledCodexFeatures.flatMap((f) => ["-c", `features.${f}=false`]),
      "exec",
      "resume",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--json",
      "--model",
      profile.model,
      "--output-schema",
      schema,
      binding.nativeSessionId,
      "-",
    ];
  return [
    "--print",
    binding.sessionPolicy === "initial-fixed" ? "--session-id" : "--resume",
    binding.nativeSessionId,
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
    JSON.stringify(ADVISORY_OUTPUT_SCHEMA),
  ];
}

/** Internal built-in real launcher. The exported supervised opener supplies the checked frozen plan. */
export function createSupervisedTransport(
  prepared: PreparedSupervisedCanary,
  stateDirectory: string,
  expiresAtMs: number,
  environment: NodeJS.ProcessEnv,
  beforeLaunch: () => void,
): SupervisedTransport {
  const transport: SupervisedTransport = {
    mode: "supervised",
    resume: async ({ binding, profile, request, signal, timeoutMs, onStarted }) => {
      const fixed = prepared.plan.bindings.find((b) => b.alias === binding.alias),
        pinned = prepared.plan.profiles.find((p) => p.revision === profile.revision);
      if (!fixed || !pinned || signal.aborted) throw Error("held");
      const schema = join(stateDirectory, `native-output-schema-${prepared.planDigest}.json`);
      if (binding.provider === "codex") {
        const bytes = JSON.stringify(ADVISORY_OUTPUT_SCHEMA);
        try {
          writeFileSync(schema, bytes, { flag: "wx", mode: 0o600 });
        } catch (error) {
          if (!(object(error) && error.code === "EEXIST")) throw error;
        }
        if (readPrivateFile(schema, 8192).toString("utf8") !== bytes) throw Error("held");
      }
      checkBinary(pinned);
      beforeLaunch();
      const remainingMs = expiresAtMs - Date.now();
      if (remainingMs <= 0) throw Error("expired");
      const child = spawn(pinned.binaryRealPath, supervisedCommand(fixed, pinned, schema), {
        cwd: fixed.cwd,
        env: environment,
        detached: true,
        stdio: ["pipe", "pipe", "ignore"],
      });
      const state: Pick<NativeObservation, "outcome"> = { outcome: "unknown" };
      let proposal: NativeObservation["agentProposal"],
        total = 0,
        buffer = "",
        initialized = false,
        started = false,
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
        if (total > 65536) {
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
            if (fixed.provider === "codex") {
              if (m.type === "thread.started") {
                if (initialized || m.thread_id !== fixed.nativeSessionId)
                  throw Error("wrong-native-session");
                initialized = true;
              } else if (m.type === "turn.started") {
                if (!initialized || started) throw Error("wrong-native-turn");
                started = true;
                onStarted(null);
              } else if (
                (m.type === "item.started" || m.type === "item.completed") &&
                object(m.item) &&
                ["mcp_tool_call", "web_search", "collab_tool_call"].includes(String(m.item.type))
              ) {
                throw Error("native-profile-unqualified");
              } else if (
                m.type === "item.completed" &&
                object(m.item) &&
                m.item.type === "agent_message"
              ) {
                if (!started || typeof m.item.text !== "string")
                  throw Error("invalid-native-frame");
                try {
                  proposal = {
                    ...parseCanaryProposal(
                      JSON.parse(m.item.text),
                      request,
                      prepared.plan.fixture.sha256,
                    ),
                    source: "supervised-native",
                  };
                } catch {
                  proposal = undefined;
                }
              } else if (m.type === "turn.completed" || m.type === "turn.failed") {
                if (!started) throw Error("wrong-native-turn");
                state.outcome = m.type === "turn.completed" ? "completed" : "failed";
                terminal = true;
              } else if (m.type === "error") {
                invalid = true;
                stop();
              }
            } else {
              if (m.session_id !== fixed.nativeSessionId) throw Error("wrong-native-session");
              if (m.type === "system" && m.subtype === "init") {
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
                started = true;
                onStarted(null);
              } else if (m.type === "result") {
                if (!started) throw Error("wrong-native-turn");
                state.outcome = m.is_error === false ? "completed" : "failed";
                terminal = true;
                if (state.outcome === "completed")
                  try {
                    proposal = {
                      ...parseCanaryProposal(
                        m.structured_output,
                        request,
                        prepared.plan.fixture.sha256,
                      ),
                      source: "supervised-native",
                    };
                  } catch {
                    proposal = undefined;
                  }
              }
            }
          } catch {
            invalid = true;
            state.outcome = "unknown";
            stop();
          }
        }
      });
      const input = JSON.stringify({
        instruction:
          "Review only the fixed fixture. Return the required JSON ack and result. Do not use tools. The ack must echo message_id as messageId, bindingRevision, and the fixture sha256 as fixtureDigest. Result text must contain the requested wording only.",
        pointer: JSON.parse(request.task.input),
        advisoryFixture: prepared.plan.fixture,
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
          child.stdin.end(input + "\n");
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
        nativeSessionId: fixed.nativeSessionId,
        nativeTurnId: null,
        outcome: state.outcome,
        ...(proposal && state.outcome === "completed" ? { agentProposal: proposal } : {}),
      };
    },
  };
  transports.add(transport);
  return Object.freeze(transport);
}
