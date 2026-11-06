import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const [workspaceArg, dependenciesFileArg, outputArg] = process.argv.slice(2);
if (!workspaceArg || !dependenciesFileArg || !outputArg) {
  throw new Error("usage: write-build-manifest.mjs WORKSPACE DEPENDENCIES_JSON OUTPUT_JSON");
}
const workspace = resolve(workspaceArg);
const packageDir = join(workspace, "packages/fleet-runner");
const outputFile = resolve(outputArg);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fileHashes(directory, prefix) {
  const rows = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        rows.push({ path: relative(workspace, absolute), sha256: digest(await readFile(absolute)) });
      }
    }
  }
  await visit(directory);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function flattenPackages(value, rows = []) {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object" && !("name" in value)
      ? Object.values(value)
      : [value];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    rows.push({ name: item.name ?? "", version: item.version ?? "" });
    flattenPackages(item.dependencies ?? {}, rows);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

const dependenciesPath = resolve(dependenciesFileArg);
const dependencyTree = JSON.parse(await readFile(dependenciesPath, "utf8"));
const sourceFiles = [
  join(workspace, "package.json"),
  join(workspace, "pnpm-lock.yaml"),
  join(workspace, "pnpm-workspace.yaml"),
  join(workspace, "tsconfig.base.json"),
  join(packageDir, "package.json"),
  join(packageDir, "LICENSE"),
  join(packageDir, "README.md"),
  join(packageDir, "deployment.md"),
  join(packageDir, "tsconfig.json"),
  ...(await fileHashes(join(packageDir, "src"), "src" )).map((row) => join(workspace, row.path)),
  ...(await fileHashes(join(packageDir, "scripts"), "scripts")).map((row) => join(workspace, row.path)),
];
const sources = [];
for (const file of sourceFiles) {
  const bytes = await readFile(file);
  sources.push({ path: relative(workspace, file), sha256: digest(bytes) });
}
sources.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  schemaVersion: 1,
  package: "@core/fleet-runner",
  source: {
    files: sources,
    sha256: digest(sources.map((row) => `${row.path}\0${row.sha256}`).join("\n")),
  },
  lockfileSha256: digest(await readFile(join(workspace, "pnpm-lock.yaml"))),
  tools: {
    node: process.version,
    pnpm: execFileSync("pnpm", ["--version"], { cwd: workspace, encoding: "utf8" }).trim(),
  },
  dependencies: flattenPackages(dependencyTree),
  dist: await fileHashes(join(packageDir, "dist"), "dist"),
};
await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
