/**
 * settings.ts: the ONLY place a package reads its environment (adr:package-env-files).
 *
 * Copy to packages/<name>/src/settings.ts and edit the SETTINGS section at the bottom. Then:
 *   - list every key in packages/<name>/.env.example (blank or <placeholder> values, a comment each);
 *   - call loadSettings() once at the entry point and pass the frozen object down;
 *   - never read process.env anywhere else in the package.
 *
 * Resolution: packages/<name>/.env (optional; must be mode 600), overridden by real environment
 * variables, so a deployment or a test can inject values. Errors name the key, never its value.
 * This template is itself tested (scripts/lib/__tests__/package-settings-template.test.mjs).
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export class SettingsError extends Error {}

export type Env = Readonly<Record<string, string | undefined>>;

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

function privateText(file: string, label: string): string | undefined {
  let mode: number;
  try {
    mode = statSync(file).mode;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw new SettingsError(`${label} cannot be read`);
  }
  if (mode & 0o077) throw new SettingsError(`${label} must be private (chmod 600)`);
  return readFileSync(file, "utf8");
}

/** KEY=VALUE lines; blank lines and # comments skipped; one pair of surrounding quotes stripped. */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    const key = eq > 0 ? line.slice(0, eq).trim() : "";
    if (!KEY.test(key)) throw new SettingsError(`.env line ${index + 1} is not KEY=VALUE`);
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  });
  return values;
}

/** The package's .env (if present), with real environment variables taking precedence. */
export function loadEnv(file: string, environ: Env = process.env): Env {
  const text = privateText(file, "the package .env");
  const merged: Record<string, string | undefined> = text === undefined ? {} : parseEnvFile(text);
  for (const [key, value] of Object.entries(environ)) if (value !== undefined) merged[key] = value;
  return Object.freeze(merged);
}

export function reader(env: Env) {
  const get = (key: string): string | undefined => {
    const value = env[key]?.trim();
    return value ? value : undefined;
  };
  return {
    required(key: string): string {
      const value = get(key);
      if (value === undefined) throw new SettingsError(`missing setting: ${key}`);
      return value;
    },
    optional(key: string, fallback: string): string {
      return get(key) ?? fallback;
    },
    integer(key: string, fallback: number, min: number, max: number): number {
      const value = get(key);
      if (value === undefined) return fallback;
      const parsed = /^\d+$/.test(value) ? Number(value) : NaN;
      if (!(parsed >= min && parsed <= max)) throw new SettingsError(`${key} must be a whole number from ${min} to ${max}`);
      return parsed;
    },
    /** A *_FILE key: the path to a private secret file. Returns the secret, trimmed. */
    secretFile(key: string): string {
      const text = privateText(this.required(key), `the file named by ${key}`);
      const secret = text?.trim();
      if (!secret) throw new SettingsError(`the file named by ${key} is missing or empty`);
      return secret;
    },
  };
}

// --- SETTINGS: edit this section for your package --------------------------------------------

const PACKAGE_ENV = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");

export interface Settings {
  readonly endpoint: string;
  readonly token: string;
  readonly workers: number;
}

export function loadSettings(environ: Env = process.env, file: string = PACKAGE_ENV): Settings {
  const r = reader(loadEnv(file, environ));
  return Object.freeze({
    endpoint: r.required("EXAMPLE_ENDPOINT"),
    token: r.secretFile("EXAMPLE_TOKEN_FILE"),
    workers: r.integer("EXAMPLE_WORKERS", 2, 1, 32),
  });
}
