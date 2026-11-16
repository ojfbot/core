import { fileURLToPath } from "node:url";

/** One Claude Code version qualified for correspondence by a recorded, replayable trace. */
export interface QualifiedClaudeCorrespondence {
  nativeVersion: string;
  /** The exact native model name the plan must pin and the trace must report. */
  model: string;
  /** SHA-256 of the pinned Claude binary; the trace records the same hash. */
  binarySHA256: string;
  /** SHA-256 of `trace`. */
  traceSHA256: string;
  /**
   * The built-in agent and plugin names safe mode still loads, exactly as the trace recorded them
   * (sorted). Every duty turn must report exactly these (owner, 16 November: "Pin exact names").
   */
  builtinAgents: readonly string[];
  builtinPlugins: readonly string[];
  /**
   * The trace's exact bytes, embedded so they travel with the code into bundles. They must equal
   * the reviewed source `qualification/claude/<nativeVersion>.trace.json`; a test checks it.
   */
  trace: string;
}

/** Freezes a value and everything in it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Exact entries qualified under the current correspondence invocation policy. Changing that
 * policy requires new qualification; historical traces never authorize a new invocation.
 */
export const CLAUDE_CORRESPONDENCE_QUALIFIED: readonly QualifiedClaudeCorrespondence[] = deepFreeze(
  [
    {
      nativeVersion: "2.1.286",
      model: "claude-sonnet-5-5",
      binarySHA256: "75e3016e9d2570767b08e43a7467d4817a4f149232c169ca295f2c95fef21433",
      traceSHA256: "7b7f7a2a0a5c5d9c86315a7dca6796ad7f1f3bb2948571971a0f7e45932b9135",
      trace:
        '{\n  "format": "claude-correspondence-trace-v4",\n  "source": "recorded",\n  "binary_sha256": "75e3016e9d2570767b08e43a7467d4817a4f149232c169ca295f2c95fef21433",\n  "frames": [\n    {\n      "type": "system",\n      "subtype": "init",\n      "model": "claude-sonnet-5-5",\n      "claude_code_version": "2.1.286",\n      "tools": [\n        "StructuredOutput"\n      ],\n      "mcp_servers": {\n        "count": 0,\n        "empty": true\n      },\n      "slash_commands": {\n        "count": 0,\n        "empty": true\n      },\n      "skills": {\n        "count": 0,\n        "empty": true\n      },\n      "agents": [],\n      "plugins": [],\n      "init_key_shapes": {\n        "capabilities": {\n          "type": "array",\n          "length": 8,\n          "allowed": true\n        },\n        "fast_mode_state": {\n          "type": "string",\n          "length": 3,\n          "allowed": true\n        },\n        "fast_mode_disabled_reason": {\n          "type": "string",\n          "length": 19,\n          "allowed": true\n        },\n        "per_turn_effort_active": {\n          "type": "boolean",\n          "allowed": true\n        },\n        "view_mode": {\n          "type": "string",\n          "length": 7,\n          "allowed": true\n        }\n      }\n    },\n    {\n      "type": "assistant",\n      "message": {\n        "content": [\n          {\n            "type": "tool_use",\n            "name": "StructuredOutput",\n            "input": {\n              "packetDigest": "3c0e6a82c4d4c387f4b8948aae1b56d2906b4155aef253a0299548b0eb4956b5",\n              "decision": "reply",\n              "reason": null,\n              "text": "Received: your fixed qualification packet arrived and I have read it.",\n              "needs": null,\n              "gaps": null\n            }\n          }\n        ]\n      }\n    },\n    {\n      "type": "user"\n    },\n    {\n      "type": "rate_limit_event"\n    },\n    {\n      "type": "result",\n      "subtype": "success",\n      "is_error": false,\n      "has_structured_output": true,\n      "structured_output": {\n        "packetDigest": "3c0e6a82c4d4c387f4b8948aae1b56d2906b4155aef253a0299548b0eb4956b5",\n        "decision": "reply",\n        "reason": null,\n        "text": "Received: your fixed qualification packet arrived and I have read it.",\n        "needs": null,\n        "gaps": null\n      }\n    }\n  ]\n}\n',
      builtinAgents: [],
      builtinPlugins: [],
    },
  ],
);

/** Where active reviewed traces are committed. Historical evidence stays in its subdirectory. */
export const CORRESPONDENCE_TRACE_DIRECTORY = fileURLToPath(
  new URL("../qualification/claude/", import.meta.url),
);
