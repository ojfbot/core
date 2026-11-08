// Preserve bounded child diagnostics without exposing stderr, commands, paths or credentials.
const PHASE =
  /^(?:prepare|resume-prepare|run|arm-reboot|after-reboot|status|tls-readiness|graceful-stop|replacement|readiness-storage|future-schema|readonly-output|missing-owner-verifier|final|public-verifiers|public-ca|service-permissions|service-start|crash-(?:[1-9]|10))$/;
const CODE =
  /^(?:http-[1-5][0-9]{2}|timeout|unexpected-error|schema-incompatible|ssh-unavailable|ssh-authentication|docker-unavailable|subprocess-timeout|EACCES|EPERM|EROFS|ENOENT|ENOSPC|EIO|EADDRINUSE|EADDRNOTAVAIL|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ERR_SQLITE_ERROR|ERR_SSL_PEM_BAD_BASE64_DECODE|ERR_OSSL_PEM_NO_START_LINE|ERR_TLS_CERT_ALTNAME_INVALID|DEPTH_ZERO_SELF_SIGNED_CERT|CERT_HAS_EXPIRED|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UND_ERR_CONNECT_TIMEOUT)$/;

export function qualificationDiagnostic(error, phase, fallbackCode) {
  const stderr = typeof error?.stderr === "string" ? error.stderr : "";
  for (const line of stderr.split("\n").reverse()) {
    try {
      const candidate = JSON.parse(line);
      if (
        candidate.status === "blocked" &&
        PHASE.test(candidate.phase) &&
        CODE.test(candidate.code)
      ) {
        return { status: "blocked", phase: candidate.phase, code: candidate.code };
      }
    } catch {
      /* Ignore arbitrary stderr; never replay it. */
    }
  }
  let code = CODE.test(fallbackCode ?? "") ? fallbackCode : "unexpected-error";
  if (/Permission denied \(publickey/.test(stderr)) code = "ssh-authentication";
  else if (
    /Connection refused|Connection timed out|Could not resolve hostname|Host key verification failed/.test(
      stderr,
    )
  )
    code = "ssh-unavailable";
  else if (/Cannot connect to the Docker daemon|permission denied.*docker\.sock/i.test(stderr))
    code = "docker-unavailable";
  else if (error?.killed) code = "subprocess-timeout";
  return { status: "blocked", phase: PHASE.test(phase) ? phase : "status", code };
}
