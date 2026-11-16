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
 * The correspondence allowlist: data only, deep-frozen. Correspondence plans, dispatchers and duty
 * windows take their Claude versions from here. To add a version, commit its trace (from
 * `scripts/qualify-claude-correspondence.mjs`, which also prints this entry) and add the entry.
 * 2.1.308 (Yojimbo) and 2.1.286 (Yuri) were qualified on 16 November 2026 (CHARTER-BATCH-01);
 * other versions are refused.
 */
export const CLAUDE_CORRESPONDENCE_QUALIFIED: readonly QualifiedClaudeCorrespondence[] = deepFreeze(
  [
    {
      nativeVersion: "2.1.308",
      model: "claude-sonnet-5-5",
      binarySHA256: "ca923c86ac84b30574a82331a05b6e066c27477a926ceaffe46a845a33e4dd37",
      traceSHA256: "2116edc9078e2aefe34a5c7e2f03339866c10b418bd5187cbd5116c4f213d5fb",
      builtinAgents: ["Explore", "Plan", "claude", "general-purpose", "web-fetch"],
      builtinPlugins: [
        "cc-plugin-agents-md",
        "cc-plugin-easel",
        "cc-plugin-plugin-authoring",
        "cc-plugin-telemetry",
      ],
      trace:
        '{\n  "format": "claude-correspondence-trace-v4",\n  "source": "recorded",\n  "binary_sha256": "ca923c86ac84b30574a82331a05b6e066c27477a926ceaffe46a845a33e4dd37",\n  "frames": [\n    {\n      "type": "system",\n      "subtype": "init",\n      "model": "claude-sonnet-5-5",\n      "claude_code_version": "2.1.308",\n      "tools": [\n        "StructuredOutput"\n      ],\n      "mcp_servers": {\n        "count": 0,\n        "empty": true\n      },\n      "slash_commands": {\n        "count": 0,\n        "empty": true\n      },\n      "skills": {\n        "count": 0,\n        "empty": true\n      },\n      "agents": [\n        "Explore",\n        "Plan",\n        "claude",\n        "general-purpose",\n        "web-fetch"\n      ],\n      "plugins": [\n        "cc-plugin-agents-md",\n        "cc-plugin-easel",\n        "cc-plugin-plugin-authoring",\n        "cc-plugin-telemetry"\n      ],\n      "init_key_shapes": {\n        "capabilities": {\n          "type": "array",\n          "length": 13,\n          "allowed": true\n        },\n        "original_cwd": {\n          "type": "string",\n          "length": 60,\n          "allowed": true\n        },\n        "additional_directories": {\n          "type": "array",\n          "length": 0,\n          "allowed": true\n        },\n        "fast_mode_state": {\n          "type": "string",\n          "length": 3,\n          "allowed": true\n        },\n        "fast_mode_disabled_reason": {\n          "type": "string",\n          "length": 19,\n          "allowed": true\n        },\n        "per_turn_effort_active": {\n          "type": "boolean",\n          "allowed": true\n        },\n        "view_mode": {\n          "type": "string",\n          "length": 7,\n          "allowed": true\n        }\n      }\n    },\n    {\n      "type": "assistant",\n      "message": {\n        "content": [\n          {\n            "type": "tool_use",\n            "name": "StructuredOutput",\n            "input": {\n              "packetDigest": "3c0e6a82c4d4c387f4b8948aae1b56d2906b4155aef253a0299548b0eb4956b5",\n              "decision": "reply",\n              "reason": null,\n              "text": "Confirmed: I received the qualification packet.",\n              "needs": null,\n              "gaps": null\n            }\n          }\n        ]\n      }\n    },\n    {\n      "type": "user"\n    },\n    {\n      "type": "rate_limit_event"\n    },\n    {\n      "type": "result",\n      "subtype": "success",\n      "is_error": false,\n      "has_structured_output": true,\n      "structured_output": {\n        "packetDigest": "3c0e6a82c4d4c387f4b8948aae1b56d2906b4155aef253a0299548b0eb4956b5",\n        "decision": "reply",\n        "reason": null,\n        "text": "Confirmed: I received the qualification packet.",\n        "needs": null,\n        "gaps": null\n      }\n    }\n  ]\n}\n',
    },
    {
      nativeVersion: "2.1.286",
      model: "claude-sonnet-5-5",
      binarySHA256: "75e3016e9d2570767b08e43a7467d4817a4f149232c169ca295f2c95fef21433",
      traceSHA256: "5d7f2b0ff443a5fc92c50b151f071aa76f01d7d0a2ff4977caad7a131f792623",
      builtinAgents: ["Explore", "Plan", "claude", "general-purpose", "web-fetch"],
      builtinPlugins: ["cc-plugin-agents-md", "cc-plugin-plugin-authoring", "cc-plugin-telemetry"],
      trace:
        '{\n  "format": "claude-correspondence-trace-v4",\n  "source": "recorded",\n  "binary_sha256": "75e3016e9d2570767b08e43a7467d4817a4f149232c169ca295f2c95fef21433",\n  "frames": [\n    {\n      "type": "system",\n      "subtype": "init",\n      "model": "claude-sonnet-5-5",\n      "claude_code_version": "2.1.286",\n      "tools": [\n        "StructuredOutput"\n      ],\n      "mcp_servers": {\n        "count": 0,\n        "empty": true\n      },\n      "slash_commands": {\n        "count": 0,\n        "empty": true\n      },\n      "skills": {\n        "count": 0,\n        "empty": true\n      },\n      "agents": [\n        "Explore",\n        "Plan",\n        "claude",\n        "general-purpose",\n        "web-fetch"\n      ],\n      "plugins": [\n        "cc-plugin-agents-md",\n        "cc-plugin-plugin-authoring",\n        "cc-plugin-telemetry"\n      ],\n      "init_key_shapes": {\n        "capabilities": {\n          "type": "array",\n          "length": 8,\n          "allowed": true\n        },\n        "fast_mode_state": {\n          "type": "string",\n          "length": 3,\n          "allowed": true\n        },\n        "fast_mode_disabled_reason": {\n          "type": "string",\n          "length": 19,\n          "allowed": true\n        },\n        "per_turn_effort_active": {\n          "type": "boolean",\n          "allowed": true\n        },\n        "view_mode": {\n          "type": "string",\n          "length": 7,\n          "allowed": true\n        }\n      }\n    },\n    {\n      "type": "assistant",\n      "message": {\n        "content": [\n          {\n            "type": "tool_use",\n            "name": "StructuredOutput",\n            "input": {\n              "packetDigest": "3c0e6a82c4d4c387f4b8948aae1b56d2906b4155aef253a0299548b0eb4956b5",\n              "decision": "reply",\n              "reason": null,\n              "text": "Received: I have your qualification packet.",\n              "needs": null,\n              "gaps": null\n            }\n          }\n        ]\n      }\n    },\n    {\n      "type": "user"\n    },\n    {\n      "type": "rate_limit_event"\n    },\n    {\n      "type": "result",\n      "subtype": "success",\n      "is_error": false,\n      "has_structured_output": true,\n      "structured_output": {\n        "packetDigest": "3c0e6a82c4d4c387f4b8948aae1b56d2906b4155aef253a0299548b0eb4956b5",\n        "decision": "reply",\n        "reason": null,\n        "text": "Received: I have your qualification packet.",\n        "needs": null,\n        "gaps": null\n      }\n    }\n  ]\n}\n',
    },
  ],
);

/** Where the reviewed trace files are committed: `qualification/claude/` in this package. */
export const CORRESPONDENCE_TRACE_DIRECTORY = fileURLToPath(
  new URL("../qualification/claude/", import.meta.url),
);
