Scan the provided code for security vulnerabilities using the OWASP Top 10 as a framework.

## Checks

1. **Injection** — SQL, NoSQL, OS command, LDAP injection vectors. Check for unsanitized user input in queries, shell commands, or template literals.
2. **Broken authentication** — Hardcoded credentials, weak token generation, missing session expiry.
3. **Sensitive data exposure** — API keys, tokens, passwords in source. PII logged or stored unencrypted.
4. **XXE** — XML parsing with external entity resolution enabled.
5. **Broken access control** — Missing authorization checks, IDOR vulnerabilities, privilege escalation paths.
6. **Security misconfiguration** — Debug mode in production, default credentials, overly permissive CORS.
7. **XSS** — Unescaped user input rendered in HTML/JSX. `dangerouslySetInnerHTML` without sanitization.
8. **Insecure deserialization** — `JSON.parse` on untrusted input without validation, `eval()`, `Function()`.
9. **Known vulnerabilities** — Outdated dependencies with published CVEs.
10. **Insufficient logging** — Security events (auth failures, access denials) not logged.

## Additional checks

- **Secrets in git** — `.env` files, API keys, private keys committed
- **Path traversal** — File operations using unsanitized user input
- **Prototype pollution** — Unsafe object spread or merge on user-controlled data
- **ReDoS** — Regex patterns vulnerable to catastrophic backtracking

## Output

For each finding:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Category**: OWASP category or additional check name
- **Location**: file:line
- **Description**: What's vulnerable and how it could be exploited
- **Remediation**: Specific fix
