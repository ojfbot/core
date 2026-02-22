import fs from "node:fs/promises";
import path from "node:path";
import type { WorkflowArgs } from "../types.js";

export type RunMeta = {
  workflow: string;
  timestamp: string;
  durationMs: number;
  args: WorkflowArgs;
  cwd: string;
  runDir: string;
};

/**
 * Derive a short, filesystem-safe slug from workflow args.
 * Priority: --mode flag → first positional → first flag key+value → empty string.
 */
function slugFromArgs(args: WorkflowArgs): string {
  // techdebt and similar: --mode is the most descriptive flag
  if (typeof args.flags.mode === "string") {
    return sanitize(args.flags.mode);
  }

  // First positional arg (file path, feature name, etc.)
  if (args.positional.length > 0) {
    // Use basename for file paths to keep it readable
    const first = args.positional[0];
    const base = first.includes("/") || first.includes("\\")
      ? path.basename(first, path.extname(first))
      : first;
    return sanitize(base);
  }

  // First flag with a string value
  const firstFlag = Object.entries(args.flags).find(([, v]) => typeof v === "string");
  if (firstFlag) {
    return sanitize(`${firstFlag[0]}`);
  }

  return "";
}

function sanitize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/T/, "-")
    .replace(/:/g, "")
    .replace(/\..+/, "");
}

/**
 * Build the run directory path and write output + metadata files.
 * Returns the path to the run directory.
 *
 * Directory structure:
 *   runs/<workflow>/<YYYY-MM-DD-HHmmss>[-<slug>]/
 *     output.md
 *     run.json
 */
export async function writeRun(
  cwd: string,
  meta: Omit<RunMeta, "runDir">,
  output: string
): Promise<string> {
  const slug = slugFromArgs(meta.args);
  const ts = timestamp();
  const dirName = slug ? `${ts}-${slug}` : ts;
  const runDir = path.join(cwd, "runs", meta.workflow, dirName);

  await fs.mkdir(runDir, { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(runDir, "output.md"), output, "utf-8"),
    fs.writeFile(
      path.join(runDir, "run.json"),
      JSON.stringify({ ...meta, runDir }, null, 2),
      "utf-8"
    ),
  ]);

  return runDir;
}
