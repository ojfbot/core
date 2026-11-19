import { FleetHttpError } from "./client.js";

const CODES = new Set([
  "EACCES",
  "EPERM",
  "EROFS",
  "ENOENT",
  "ENOSPC",
  "EIO",
  "EADDRINUSE",
  "EADDRNOTAVAIL",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ERR_SQLITE_ERROR",
  "ERR_SSL_PEM_BAD_BASE64_DECODE",
  "ERR_OSSL_PEM_NO_START_LINE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UND_ERR_CONNECT_TIMEOUT",
]);
const ERROR_NAMES = new Map([
  ["TypeError", "unexpected-type-error"],
  ["RangeError", "unexpected-range-error"],
  ["ReferenceError", "unexpected-reference-error"],
  ["SyntaxError", "unexpected-syntax-error"],
  ["URIError", "unexpected-uri-error"],
]);

/** Deliberately excludes error messages, stacks, response bodies and filesystem paths. */
export function errorCode(error: unknown): string {
  if (error instanceof FleetHttpError) return `http-${error.status}`;
  if (error instanceof Error && error.name === "TimeoutError") return "timeout";
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string" && CODES.has(error.code))
      return error.code;
    if ("cause" in error && error.cause !== error) return errorCode(error.cause);
  }
  if (
    error instanceof Error &&
    [
      "missing-configuration",
      "incompatible-status",
      "invalid-arguments",
      "invalid-cursor",
      "invalid-control",
      "invalid-status-roles",
      "invalid-worker-settings",
      "unsafe-worker-file",
      "invalid-worker-path",
      "invalid-worker-interval",
      "invalid-worker-endpoint",
      "invalid-declared-command",
      "agent-or-shell-command-refused",
      "invalid-command-executable",
      "invalid-proof-request",
      "invalid-worker-plist",
      "proof-wake-approval-window-too-short",
      "proof-wake-approval-window-missed",
      "proof-wake-authorization-timeout",
      "proof-wake-authorization-failed",
      "proof-wake-schedule-refused",
      "proof-wake-cleanup-unverified",
      "proof-schedule-baseline-changed",
      "proof-wake-preparation-too-late",
      "proof-wake-readback-mismatch",
    ].includes(error.message)
  )
    return error.message;
  // Proof failures are fixed internal invariant names, never provider, job, path, or response text.
  // Preserve the exact invariant so a held launcher can be diagnosed without exposing its cause text.
  if (error instanceof Error && /^proof-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(error.message))
    return error.message;
  if (error instanceof Error && /^job table schema [0-9]+, expected [0-9]+$/.test(error.message))
    return "schema-incompatible";
  if (error instanceof Error && ERROR_NAMES.has(error.name)) return ERROR_NAMES.get(error.name)!;
  return "unexpected-error";
}
