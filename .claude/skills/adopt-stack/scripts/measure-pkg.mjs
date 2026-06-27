#!/usr/bin/env node
/**
 * measure-pkg — deterministic Gate-0 measurement for /adopt-stack.
 *
 * The script owns the numbers; the LLM owns the judgment (the /skill-audit discipline).
 * Every figure here comes from the npm registry via `pnpm view` — NOT from the model's memory.
 * If the registry can't answer, the script says "unknown" and exits non-zero; it never guesses.
 *
 * What it can prove WITHOUT installing: unpacked size, DIRECT dep count, declared engines,
 * the package's own install/postinstall scripts, and name-pattern signals (telemetry SDKs,
 * embedded DB/server/UI) across direct deps. Transitive tree size and transitive native builds
 * require an actual install in a throwaway dir — the script flags that rather than inventing it.
 *
 * Usage:
 *   node measure-pkg.mjs <pkg>[@version]        # markdown table (default)
 *   node measure-pkg.mjs <pkg> --json           # machine-readable
 *   node measure-pkg.mjs --help
 *
 * Exit codes: 0 ok · 1 registry/lookup failure (no data — do NOT fabricate) · 2 bad usage.
 */
import { execFileSync } from 'node:child_process';

const TELEMETRY = [/amplitude/i, /sentry/i, /rrweb/i, /segment/i, /posthog/i, /mixpanel/i, /datadog/i, /bugsnag/i, /\banalytics\b/i, /heap-/i, /fullstory/i];
const DB = [/sqlite/i, /better-sqlite3/i, /libsql/i, /neondatabase/i, /\bpg\b/i, /mysql/i, /mongodb/i, /prisma/i, /drizzle/i, /typeorm/i, /knex/i];
const SERVER = [/express/i, /fastify/i, /\bkoa\b/i, /\bhapi\b/i, /nitro/i, /\bh3\b/i, /next$/i, /react-router/i, /\bvite\b/i];
const UI = [/^react$/i, /^react-dom$/i, /^vue$/i, /^svelte$/i, /@radix-ui/i, /@tiptap/i, /codemirror/i, /@mui/i, /@chakra-ui/i, /tailwind/i];
const AUTH = [/better-auth/i, /next-auth/i, /passport/i, /@auth0/i, /@clerk/i, /firebase-auth/i];
const NATIVE_HINT = [/better-sqlite3/i, /node-gyp/i, /sharp/i, /canvas/i, /bcrypt$/i, /\bgrpc\b/i, /sodium-native/i];

function usage(code) {
  process.stdout.write(`measure-pkg — deterministic Gate-0 measurement for /adopt-stack

Usage:
  node measure-pkg.mjs <pkg>[@version]      markdown table (default)
  node measure-pkg.mjs <pkg> --json         machine-readable JSON
  node measure-pkg.mjs --help

Reports only registry-provable facts. "unknown" is an honest answer; never substitute a guess.
`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) usage(args.length === 0 ? 2 : 0);
const asJson = args.includes('--json');
const pkg = args.find((a) => !a.startsWith('--'));
if (!pkg) usage(2);

function view(field) {
  // `pnpm view <pkg> <field> --json` — returns JSON for that field, or throws on lookup failure.
  const out = execFileSync('pnpm', ['view', pkg, field, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out.trim() ? JSON.parse(out) : undefined;
}

let size, deps, engines, scripts, bin, version;
try {
  version = view('version');
  size = view('dist.unpackedSize');
  deps = view('dependencies') || {};
  engines = view('engines') || {};
  scripts = view('scripts') || {};
  bin = view('bin');
} catch (err) {
  process.stderr.write(`measure-pkg: registry lookup failed for "${pkg}". No data — do NOT fabricate numbers.\n${err.message}\n`);
  process.exit(1);
}

const depNames = Object.keys(deps);
const match = (pats) => depNames.filter((d) => pats.some((p) => p.test(d)));
const sizeMB = typeof size === 'number' ? +(size / 1024 / 1024).toFixed(1) : null;
const ownInstallScripts = Object.keys(scripts).filter((s) => /^(pre|post)?install$/.test(s));

const signals = {
  pkg,
  version: version ?? 'unknown',
  unpackedSizeMB: sizeMB, // null = registry did not report it
  directDeps: depNames.length,
  transitiveDeps: 'unknown (requires install in a throwaway dir — do not estimate)',
  engines,
  telemetrySDKs: match(TELEMETRY),
  dbDrivers: match(DB),
  serverOrRouter: match(SERVER),
  uiFrameworks: match(UI),
  authStacks: match(AUTH),
  nativeBuildHints: match(NATIVE_HINT),
  ownInstallScripts, // package's OWN install/postinstall (transitive native builds not visible here)
  hasBin: !!bin,
};

// Heuristic SIGNAL only — not a verdict. The LLM makes the library-vs-application call.
const appSignals =
  (sizeMB && sizeMB >= 20 ? 1 : 0) +
  (depNames.length >= 25 ? 1 : 0) +
  (signals.telemetrySDKs.length ? 1 : 0) +
  (signals.dbDrivers.length ? 1 : 0) +
  (signals.serverOrRouter.length || signals.uiFrameworks.length ? 1 : 0) +
  (signals.authStacks.length ? 1 : 0);
signals.applicationSignalCount = `${appSignals}/6 application-shaped signals`;

if (asJson) {
  process.stdout.write(JSON.stringify(signals, null, 2) + '\n');
  process.exit(0);
}

const row = (k, v) => `| ${k} | ${v} |`;
const list = (a) => (a.length ? '⚠️ ' + a.join(', ') : '—');
process.stdout.write(`## Gate 0 measurement — \`${signals.pkg}@${signals.version}\`

_All values from \`pnpm view\` (registry). "unknown" = not registry-provable; never substitute a guess._

| Signal | Measurement |
|--------|-------------|
${row('Unpacked size', sizeMB != null ? `${sizeMB} MB` : 'unknown (registry omitted dist.unpackedSize)')}
${row('Direct dependencies', signals.directDeps)}
${row('Transitive tree', signals.transitiveDeps)}
${row('Engines', Object.keys(engines).length ? JSON.stringify(engines) : '—')}
${row('Telemetry SDKs', list(signals.telemetrySDKs))}
${row('DB drivers', list(signals.dbDrivers))}
${row('Server / router', list(signals.serverOrRouter))}
${row('UI frameworks', list(signals.uiFrameworks))}
${row('Auth stacks', list(signals.authStacks))}
${row('Native-build hints (direct)', list(signals.nativeBuildHints))}
${row("Package's own install scripts", signals.ownInstallScripts.length ? signals.ownInstallScripts.join(', ') : '—')}
${row('Ships a bin/CLI', signals.hasBin ? 'yes' : 'no')}
${row('Application-shaped signals', signals.applicationSignalCount)}

> This is a SIGNAL, not a verdict. You make the library-vs-application call and the per-opinion
> wrap/absorb/reject calls. To measure the transitive tree / native builds, install once in a
> throwaway dir (scratchpad), never the host lockfile.
`);
process.exit(0);
