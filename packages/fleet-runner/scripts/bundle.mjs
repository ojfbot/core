import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(pkg, "../..");
const version = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
const dirty = execFileSync(
  "git",
  ["status", "--porcelain", "--", "packages/fleet-runner", "pnpm-lock.yaml"],
  { cwd: root, encoding: "utf8" },
).trim();
const commit = dirty
  ? "uncommitted"
  : execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const out = join(pkg, "dist/release/fleet-runner.mjs");
mkdirSync(dirname(out), { recursive: true });
await build({
  entryPoints: [join(pkg, "src/cli.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "inline",
  define: {
    __FLEET_RELEASE__: JSON.stringify({
      name: "fleet-runner",
      version,
      commit,
      node_floor: "24.22.2",
      bundled: true,
    }),
  },
});
process.stdout.write(`fleet-runner ${version} (${commit}) bundled\n`);
