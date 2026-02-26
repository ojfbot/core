import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import type { WorkflowSpec } from "../types.js";

const execFileAsync = promisify(execFile);

const LAUNCHER = path.join(os.homedir(), ".tmux", "workbench", "workbench.py");

const USAGE = `\
/workbench <command> [options]

Commands:
  start   Launch the 6-tile tmux workbench (default)
  kill    Stop all workbench tmux servers
  status  Show running state of outer + inner sessions

Options:
  --config PATH        Path to config JSON (default: ~/.tmux/workbench/config.json)
  --config-json JSON   Inline JSON config string (overrides --config)
  --reset              Kill and recreate tmux servers before starting

Inline repo shorthand (--repo repeatable):
  /workbench start \\
    --repo='{"name":"api","path":"/code/api","service_cmd":"pnpm start","claude_prompt":"help me with auth"}' \\
    --repo='{"name":"web","path":"/code/web","service_cmd":"pnpm dev"}'

See ~/.tmux/workbench/example-config.json for the full config schema.
See domain-knowledge/workbench-architecture.md for full documentation.`;

interface RepoConfig {
  name: string;
  path: string;
  init?: string;
  shell_init?: string;
  service_cmd?: string;
  claude_cmd?: string;
  claude_prompt?: string;
}

export const workbenchWorkflow: WorkflowSpec = {
  name: "workbench",
  description:
    "Launch / stop / inspect the 6-tile tmux multi-repo development workbench",
  usage: USAGE,

  async handler({ args }) {
    // Determine sub-command (default: start)
    const subcommand = (args.positional[0] ?? "start") as
      | "start"
      | "kill"
      | "status";

    if (!["start", "kill", "status"].includes(subcommand)) {
      return `Unknown command: "${subcommand}"\n\n${USAGE}`;
    }

    // Build launcher argv
    const launcherArgs: string[] = [subcommand];

    // --reset
    if (args.flags["reset"] === true) {
      launcherArgs.push("--reset");
    }

    // --config-json wins over --config
    const configJson = args.flags["config-json"] as string | undefined;
    const configPath = args.flags["config"] as string | undefined;

    // Collect --repo flags (may be repeated; parser stores last value only,
    // so we reconstruct from raw positional extra args if needed)
    const inlineRepos: RepoConfig[] = [];
    for (const [k, v] of Object.entries(args.flags)) {
      if (k === "repo" && typeof v === "string") {
        try {
          inlineRepos.push(JSON.parse(v) as RepoConfig);
        } catch {
          return `Error: --repo value is not valid JSON: ${v}`;
        }
      }
    }

    if (inlineRepos.length > 0) {
      // Build an inline config from --repo flags
      const inlineConfig = {
        socket: "workbench",
        session: "workbench",
        max_slots: 6,
        repos: inlineRepos,
      };
      launcherArgs.push("--config-json", JSON.stringify(inlineConfig));
    } else if (configJson) {
      launcherArgs.push("--config-json", configJson);
    } else if (configPath) {
      launcherArgs.push("--config", configPath);
    }
    // If none provided, launcher defaults to ~/.tmux/workbench/config.json

    try {
      const { stdout, stderr } = await execFileAsync(
        "python3",
        [LAUNCHER, ...launcherArgs],
        { timeout: 30_000 }
      );
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      return out || `workbench ${subcommand}: done`;
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
      if (e.code === "ENOENT") {
        return [
          `Error: launcher not found at ${LAUNCHER}`,
          "Run /workbench setup, or check domain-knowledge/workbench-architecture.md for install instructions.",
        ].join("\n");
      }
      const detail = [e.stderr, e.stdout, e.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      return `workbench ${subcommand} failed:\n${detail}`;
    }
  },
};
