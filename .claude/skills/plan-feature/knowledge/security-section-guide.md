# Security Section Guide

## Threat Model Checklist

For every feature plan, evaluate:

### Input Handling
- [ ] All user input validated with Zod schemas at API boundaries
- [ ] No raw `req.body`/`req.params`/`req.query` access without validation
- [ ] File uploads validated (type, size, content)

### Authentication & Authorization
- [ ] Auth middleware applied to new routes
- [ ] Authorization checks for resource access
- [ ] API keys stored in `env.json` (never browser-side)
- [ ] No `dangerouslyAllowBrowser` flag

### Data Exposure
- [ ] No source maps in production (`sourceMap: false`)
- [ ] No API keys in client bundles
- [ ] No sensitive data in error messages
- [ ] PII handled according to privacy policy

### Injection
- [ ] SQL injection: parameterized queries
- [ ] XSS: React's built-in escaping, no `dangerouslySetInnerHTML`
- [ ] Command injection: no user input in shell commands
- [ ] SSRF: validate URLs before server-side fetch

### Build Artifacts
- [ ] Post-build artifact scanner catches leaks
- [ ] `dist/` never committed to git
- [ ] No debug artifacts (`debugger`, `console.log`) in production

## OWASP Top 10 Quick Reference

1. Broken Access Control → auth middleware + route guards
2. Cryptographic Failures → env.json for secrets, HTTPS only
3. Injection → Zod validation at boundaries
4. Insecure Design → threat model in feature plan
5. Security Misconfiguration → shared tsconfig, ESLint rules
6. Vulnerable Components → `pnpm audit`, dependency overrides
7. Auth Failures → session management, token rotation
8. Data Integrity Failures → artifact scanner, pre-commit hooks
9. Logging Failures → structured logging, no PII in logs
10. SSRF → URL allowlisting, no user-controlled server fetches
