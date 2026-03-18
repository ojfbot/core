# Security Checklist

Audit points for the `/hardening` security phase. Each finding produces a ranked item in the report.

## Authentication and authorization

- [ ] All API routes that access user data require auth middleware
- [ ] Auth middleware verifies the token (not just decodes it)
- [ ] Resource access checks ownership (`resource.userId === user.id`)
- [ ] Admin-only routes are protected with role check, not just auth check
- [ ] Session tokens have a reasonable expiry (not "never")
- [ ] Logout/revocation invalidates the token server-side (or short enough TTL)

## Input handling

- [ ] User input is not interpolated into SQL queries (use parameterized queries)
- [ ] User input is not interpolated into shell commands (use `child_process` with args array)
- [ ] User input is not interpolated into LLM system prompts (content injection)
- [ ] File upload paths are validated — no path traversal (`../../etc/passwd`)
- [ ] URLs from user input are validated before fetching (SSRF)
- [ ] HTML content from user input is escaped before rendering (XSS)

## Secrets management

- [ ] No API keys, passwords, or tokens in source code
- [ ] All secrets loaded from environment variables
- [ ] `.env.example` exists and documents all required vars (without values)
- [ ] `.env*` files are in `.gitignore`
- [ ] Secrets are not logged (even partially)

## Dependency security

- [ ] `pnpm audit` shows no critical or high severity CVEs
- [ ] No packages with known malicious versions in use
- [ ] Package lock file checked in and up to date

## Network and CORS

- [ ] CORS origin list is explicit (not `*`) in production
- [ ] Sensitive endpoints are not publicly accessible without auth
- [ ] HTTP-only cookies used for session tokens (not accessible to JS)
- [ ] HTTPS enforced in production

## Extension-specific (if applicable)

See `knowledge/prompt-injection-guide.md` in `/extension-audit` for extension-specific patterns.

## Severity thresholds for reporting

| Severity | Criteria | Report as |
|----------|----------|-----------|
| CRITICAL | Auth bypass, data leakage, RCE possible | BLOCKING |
| HIGH | Auth present but incomplete, injection vectors | BLOCKING |
| MEDIUM | Defense-in-depth gaps, missing rate limiting | WARNING |
| LOW | Cosmetic, optional hardening | INFO |
