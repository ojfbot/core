import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute } from "node:path";
import type { SubscriptionCanaryProfile } from "./canary-types.js";
import type { SupervisedEnvironment } from "./supervised-types.js";
import { object } from "./admission.js";

function same(a: { dev: number; ino: number }, b: { dev: number; ino: number }) {
  return a.dev === b.dev && a.ino === b.ino;
}

function noAcl(path: string, fd: number): void {
  if (process.platform !== "darwin") throw Error("acl-unqualified");
  const before = fstatSync(fd);
  const result = spawnSync("/bin/ls", ["-lde", path], {
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C" },
    timeout: 1000,
    maxBuffer: 8192,
  });
  if (
    result.status !== 0 ||
    result.error ||
    result.stdout.split("\n").filter(Boolean).length !== 1 ||
    /\+/.test(result.stdout.slice(0, 12)) ||
    !same(before, statSync(path))
  )
    throw Error("acl-unqualified");
}

export function checkPrivateDirectory(path: string): void {
  if (!isAbsolute(path) || realpathSync(path) !== path) throw Error("unsafe-local-state");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try {
    const s = fstatSync(fd);
    if (!s.isDirectory() || s.uid !== process.getuid?.() || s.mode & 0o077)
      throw Error("unsafe-local-state");
    noAcl(path, fd);
  } finally {
    closeSync(fd);
  }
  checkAncestors(path);
}

/** Every parent up to `/`: owned by this user or root, and not group/other-writable unless sticky root. */
function checkAncestors(path: string): void {
  for (let parent = dirname(path); ; parent = dirname(parent)) {
    const ancestor = openSync(
      parent,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY,
    );
    try {
      const s = fstatSync(ancestor),
        uid = process.getuid?.();
      const stickyRoot = s.uid === 0 && Boolean(s.mode & 0o1000);
      if (!s.isDirectory() || (s.uid !== uid && s.uid !== 0) || (s.mode & 0o022 && !stickyRoot))
        throw Error("unsafe-local-state");
      noAcl(parent, ancestor);
    } finally {
      closeSync(ancestor);
    }
    if (parent === dirname(parent)) break;
  }
}

export function readPrivateFile(path: string, maxBytes: number): Buffer {
  if (!isAbsolute(path) || realpathSync(path) !== path) throw Error("runtime-approval-invalid");
  checkPrivateDirectory(dirname(path));
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (
      !s.isFile() ||
      s.uid !== process.getuid?.() ||
      s.mode & 0o077 ||
      s.size > maxBytes ||
      !same(s, statSync(path))
    )
      throw Error("runtime-approval-invalid");
    noAcl(path, fd);
    const bytes = Buffer.alloc(maxBytes + 1);
    let size = 0,
      read = 0;
    while ((read = readSync(fd, bytes, size, bytes.length - size, null)) > 0) {
      size += read;
      if (size > maxBytes) throw Error("runtime-approval-invalid");
    }
    if (!same(s, statSync(path))) throw Error("runtime-approval-invalid");
    return bytes.subarray(0, size);
  } finally {
    closeSync(fd);
  }
}

export function checkBinary(profile: SubscriptionCanaryProfile): void {
  const path = profile.binaryRealPath;
  if (!isAbsolute(path) || realpathSync(path) !== path) throw Error("binary-pin-mismatch");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (
      !s.isFile() ||
      !(s.mode & 0o111) ||
      s.mode & 0o022 ||
      s.size > 512 * 1024 * 1024 ||
      !same(s, statSync(path))
    )
      throw Error("binary-pin-mismatch");
    const hash = createHash("sha256"),
      bytes = Buffer.alloc(1024 * 1024);
    let n = 0;
    while ((n = readSync(fd, bytes, 0, bytes.length, null)) > 0) hash.update(bytes.subarray(0, n));
    if (hash.digest("hex") !== profile.binarySHA256 || !same(s, statSync(path)))
      throw Error("binary-pin-mismatch");
  } finally {
    closeSync(fd);
  }
}

/** Static, no-inference qualification. Unknown managed sources remain a hold. */
// API-auth measurements did not establish subscription tool omission (live trial 3203).
const qualifiedCodexProfiles: ReadonlyArray<
  Pick<SubscriptionCanaryProfile, "nativeVersion" | "binarySHA256">
> = [];
export function managedPreferenceAbsent({
  result,
  domain,
  key,
}: {
  result: Pick<SpawnSyncReturns<string>, "status" | "error" | "stderr">;
  domain: string;
  key: string | undefined;
}): boolean {
  if (result.status !== 1 || result.error) return false;
  const message = result.stderr
    .trim()
    .replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} defaults\[\d+:\d+\] ?\r?\n/, "");
  return (
    message === `Domain ${domain} does not exist` ||
    message === `Error: Domain '${domain}' not found.` ||
    (key !== undefined &&
      (message === `The domain/default pair of (${domain}, ${key}) does not exist` ||
        message === `Error: Could not find key '${key}' in domain '${domain}'.`))
  );
}
export function checkNativeProfile(
  profile: SubscriptionCanaryProfile,
  environment: NodeJS.ProcessEnv = nativeEnvironment(),
  compared: readonly ComparedEnvironmentKey[] = COMPARED_ENVIRONMENT,
): void {
  if (process.platform !== "darwin") throw Error("native-profile-unqualified");
  if (
    profile.provider === "codex" &&
    !(
      profile.model === "gpt-6.1-sol" &&
      qualifiedCodexProfiles.some(
        (p) => p.nativeVersion === profile.nativeVersion && p.binarySHA256 === profile.binarySHA256,
      )
    )
  )
    throw Error("native-profile-unqualified");
  checkNativeEnvironment(environment, compared);
  const version = spawnSync(profile.binaryRealPath, ["--version"], {
    encoding: "utf8",
    env: environment,
    timeout: 5000,
    maxBuffer: 8192,
  });
  const expected =
    profile.provider === "codex"
      ? `codex-cli ${profile.nativeVersion}`
      : `${profile.nativeVersion} (Claude Code)`;
  if (version.status !== 0 || version.error || version.stdout.trim() !== expected)
    throw Error("native-profile-unqualified");
  const command = profile.provider === "codex" ? ["exec", "resume", "--help"] : ["--help"];
  checkNativeEnvironment(environment, compared);
  const result = spawnSync(profile.binaryRealPath, command, {
    encoding: "utf8",
    env: environment,
    timeout: 5000,
    maxBuffer: 131072,
  });
  const required =
    profile.provider === "codex"
      ? ["--ignore-user-config", "--ignore-rules", "--json"]
      : [
          "--safe-mode",
          "--setting-sources",
          "--tools",
          "--strict-mcp-config",
          "--session-id",
          "--json-schema",
          "--permission-prompts",
        ];
  if (result.status !== 0 || result.error || required.some((flag) => !result.stdout.includes(flag)))
    throw Error("native-profile-unqualified");
  const home = environment.HOME;
  if (!home) throw Error("native-profile-unqualified");
  const paths =
    profile.provider === "codex"
      ? [
          "/etc/codex/config.toml",
          "/etc/codex/managed_config.toml",
          "/etc/codex/requirements.toml",
          "/Library/Managed Preferences/com.openai.codex.plist",
        ]
      : [
          "/Library/Application Support/ClaudeCode",
          "/Library/Managed Preferences/com.anthropic.claudecode.plist",
          `${home}/.claude/managed-settings.json`,
          `${home}/.claude/remote-settings.json`,
        ];
  if (paths.some((p) => existsSync(p))) throw Error("native-profile-unqualified");
  // Codex uses two documented MDM payload keys; ordinary app UI preferences are not policy.
  const domain = profile.provider === "codex" ? "com.openai.codex" : "com.anthropic.claudecode";
  const keys =
    profile.provider === "codex" ? ["config_toml_base64", "requirements_toml_base64"] : [undefined];
  for (const key of keys) {
    checkNativeEnvironment(environment, compared);
    const managed = spawnSync("/usr/bin/defaults", ["read", domain, ...(key ? [key] : [])], {
      encoding: "utf8",
      env: environment,
      timeout: 1000,
      maxBuffer: 8192,
    });
    if (!managedPreferenceAbsent({ result: managed, domain, key }))
      throw Error("native-profile-unqualified");
  }
  if (profile.provider === "codex") {
    checkNativeEnvironment(environment, compared);
    const startup = spawnSync(
      profile.binaryRealPath,
      [
        "app-server",
        "--print-startup-config",
        "-c",
        "features.hooks=false",
        "-c",
        "features.apps=false",
        "-c",
        'web_search="disabled"',
      ],
      { encoding: "utf8", env: environment, timeout: 10000, maxBuffer: 262144 },
    );
    if (startup.status !== 0 || startup.error) throw Error("native-profile-unqualified");
    const config: unknown = JSON.parse(startup.stdout);
    if (
      !object(config) ||
      config.appServerVersion !== profile.nativeVersion ||
      !object(config.configRequirements) ||
      config.configRequirements.requirements !== null
    )
      throw Error("native-profile-unqualified");
  }
}

/** Every path variable the supervised canary compares with the controller's environment. */
export const COMPARED_ENVIRONMENT = ["HOME", "CODEX_HOME", "TMPDIR"] as const;
export type ComparedEnvironmentKey = (typeof COMPARED_ENVIRONMENT)[number];

export function checkNativeEnvironment(
  environment: NodeJS.ProcessEnv,
  keys: readonly ComparedEnvironmentKey[] = COMPARED_ENVIRONMENT,
): void {
  for (const key of keys)
    if (process.env[key] !== environment[key]) throw Error("environment-mismatch");
}

/**
 * Correspondence pins TMPDIR in the plan and sets it for the child instead of comparing it with the
 * controller's. The pinned folder must be its own realpath (no symlink anywhere in it), have no
 * ACL, and be either the owner's own folder with mode exactly 0700 or a root-owned sticky folder.
 * Every parent up to `/` must be owned by the owner or root and not writable by group or others,
 * unless it is root-owned and sticky. Claude gets exactly this checked path.
 */
export function checkPinnedTemporaryDirectory(path: string | null): void {
  if (path === null) return;
  try {
    if (!isAbsolute(path) || realpathSync(path) !== path) throw Error("environment-mismatch");
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
    try {
      const s = fstatSync(fd);
      const own = s.uid === process.getuid?.() && (s.mode & 0o7777) === 0o700;
      const stickyRoot = s.uid === 0 && Boolean(s.mode & 0o1000);
      if (!s.isDirectory() || !(own || stickyRoot)) throw Error("environment-mismatch");
      noAcl(path, fd);
    } finally {
      closeSync(fd);
    }
    checkAncestors(path);
  } catch {
    throw Error("environment-mismatch");
  }
}

export function nativeEnvironment(environment?: SupervisedEnvironment): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: "C",
    LC_ALL: "C",
    SHELL: "/bin/sh",
  };
  for (const key of ["HOME", "CODEX_HOME", "TMPDIR"] as const) {
    const value = environment ? environment[key] : process.env[key];
    if (value !== null && value !== undefined) env[key] = value;
  }
  for (const key of ["USER", "LOGNAME"])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  return Object.freeze(env);
}
